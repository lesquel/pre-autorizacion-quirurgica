"""Nodo `persist_case` — séptimo y último nodo del grafo (PRD §3.1.3).

NO escribe al repositorio (eso lo hace `SubmitCaseUseCase` con `repository.update`
después de drenar el stream). Acá actuamos como **agregador final**:

1. Combinamos el resultado del rule engine determinístico (carencia, docs,
   policy_active, procedure_covered) con el `AgentDecision` del LLM.
2. Aplicamos el **gate de confidence** (`confidence < 0.80` → ESCALATED) a
   través de `apply_confidence_gate` del rule engine.
3. Armamos `final_outcome` + `final_escalation_reason` que el orchestrator
   embebe en el `AgentDoneEvent` final.

Política PRD §3.1.3: el agente NUNCA auto-rechaza. Cualquier condición
desfavorable es un ESCALATED a auditor humano.

Orden de prioridad (la primera regla que dispara domina):
    1. Errores acumulados                  → ESCALATED + UNEXPECTED_ERROR
    2. Política inactiva                   → ESCALATED + POLICY_INACTIVE
    3. Procedimiento no cubierto / no match→ ESCALATED + PROCEDURE_NOT_COVERED
                                              o LOW_CONFIDENCE_PROCEDURE_MATCH
    4. Carencia incumplida                 → ESCALATED + WAITING_PERIOD_NOT_MET
    5. Faltan docs                         → DOCS_REQUESTED (sujeto a gate)
    6. Todo OK + confidence alta           → APPROVED_AUTO
    7. Confidence baja                     → ESCALATED + LOW_CONFIDENCE
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pre_autorizacion.features.authorization_cases.application.agent._trace import (
    trace_node,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects import (
    EscalationReason,
    Outcome,
)
from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    apply_confidence_gate,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


# Threshold mínimo para considerar un match de procedimiento aceptable. Igual
# al usado por `match_procedure_node`. Lo mantenemos local para que el nodo
# sea puro (sin Settings global).
_PROCEDURE_MATCH_THRESHOLD: float = 0.85


def _aggregate_final(
    state: AgentGraphState,
) -> tuple[Outcome, EscalationReason | None]:
    """Combina rule engine + LLM y devuelve `(final_outcome, escalation_reason)`."""
    # 1. Errores acumulados — escalamiento defensivo.
    errors = state.get("errors") or []
    if errors:
        return Outcome.ESCALATED, EscalationReason.UNEXPECTED_ERROR

    # 2. Política inactiva.
    if state.get("policy_active") is False:
        return Outcome.ESCALATED, EscalationReason.POLICY_INACTIVE

    # 3. Procedimiento no cubierto o match débil.
    coverage = state["coverage"]
    if not coverage.covered:
        return Outcome.ESCALATED, EscalationReason.PROCEDURE_NOT_COVERED
    match_score = state.get("procedure_match_score") or 0.0
    if match_score < _PROCEDURE_MATCH_THRESHOLD:
        return Outcome.ESCALATED, EscalationReason.LOW_CONFIDENCE_PROCEDURE_MATCH

    # 4. Carencia incumplida.
    if state.get("waiting_period_met") is False:
        return Outcome.ESCALATED, EscalationReason.WAITING_PERIOD_NOT_MET

    # 5/6/7. El LLM ya emitió outcome — aplicamos gate de confidence.
    decision = state.get("agent_decision")
    if decision is None:
        # Sin decisión del LLM no podemos avanzar — escalamos por extracción.
        return Outcome.ESCALATED, EscalationReason.EXTRACTION_FAILED

    if state.get("missing_docs"):
        # Faltan docs: el rule engine fuerza DOCS_REQUESTED (sujeto al gate).
        gated, reason = apply_confidence_gate(
            Outcome.DOCS_REQUESTED,
            decision.confidence,
            DEFAULT_CONFIDENCE_THRESHOLD,
        )
        return gated, reason

    gated, reason = apply_confidence_gate(
        decision.outcome,
        decision.confidence,
        DEFAULT_CONFIDENCE_THRESHOLD,
        existing_reason=decision.escalation_reason,
    )
    return gated, reason


async def persist_case_node(state: AgentGraphState) -> dict[str, Any]:
    """Aggregador final. NO toca el repositorio — sólo consolida el outcome."""
    async with trace_node(state, node="persist_case") as set_detail:
        final_outcome, escalation_reason = _aggregate_final(state)
        set_detail(
            f"final_outcome={final_outcome.value} "
            f"reason={escalation_reason.value if escalation_reason else None}"
        )

    return {
        "final_outcome": final_outcome,
        "final_escalation_reason": escalation_reason,
    }


__all__ = ["persist_case_node"]
