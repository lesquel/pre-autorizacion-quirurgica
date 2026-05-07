"""CaseRepository — port de persistencia de `AuthorizationCase`.

Port adaptado de `frontend/src/app/features/authorization-cases/domain/ports/case-repository.port.ts`.

Decisiones de mapping TS → Python:
- TS expone `cases: Signal<readonly AuthorizationCase[]>` para reactividad de
  Angular. En el back NO existe ese concepto — la reactividad la maneja SSE.
  El back expone simplemente `list()` async.
- TS tiene `update(id, patch: Partial<AuthorizationCase>)`. En Python preferimos
  un `update` tipado con campos opcionales explícitos (status, decision,
  agent_trace, decided_at) — más claro, autocompletable, y mypy verifica que
  el caller no pase un campo arbitrario.
- Adapter típico → Notion (DB Notion 7: CasosAutorización, PRD §4.2.2). Por eso
  toda la API es `async`.
- Idempotencia: `update` sobre un id inexistente es no-op (mismo contrato que
  el front).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Forward references — entidades / value objects creados en paralelo.
    from pre_autorizacion.features.authorization_cases.domain.entities import (
        AuthorizationCase,
    )
    from pre_autorizacion.features.authorization_cases.domain.value_objects import (
        AgentDecision,
        CaseStatus,
        TraceStep,
    )


class CaseRepository(ABC):
    """Port de persistencia de `AuthorizationCase`. Adapter típico → Notion."""

    @abstractmethod
    async def list(self) -> tuple[AuthorizationCase, ...]:
        """Lista todos los casos conocidos."""

    @abstractmethod
    async def find_by_id(self, case_id: str) -> AuthorizationCase | None:
        """Busca un caso por id; devuelve `None` si no existe."""

    @abstractmethod
    async def create(self, case: AuthorizationCase) -> None:
        """Persiste un caso nuevo.

        El caller (use case) garantiza id único; el adapter NO valida duplicados.
        """

    @abstractmethod
    async def update(
        self,
        case_id: str,
        *,
        status: CaseStatus | None = None,
        decision: AgentDecision | None = None,
        agent_trace: tuple[TraceStep, ...] | None = None,
        decided_at: datetime | None = None,
    ) -> None:
        """Actualiza inmutablemente los campos provistos del caso `case_id`.

        Sólo se aplican los campos no-`None`. Los demás se preservan.
        Si `case_id` no existe, la operación es no-op (no levanta excepción).

        Args:
            case_id:     identificador del caso.
            status:      nuevo `CaseStatus` (PENDIENTE → APROBADO_AUTO / ...).
            decision:    `AgentDecision` final (cuando el agente o el auditor
                         resolvieron).
            agent_trace: traza completa del agente (todos los `TraceStep`).
            decided_at:  timestamp de cierre (cuando el caso se vuelve terminal).
        """
