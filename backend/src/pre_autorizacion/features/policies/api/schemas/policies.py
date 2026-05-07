"""Pydantic schemas (DTOs) del feature `policies` — capa API.

Todos los schemas heredan de `CamelModel` (camelCase wire format).

Mappers en este módulo: `policy_to_out`, `coverage_to_out`, `insurer_to_out`,
`metrics_to_out` — convierten entidades de dominio a DTOs API.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import Field

from pre_autorizacion.features.policies.application.use_cases.get_dashboard_metrics import (
    DashboardMetrics,
)
from pre_autorizacion.features.policies.domain.entities import (
    Coverage,
    Insurer,
    Policy,
    PolicyStatus,
)
from pre_autorizacion.shared.api.schemas import CamelModel


# ── Outputs ───────────────────────────────────────────────────────────────


class PolicyOut(CamelModel):
    """Póliza — DTO de salida."""

    number: str
    patient_id: str
    plan: str
    insurer_id: str
    start_date: date
    end_date: date
    status: PolicyStatus


class CoverageOut(CamelModel):
    """Cobertura — DTO de salida.

    `copay` se serializa como `Decimal` → string en JSON (Pydantic v2 default
    para `Decimal`); el frontend ya lo parsea como string monetaria.
    """

    policy_number: str
    procedure_code: str
    covered: bool
    waiting_days: int
    copay: Decimal
    required_docs: list[str] = Field(default_factory=list)


class InsurerOut(CamelModel):
    """Aseguradora — DTO de salida."""

    id: str
    name: str
    email: str | None = None


class DashboardMetricsOut(CamelModel):
    """KPIs agregados — DTO de salida para `GET /api/v1/dashboard/metrics`."""

    total: int
    auto_approved: int
    docs_requested: int
    escalated: int
    decided: int
    auto_approved_pct: float
    avg_confidence: float
    avg_duration_ms: float


# ── Mappers (domain → DTO) ────────────────────────────────────────────────


def policy_to_out(policy: Policy) -> PolicyOut:
    """Domain `Policy` → DTO `PolicyOut`."""
    return PolicyOut(
        number=policy.number,
        patient_id=policy.patient_id,
        plan=policy.plan,
        insurer_id=policy.insurer_id,
        start_date=policy.start_date,
        end_date=policy.end_date,
        status=policy.status,
    )


def coverage_to_out(coverage: Coverage) -> CoverageOut:
    """Domain `Coverage` → DTO `CoverageOut`."""
    return CoverageOut(
        policy_number=coverage.policy_number,
        procedure_code=coverage.procedure_code,
        covered=coverage.covered,
        waiting_days=coverage.waiting_days,
        copay=coverage.copay,
        required_docs=list(coverage.required_docs),
    )


def insurer_to_out(insurer: Insurer) -> InsurerOut:
    """Domain `Insurer` → DTO `InsurerOut`."""
    return InsurerOut(id=insurer.id, name=insurer.name, email=insurer.email)


def metrics_to_out(metrics: DashboardMetrics) -> DashboardMetricsOut:
    """Domain `DashboardMetrics` → DTO `DashboardMetricsOut`."""
    return DashboardMetricsOut(
        total=metrics.total,
        auto_approved=metrics.auto_approved,
        docs_requested=metrics.docs_requested,
        escalated=metrics.escalated,
        decided=metrics.decided,
        auto_approved_pct=metrics.auto_approved_pct,
        avg_confidence=metrics.avg_confidence,
        avg_duration_ms=metrics.avg_duration_ms,
    )


# ── Inputs ────────────────────────────────────────────────────────────────


class PolicyIn(CamelModel):
    """Body de POST/PUT /policies."""

    number: str
    patient_id: str
    plan: str
    insurer_id: str
    start_date: date
    end_date: date
    status: PolicyStatus


class CoverageIn(CamelModel):
    """Item de PUT /policies/{number}/coverages."""

    policy_number: str
    procedure_code: str
    covered: bool
    waiting_days: int
    copay: Decimal
    required_docs: list[str] = Field(default_factory=list)


# ── Mappers (DTO → domain) ────────────────────────────────────────────────


def policy_in_to_domain(body: PolicyIn) -> Policy:
    return Policy(
        number=body.number,
        patient_id=body.patient_id,
        plan=body.plan,
        insurer_id=body.insurer_id,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
    )


def coverage_in_to_domain(body: CoverageIn) -> Coverage:
    return Coverage(
        policy_number=body.policy_number,
        procedure_code=body.procedure_code,
        covered=body.covered,
        waiting_days=body.waiting_days,
        copay=body.copay,
        required_docs=tuple(body.required_docs),
    )


__all__ = [
    "CoverageIn",
    "CoverageOut",
    "DashboardMetricsOut",
    "InsurerOut",
    "PolicyIn",
    "PolicyOut",
    "coverage_in_to_domain",
    "coverage_to_out",
    "insurer_to_out",
    "metrics_to_out",
    "policy_in_to_domain",
    "policy_to_out",
]
