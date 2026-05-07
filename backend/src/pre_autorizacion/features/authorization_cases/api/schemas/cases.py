"""Pydantic schemas (DTOs) del feature `authorization_cases` — capa API.

Convención: TODOS los schemas heredan de `CamelModel` (camelCase wire format,
populate_by_name=True). Los enums de dominio se serializan como su `value`
(StrEnum cumple el contrato).

Los mappers (`case_to_out`, `decision_to_out`, etc.) convierten entidades de
dominio a DTOs API. Viven acá para mantener el dominio puro (sin Pydantic).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from pre_autorizacion.features.authorization_cases.domain.entities import (
    AuthorizationCase,
    MedicalReport,
    ReportFormat,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects import (
    AgentDecision,
    CaseStatus,
    DecidedBy,
    EscalationReason,
    Evidence,
    EvidenceSource,
    Outcome,
    TraceStep,
    TraceStepState,
)
from pre_autorizacion.shared.api.schemas import CamelModel

# ── Inputs (POST bodies) ──────────────────────────────────────────────────


class MedicalReportIn(CamelModel):
    """Informe médico que el hospital adjunta al crear un caso."""

    patient_id: str = Field(..., description="ID del paciente (Pacientes:id).")
    format: ReportFormat = Field(default=ReportFormat.TEXT)
    content: str = Field(..., description="Contenido del informe (texto o ruta del PDF).")
    procedure_solicited_hint: str | None = Field(
        default=None,
        description="Procedimiento sugerido por el hospital (código o descripción).",
    )
    diagnosis: str | None = None
    attending_doctor: str | None = None


class CaseSubmitIn(CamelModel):
    """Body de `POST /api/v1/cases` — pedir autorización."""

    report: MedicalReportIn
    policy_number: str = Field(..., description="Número de la póliza del paciente.")
    scenario_key: str | None = Field(
        default=None,
        description="Override opcional para forzar un escenario en demos.",
    )


class ResolveCaseIn(CamelModel):
    """Body de `POST /api/v1/cases/{id}/resolve` — auditor cierra el caso."""

    outcome: Literal["APPROVED", "REJECTED"]
    message: str = Field(..., description="Mensaje humano final que verá el hospital.")
    reasoning: str = Field(..., description="Razonamiento del auditor (rationale).")


# ── Outputs ───────────────────────────────────────────────────────────────


class EvidenceOut(CamelModel):
    """Cita auditable que respalda la decisión."""

    source: EvidenceSource
    field: str
    quote: str


class DecisionOut(CamelModel):
    """Decisión emitida por el agente o el auditor."""

    outcome: Outcome
    rationale: str
    confidence: float
    decided_by: DecidedBy
    evidence: list[EvidenceOut] = Field(default_factory=list)
    missing_docs: list[str] = Field(default_factory=list)
    escalation_reason: EscalationReason | None = None
    model_used: str | None = None


class TraceStepOut(CamelModel):
    """Paso individual de la traza del agente."""

    node: str
    timestamp: datetime
    state: TraceStepState
    duration_ms: int | None = None
    model_used: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    detail: str | None = None
    error: str | None = None


class CaseLinks(CamelModel):
    """HATEOAS-lite — paths relativos para el cliente."""

    self_: str = Field(..., alias="self")
    trace: str
    resolve: str | None = None
    events: str


class CaseOut(CamelModel):
    """Caso de autorización — respuesta canónica del API."""

    id: str
    status: CaseStatus
    report_id: str
    policy_number: str
    decision: DecisionOut | None = None
    created_at: datetime
    decided_at: datetime | None = None
    links: CaseLinks = Field(..., alias="_links")


class CaseTraceOut(CamelModel):
    """Wrapper para `GET /api/v1/cases/{id}/trace`."""

    trace: list[TraceStepOut]


# ── Mappers (domain → DTO) ────────────────────────────────────────────────


def evidence_to_out(evidence: Evidence) -> EvidenceOut:
    """Domain `Evidence` → DTO `EvidenceOut`."""
    return EvidenceOut(source=evidence.source, field=evidence.field, quote=evidence.quote)


def decision_to_out(decision: AgentDecision) -> DecisionOut:
    """Domain `AgentDecision` → DTO `DecisionOut`."""
    return DecisionOut(
        outcome=decision.outcome,
        rationale=decision.rationale,
        confidence=decision.confidence,
        decided_by=decision.decided_by,
        evidence=[evidence_to_out(e) for e in decision.evidence],
        missing_docs=list(decision.missing_docs),
        escalation_reason=decision.escalation_reason,
        model_used=decision.model_used,
    )


def trace_step_to_out(step: TraceStep) -> TraceStepOut:
    """Domain `TraceStep` → DTO `TraceStepOut`."""
    return TraceStepOut(
        node=step.node,
        timestamp=step.timestamp,
        state=step.state,
        duration_ms=step.duration_ms,
        model_used=step.model_used,
        tokens_in=step.tokens_in,
        tokens_out=step.tokens_out,
        detail=step.detail,
        error=step.error,
    )


def _links_for(case: AuthorizationCase) -> CaseLinks:
    """Construye los paths relativos del caso. Endpoint base `/api/v1/cases`."""
    base = f"/api/v1/cases/{case.id}"
    return CaseLinks(
        self=base,
        trace=f"{base}/trace",
        resolve=(
            f"{base}/resolve"
            if case.status is CaseStatus.ESCALADO
            else None
        ),
        events=f"{base}/events",
    )


def case_to_out(case: AuthorizationCase) -> CaseOut:
    """Domain `AuthorizationCase` → DTO `CaseOut`."""
    return CaseOut(
        id=case.id,
        status=case.status,
        report_id=case.report_id,
        policy_number=case.policy_number,
        decision=decision_to_out(case.decision) if case.decision is not None else None,
        created_at=case.created_at,
        decided_at=case.decided_at,
        links=_links_for(case),
    )


def case_trace_to_out(case: AuthorizationCase) -> CaseTraceOut:
    """Wrapper de la traza completa para el endpoint `/trace`."""
    return CaseTraceOut(trace=[trace_step_to_out(s) for s in case.agent_trace])


# ── Inputs → domain (helpers) ─────────────────────────────────────────────


def medical_report_in_to_domain(
    report: MedicalReportIn,
    *,
    report_id: str,
    submitted_at: datetime,
) -> MedicalReport:
    """DTO `MedicalReportIn` → Domain `MedicalReport`.

    El `report_id` y `submitted_at` los provee el caller (use case orchestration
    a nivel router) para que el dominio NO dependa de uuid/now() acá.
    """
    return MedicalReport(
        id=report_id,
        patient_id=report.patient_id,
        format=report.format,
        content=report.content,
        submitted_at=submitted_at,
        procedure_solicited_hint=report.procedure_solicited_hint,
        diagnosis=report.diagnosis,
        attending_doctor=report.attending_doctor,
    )


__all__ = [
    "CaseLinks",
    "CaseOut",
    "CaseSubmitIn",
    "CaseTraceOut",
    "DecisionOut",
    "EvidenceOut",
    "MedicalReportIn",
    "ResolveCaseIn",
    "TraceStepOut",
    "case_to_out",
    "case_trace_to_out",
    "decision_to_out",
    "evidence_to_out",
    "medical_report_in_to_domain",
    "trace_step_to_out",
]
