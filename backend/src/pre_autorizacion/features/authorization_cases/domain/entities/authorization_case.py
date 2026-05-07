"""AuthorizationCase — agregado central del dominio.
PRD §4.2.2 (DB Notion 7: CasosAutorización).

Port directo de
`frontend/src/app/features/authorization-cases/domain/entities/authorization-case.ts`.

Decisiones de mapping TS → Python:
- `agentTrace: readonly TraceStep[]`  → `agent_trace: tuple[TraceStep, ...]`.
- `decision?: AgentDecision`          → `decision: AgentDecision | None`.
- `createdAt: string` (ISO)           → `created_at: datetime`.
- `decidedAt?: string`                → `decided_at: datetime | None`.

`status`, `decision` y `agent_trace` se actualizan generando una NUEVA instancia
(`dataclasses.replace(case, status=...)`). El dominio NO muta — la mutabilidad
vive sólo en la capa de persistencia (repos).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from pre_autorizacion.features.authorization_cases.domain.value_objects.agent_decision import (
    AgentDecision,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.case_status import (
    CaseStatus,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.trace_step import TraceStep


@dataclass(frozen=True, slots=True)
class AuthorizationCase:
    """AuthorizationCase — agregado raíz inmutable del caso de autorización."""

    id: str
    report_id: str
    policy_number: str
    status: CaseStatus
    created_at: datetime
    decision: AgentDecision | None = None
    agent_trace: tuple[TraceStep, ...] = field(default_factory=tuple)
    decided_at: datetime | None = None
