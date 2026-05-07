"""GetDashboardMetricsUseCase — KPIs agregados para la vista de aseguradora.

Métricas (PRD §3.1.4 — vista Aseguradora):
- total: total de casos.
- auto_approved / docs_requested / escalated / decided: contadores por status.
- auto_approved_pct: % de aprobados automáticos sobre total (0.0 si total=0).
- avg_confidence: promedio de confidence de los casos con `decision != None`.
- avg_duration_ms: promedio de duración (decided_at - created_at) en milisegundos
  de los casos terminales (status DECIDIDO/APROBADO_AUTO/DOCS_PEDIDOS), 0 si no
  hay casos terminales.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pre_autorizacion.features.authorization_cases.domain.value_objects import CaseStatus

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
        CaseRepository,
    )


_TERMINAL_STATUSES: frozenset[CaseStatus] = frozenset(
    {CaseStatus.APROBADO_AUTO, CaseStatus.DOCS_PEDIDOS, CaseStatus.DECIDIDO}
)


@dataclass(frozen=True, slots=True)
class DashboardMetrics:
    """KPIs agregados para la vista de aseguradora."""

    total: int
    auto_approved: int
    docs_requested: int
    escalated: int
    decided: int
    auto_approved_pct: float
    avg_confidence: float
    avg_duration_ms: float


@dataclass(slots=True)
class GetDashboardMetricsUseCase:
    """Calcula métricas agregadas leyendo todos los casos del repo."""

    case_repository: CaseRepository

    async def execute(self) -> DashboardMetrics:
        """Devuelve las métricas agregadas."""
        cases = await self.case_repository.list()
        total = len(cases)

        auto_approved = sum(1 for c in cases if c.status is CaseStatus.APROBADO_AUTO)
        docs_requested = sum(1 for c in cases if c.status is CaseStatus.DOCS_PEDIDOS)
        escalated = sum(1 for c in cases if c.status is CaseStatus.ESCALADO)
        decided = sum(1 for c in cases if c.status is CaseStatus.DECIDIDO)

        auto_approved_pct = (auto_approved / total) if total > 0 else 0.0

        decisions = [c.decision for c in cases if c.decision is not None]
        avg_confidence = (
            sum(d.confidence for d in decisions) / len(decisions) if decisions else 0.0
        )

        durations_ms = [
            (c.decided_at - c.created_at).total_seconds() * 1000.0
            for c in cases
            if c.status in _TERMINAL_STATUSES and c.decided_at is not None
        ]
        avg_duration_ms = (
            sum(durations_ms) / len(durations_ms) if durations_ms else 0.0
        )

        return DashboardMetrics(
            total=total,
            auto_approved=auto_approved,
            docs_requested=docs_requested,
            escalated=escalated,
            decided=decided,
            auto_approved_pct=auto_approved_pct,
            avg_confidence=avg_confidence,
            avg_duration_ms=avg_duration_ms,
        )
