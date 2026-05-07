"""InMemoryCaseRepository — adapter fallback de `CaseRepository`.

Cuando no hay credenciales de Notion, este adapter sostiene el demo end-to-end
con los `INITIAL_CASES` portados del frontend. State interno: dict ordenado
por id, `asyncio.Lock` para concurrent access (la API es async y FastAPI
puede tener varios handlers golpeando el repo).

`update()` aplica `dataclasses.replace` para preservar la inmutabilidad del
agregado: NO mutamos in-place — creamos una nueva instancia y la indexamos.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable
from dataclasses import replace
from datetime import datetime

from pre_autorizacion.features.authorization_cases.domain.entities.authorization_case import (
    AuthorizationCase,
)
from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
    CaseRepository,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.agent_decision import (
    AgentDecision,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.case_status import (
    CaseStatus,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.trace_step import TraceStep
from pre_autorizacion.shared.fixtures import INITIAL_CASES


class InMemoryCaseRepository(CaseRepository):
    """Repo de casos in-memory para demo / tests / fallback sin Notion."""

    def __init__(self, seed: Iterable[AuthorizationCase] = INITIAL_CASES) -> None:
        self._cases: dict[str, AuthorizationCase] = {c.id: c for c in seed}
        self._lock = asyncio.Lock()

    async def list(self) -> tuple[AuthorizationCase, ...]:
        async with self._lock:
            # Snapshot consistente: copiamos la vista del dict bajo el lock.
            return tuple(self._cases.values())

    async def find_by_id(self, case_id: str) -> AuthorizationCase | None:
        async with self._lock:
            return self._cases.get(case_id)

    async def create(self, case: AuthorizationCase) -> None:
        async with self._lock:
            # Contract: el caller (use case) garantiza id único; igual no
            # rompemos si ya existe — overwrite silencioso. El test del
            # caller debería detectar duplicados antes de llegar acá.
            self._cases[case.id] = case

    async def update(
        self,
        case_id: str,
        *,
        status: CaseStatus | None = None,
        decision: AgentDecision | None = None,
        agent_trace: tuple[TraceStep, ...] | None = None,
        decided_at: datetime | None = None,
    ) -> None:
        async with self._lock:
            existing = self._cases.get(case_id)
            if existing is None:
                # Idempotencia: NO levantamos. Mismo contrato que el front.
                return
            updated = existing
            if status is not None:
                updated = replace(updated, status=status)
            if decision is not None:
                updated = replace(updated, decision=decision)
            if agent_trace is not None:
                updated = replace(updated, agent_trace=agent_trace)
            if decided_at is not None:
                updated = replace(updated, decided_at=decided_at)
            if updated is existing:
                return
            self._cases[case_id] = updated
