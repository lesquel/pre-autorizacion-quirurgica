"""LangGraphAgentOrchestrator — adapter del port `AgentOrchestrator`.

Implementa `AgentOrchestrator.run` consumiendo el grafo compilado de
`application/agent/graph.py`.

Estrategia de streaming (MVP):
    Usamos `await graph.ainvoke(initial_state)` para correr el grafo end-to-end
    y luego emitimos los `AgentStepEvent` desde el `state["trace_steps"]` final.
    Esto:
    - mantiene el contrato `AsyncIterator[AgentEvent]` del port,
    - simplifica el manejo de errores (un único punto de captura),
    - es suficientemente realtime para la demo (cada nodo dura <1s en promedio
      y el SSE consumer no necesita "tipos" intermedios).

    Cuando necesitemos streaming "vivo" (ver cada nodo a medida que termina)
    podemos cambiar a `graph.astream(stream_mode="updates")` y emitir un
    AgentStepEvent por update — el state final igual viene en el último update.

Selección del extractor:
    El grafo es agnóstico al formato; este adapter elige `extractor_text` vs
    `extractor_pdf` según `request.report.format` y lo inyecta en el state
    inicial. Esto evita dos grafos separados y mantiene la traza idéntica.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, cast

from pre_autorizacion.features.authorization_cases.application.agent.state import (
    AgentGraphState,
)
from pre_autorizacion.features.authorization_cases.domain.entities.medical_report import (
    ReportFormat,
)
from pre_autorizacion.features.authorization_cases.domain.ports.agent_orchestrator import (
    AgentDoneEvent,
    AgentErrorEvent,
    AgentEvent,
    AgentOrchestrator,
    AgentRunRequest,
    AgentStepEvent,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects import (
    AgentDecision,
    DecidedBy,
    EscalationReason,
    Outcome,
)

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph

    from pre_autorizacion.features.authorization_cases.domain.ports.authorization_decision_maker import (  # noqa: E501
        AuthorizationDecisionMaker,
    )
    from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (  # noqa: E501
        MedicalReportExtractor,
    )


class LangGraphAgentOrchestrator(AgentOrchestrator):
    """Implementación canónica del port `AgentOrchestrator` con LangGraph.

    Construido a partir de:
    - `graph`: el `CompiledStateGraph` armado por `build_graph()`.
    - `extractor_text` / `extractor_pdf`: dos implementaciones del port
      `MedicalReportExtractor` — el orchestrator elige una según el formato
      del informe.
    - `decision_maker`: el `AuthorizationDecisionMaker` (LLM con structured
      output).
    """

    def __init__(
        self,
        *,
        graph: CompiledStateGraph[
            AgentGraphState, None, AgentGraphState, AgentGraphState
        ],
        extractor_text: MedicalReportExtractor,
        extractor_pdf: MedicalReportExtractor,
        decision_maker: AuthorizationDecisionMaker,
    ) -> None:
        self._graph = graph
        self._extractor_text = extractor_text
        self._extractor_pdf = extractor_pdf
        self._decision_maker = decision_maker

    def run(self, request: AgentRunRequest) -> AsyncIterator[AgentEvent]:
        """Devuelve el async iterator de eventos del agente.

        El método es síncrono porque devuelve un generador; el trabajo
        real ocurre dentro del `_run_async` cuando el caller hace `async for`.
        """
        return self._run_async(request)

    # ── Implementación interna ─────────────────────────────────────────────

    async def _run_async(self, request: AgentRunRequest) -> AsyncIterator[AgentEvent]:
        """Generador asíncrono que ejecuta el grafo y emite los eventos."""
        # 1. Elegir el extractor según el formato del report.
        extractor = (
            self._extractor_pdf
            if request.report.format is ReportFormat.PDF
            else self._extractor_text
        )

        # 2. Inicializar el state. El `case_id` es opcional acá (lo conoce el
        #    use case, no el agente — útil para logging futuro).
        initial_state: AgentGraphState = {
            "case_id": "",
            "report": request.report,
            "policy": request.policy,
            "coverage": request.coverage,
            "scenario_key": request.scenario_key,
            "extractor": extractor,
            "decision_maker": self._decision_maker,
            "trace_steps": [],
            "errors": [],
            "missing_docs": (),
        }

        # 3. Ejecutar el grafo. Capturamos cualquier excepción para emitir
        #    `AgentErrorEvent` con la traza acumulada (puede ser parcial).
        try:
            raw_final = await self._graph.ainvoke(initial_state)
        except Exception as exc:  # noqa: BLE001 — boundary catch.
            partial_trace = tuple(initial_state.get("trace_steps") or [])
            for step in partial_trace:
                yield AgentStepEvent(step=step)
            yield AgentErrorEvent(error=str(exc), trace=partial_trace)
            return

        # `ainvoke` está tipado `dict[str, Any] | Any`; en runtime es el state
        # final (TypedDict). Castamos para mantener la disciplina de tipos.
        final_state = cast(AgentGraphState, raw_final)

        # 4. Emitir los step events desde la traza acumulada.
        trace_steps = tuple(final_state.get("trace_steps") or [])
        for step in trace_steps:
            yield AgentStepEvent(step=step)

        # 5. Construir la decisión final consolidada y emitir el `AgentDoneEvent`.
        decision = self._build_final_decision(final_state)
        yield AgentDoneEvent(decision=decision, trace=trace_steps)

    @staticmethod
    def _build_final_decision(state: AgentGraphState) -> AgentDecision:
        """Combina el `AgentDecision` del LLM con el `final_outcome` del agregador.

        El `persist_case` node ya consolidó el outcome aplicando rule engine +
        gate de confidence. Acá creamos un `AgentDecision` final con esos
        valores, manteniendo el `rationale` / `evidence` / `confidence` del LLM
        siempre que existan.

        Si el LLM nunca devolvió decisión (caso de error temprano), armamos un
        `AgentDecision` defensivo con `decided_by=AGENT` y rationale genérico.
        """
        final_outcome = state.get("final_outcome") or Outcome.ESCALATED
        escalation_reason = state.get("final_escalation_reason")

        llm_decision = state.get("agent_decision")
        if llm_decision is not None:
            return AgentDecision(
                outcome=final_outcome,
                rationale=llm_decision.rationale,
                confidence=llm_decision.confidence,
                decided_by=DecidedBy.AGENT,
                evidence=llm_decision.evidence,
                missing_docs=state.get("missing_docs", ()),
                escalation_reason=escalation_reason,
                model_used=llm_decision.model_used,
            )

        # Fallback: el LLM no llegó a correr (extracción falló, etc.).
        return AgentDecision(
            outcome=final_outcome,
            rationale=(
                "El agente no pudo completar la corrida y derivó el caso "
                "a un auditor humano."
            ),
            confidence=0.0,
            decided_by=DecidedBy.AGENT,
            evidence=(),
            missing_docs=state.get("missing_docs", ()),
            escalation_reason=escalation_reason or EscalationReason.UNEXPECTED_ERROR,
            model_used=None,
        )


__all__ = ["LangGraphAgentOrchestrator"]
