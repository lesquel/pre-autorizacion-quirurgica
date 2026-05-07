"""INITIAL_CASES — casos pre-cargados para el dashboard de Aseguradora y la
bandeja del Auditor en el primer arranque del demo.

Origen: `frontend/src/app/shared/fixtures/initial-cases.ts` (a su vez derivado
de `window.INITIAL_CASES` del prototipo `preatuomatizacion/data.js`).

Campos inferidos / inventados (no estaban en el prototipo, mantenidos
idénticos al port TS):
- `report_id`     : derivado del id del caso (`'RPT-' + sufijo`).
- `decision`      : reconstruido a partir de outcome/confidence/escalation/missing.
- `agent_trace`   : un único `TraceStep` agregado (`'agent_run'`).
- `decided_at`    : reusa `created_at` (todos los casos del seed son terminales).
- `decision.decided_by` : siempre `AGENT`.
- `decision.model_used` : `'deepseek-chat'` (PRD §3.1.1).

Mapping outcome → CaseStatus:
- APPROVED_AUTO   → APROBADO_AUTO
- DOCS_REQUESTED  → DOCS_PEDIDOS
- ESCALATED       → ESCALADO
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Final

from pre_autorizacion.features.authorization_cases.domain.entities.authorization_case import (
    AuthorizationCase,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.agent_decision import (
    AgentDecision,
    DecidedBy,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.case_status import (
    CaseStatus,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.escalation_reason import (
    EscalationReason,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.outcome import Outcome
from pre_autorizacion.features.authorization_cases.domain.value_objects.trace_step import (
    TraceStep,
    TraceStepState,
)

_MODEL_USED: Final[str] = "deepseek-chat"


@dataclass(frozen=True, slots=True)
class _SeededCaseRaw:
    """Forma cruda intermedia (espejo de `SeededCaseRaw` del TS)."""

    id: str
    created_at: str
    policy_number: str
    procedure_code: str
    outcome: Outcome
    confidence: float
    duration_ms: int
    tokens: int
    escalation_reason: EscalationReason | None = None
    missing_docs: tuple[str, ...] = ()


_RAW: tuple[_SeededCaseRaw, ...] = (
    _SeededCaseRaw(
        id="CASE-01H7K2",
        created_at="2026-05-06T08:14:22Z",
        policy_number="POL-2024-04812",
        procedure_code="K80.20",
        outcome=Outcome.APPROVED_AUTO,
        confidence=0.94,
        duration_ms=7820,
        tokens=4820,
    ),
    _SeededCaseRaw(
        id="CASE-01H7J9",
        created_at="2026-05-06T07:51:09Z",
        policy_number="POL-2023-07331",
        procedure_code="N40.1",
        outcome=Outcome.DOCS_REQUESTED,
        confidence=0.88,
        duration_ms=6210,
        tokens=3990,
        missing_docs=("Ecografía prostática",),
    ),
    _SeededCaseRaw(
        id="CASE-01H7G3",
        created_at="2026-05-06T06:12:44Z",
        policy_number="POL-2025-01193",
        procedure_code="M17.11",
        outcome=Outcome.ESCALATED,
        confidence=0.71,
        duration_ms=8930,
        tokens=5210,
        escalation_reason=EscalationReason.WAITING_PERIOD_NOT_MET,
    ),
    _SeededCaseRaw(
        id="CASE-01H7F1",
        created_at="2026-05-05T22:03:18Z",
        policy_number="POL-2024-09872",
        procedure_code="?",
        outcome=Outcome.ESCALATED,
        confidence=0.42,
        duration_ms=9430,
        tokens=4980,
        escalation_reason=EscalationReason.LOW_CONFIDENCE_PROCEDURE_MATCH,
    ),
    _SeededCaseRaw(
        id="CASE-01H7E8",
        created_at="2026-05-05T19:22:55Z",
        policy_number="POL-2025-02240",
        procedure_code="I83.90",
        outcome=Outcome.ESCALATED,
        confidence=0.38,
        duration_ms=11210,
        tokens=6420,
        escalation_reason=EscalationReason.PDF_EXTRACTION_FAILURE,
    ),
    _SeededCaseRaw(
        id="CASE-01H7C4",
        created_at="2026-05-05T15:48:11Z",
        policy_number="POL-2024-04812",
        procedure_code="H25.13",
        outcome=Outcome.APPROVED_AUTO,
        confidence=0.96,
        duration_ms=6440,
        tokens=4120,
    ),
    _SeededCaseRaw(
        id="CASE-01H7B0",
        created_at="2026-05-05T11:09:33Z",
        policy_number="POL-2024-09872",
        procedure_code="K35.80",
        outcome=Outcome.APPROVED_AUTO,
        confidence=0.91,
        duration_ms=5810,
        tokens=3680,
    ),
)


def _rationale_for(raw: _SeededCaseRaw) -> str:
    """Réplica exacta de `rationaleFor` en initial-cases.ts."""
    if raw.outcome is Outcome.APPROVED_AUTO:
        return (
            f"Cobertura confirmada para {raw.procedure_code}. Carencia cumplida y "
            "documentación completa. Procede pre-aprobación automática."
        )
    if raw.outcome is Outcome.DOCS_REQUESTED:
        missing = ", ".join(raw.missing_docs)
        return (
            f"Cobertura y carencia OK para {raw.procedure_code}. Faltan documentos "
            f"requeridos por la póliza: {missing}. Solicitar al hospital antes de "
            "emitir pre-aprobación."
        )
    # ESCALATED — rationale depende del motivo.
    match raw.escalation_reason:
        case EscalationReason.WAITING_PERIOD_NOT_MET:
            return (
                f"Carencia incumplida para {raw.procedure_code}. POLÍTICA: nunca "
                "rechazar de oficio — escalar a auditor médico para evaluar excepción "
                "clínica."
            )
        case EscalationReason.LOW_CONFIDENCE_PROCEDURE_MATCH:
            return (
                "Match de procedimiento por debajo del umbral configurado (0.85). "
                "Confidence general < 0.80. Requiere clasificación clínica humana."
            )
        case EscalationReason.PDF_EXTRACTION_FAILURE:
            return (
                "Vision API no logró extracción confiable del PDF. NO se intenta OCR "
                "creativo por política. Se escala el caso para revisión humana del "
                "documento original."
            )
        case _:
            return "Caso escalado por motivos no especificados."


def _status_for(raw: _SeededCaseRaw) -> CaseStatus:
    """Mapping outcome → CaseStatus (réplica del TS)."""
    match raw.outcome:
        case Outcome.APPROVED_AUTO:
            return CaseStatus.APROBADO_AUTO
        case Outcome.DOCS_REQUESTED:
            return CaseStatus.DOCS_PEDIDOS
        case Outcome.ESCALATED:
            return CaseStatus.ESCALADO
        case _:
            # Defensivo: los outcomes seedeados sólo son los 3 de arriba.
            return CaseStatus.PENDIENTE


def _build_decision(raw: _SeededCaseRaw) -> AgentDecision:
    return AgentDecision(
        outcome=raw.outcome,
        rationale=_rationale_for(raw),
        confidence=raw.confidence,
        decided_by=DecidedBy.AGENT,
        evidence=(),
        missing_docs=raw.missing_docs,
        escalation_reason=raw.escalation_reason,
        model_used=_MODEL_USED,
    )


def _build_trace(raw: _SeededCaseRaw) -> tuple[TraceStep, ...]:
    """Trace agregado: detalle nodo-por-nodo se reconstruye al re-ejecutar."""
    tokens_in = round(raw.tokens * 0.7)
    tokens_out = raw.tokens - tokens_in
    state = TraceStepState.ERROR if raw.outcome is Outcome.ESCALATED else TraceStepState.DONE
    step = TraceStep(
        node="agent_run",
        timestamp=datetime.fromisoformat(raw.created_at.replace("Z", "+00:00")),
        state=state,
        duration_ms=raw.duration_ms,
        model_used=_MODEL_USED,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        detail=f"{raw.outcome.value} · confidence={raw.confidence}",
    )
    return (step,)


def _build_case(raw: _SeededCaseRaw) -> AuthorizationCase:
    created_at = datetime.fromisoformat(raw.created_at.replace("Z", "+00:00"))
    return AuthorizationCase(
        id=raw.id,
        report_id=f"RPT-{raw.id[5:]}",
        policy_number=raw.policy_number,
        status=_status_for(raw),
        created_at=created_at,
        decision=_build_decision(raw),
        agent_trace=_build_trace(raw),
        decided_at=created_at,
    )


INITIAL_CASES: tuple[AuthorizationCase, ...] = tuple(_build_case(r) for r in _RAW)


__all__ = ["INITIAL_CASES"]
