"""Nodo `make_decision` — sexto nodo del grafo (PRD §3.1.3).

Construye un `DecisionContext` con todo el material recolectado por los nodos
previos y se lo pasa al `AuthorizationDecisionMaker` (port high-level que
internamente usa `LLMProvider.complete_structured`).

Importante: este nodo NO aplica gate de confidence ni decide cobertura final.
Eso es responsabilidad de `persist_case` (rule engine determinístico). El
LLM produce un `AgentDecision` con outcome sugerido + rationale + evidence;
el agregador final lo confirma o lo override según las reglas duras.

`preliminary_outcome` que se le pasa al LLM es una heurística rápida basada
en los flags determinísticos:
- Política inactiva, procedimiento no cubierto o carencia incumplida →
  `ESCALATED` (el LLM puede confirmarlo o pedir más datos).
- Faltan docs → `DOCS_REQUESTED`.
- Todo OK → `APPROVED_AUTO`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pre_autorizacion.features.authorization_cases.application.agent._trace import (
    trace_node,
)
from pre_autorizacion.features.authorization_cases.domain.ports.authorization_decision_maker import (  # noqa: E501
    DecisionContext,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects import Outcome

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


def _preliminary_outcome(state: AgentGraphState) -> Outcome:
    """Decide el `preliminary_outcome` que se le pasa al LLM.

    No es la decisión final — solo guía al modelo. El gate determinístico
    final vive en `persist_case`.
    """
    if state.get("policy_active") is False:
        return Outcome.ESCALATED
    if state.get("procedure_covered") is False:
        return Outcome.ESCALATED
    if state.get("waiting_period_met") is False:
        return Outcome.ESCALATED
    if state.get("missing_docs"):
        return Outcome.DOCS_REQUESTED
    return Outcome.APPROVED_AUTO


async def make_decision_node(state: AgentGraphState) -> dict[str, Any]:
    """Llama al `AuthorizationDecisionMaker` y persiste el `AgentDecision`."""
    decision_maker = state["decision_maker"]
    extracted = state.get("extracted")
    if extracted is None:
        # Sin extracción no podemos llamar al LLM con un contexto válido.
        # Levantamos error para que el orchestrator lo capture y `persist_case`
        # arme un escalamiento `EXTRACTION_FAILED`.
        raise RuntimeError("make_decision_node requires `extracted` in state")

    context = DecisionContext(
        report=state["report"],
        policy=state["policy"],
        coverage=state["coverage"],
        extraction=extracted,
        preliminary_outcome=_preliminary_outcome(state),
        missing_docs=state.get("missing_docs", ()),
    )

    async with trace_node(
        state,
        node="make_decision",
        model_used=None,  # el adapter LLM lo setea en `agent_decision.model_used`.
    ) as set_detail:
        decision = await decision_maker.decide(context)
        set_detail(
            f"outcome={decision.outcome.value} confidence={decision.confidence:.2f}"
        )

    return {"agent_decision": decision}


__all__ = ["make_decision_node"]
