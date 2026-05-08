"""GetDashboardMetricsUseCase — KPIs agregados para la vista de aseguradora.

Métricas (PRD §3.1.4 — vista Aseguradora):
- total: total de casos.
- auto_approved / docs_requested / escalated / decided: contadores por status.
- auto_approved_pct: % de aprobados automáticos sobre total (0.0 si total=0).
- avg_confidence: promedio de confidence de los casos con `decision != None`.
- avg_duration_ms: promedio del tiempo total que tarda el agente en procesar un
  caso. Se calcula sumando `duration_ms` de TODOS los TraceSteps de cada caso
  con traza no vacía y promediando entre esos casos. Refleja la latencia pura
  del agente (extracción + decisión + persistencia), sin incluir la red ni
  el frontend. 0 si ningún caso tiene traza.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pre_autorizacion.features.authorization_cases.domain.value_objects import CaseStatus

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.entities.authorization_case import (
        AuthorizationCase,
    )
    from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
        CaseRepository,
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


def _case_total_duration_ms(case: AuthorizationCase) -> int:
    """Suma `duration_ms` de todos los TraceSteps del caso (None → 0)."""
    return sum(step.duration_ms or 0 for step in case.agent_trace)


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

        # avg_confidence: solo casos con `decision` (no todos los casos), evita
        # diluir el promedio con casos pendientes sin decisión.
        decisions = [c.decision for c in cases if c.decision is not None]
        avg_confidence = (
            sum(d.confidence for d in decisions) / len(decisions) if decisions else 0.0
        )

        # avg_duration_ms: suma de `duration_ms` de los TraceSteps por caso,
        # promediada sobre los casos con traza no vacía. Es la duración real
        # del agente (no el delta `decided_at - created_at`, que en SQLite
        # puede ser ~0 cuando ambos timestamps se persisten en la misma
        # transacción).
        cases_with_trace_durations = [
            _case_total_duration_ms(c) for c in cases if c.agent_trace
        ]
        avg_duration_ms = (
            sum(cases_with_trace_durations) / len(cases_with_trace_durations)
            if cases_with_trace_durations
            else 0.0
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
