"""InMemoryProcedureRepository — fallback adapter, seeded con `SEED_PROCEDURES`.

`async def` aunque internamente sea sincrónico: respeta el port y permite
swap transparente con el adapter Notion (que sí hace HTTP I/O).
"""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
from pre_autorizacion.shared.domain.entities import Procedure
from pre_autorizacion.shared.fixtures import SEED_PROCEDURES


class InMemoryProcedureRepository(ProcedureRepository):
    """Repo in-memory del catálogo de procedimientos (PRD §4.2.2 DB Notion 3)."""

    def __init__(self, seed: Iterable[Procedure] = SEED_PROCEDURES) -> None:
        self._procedures: tuple[Procedure, ...] = tuple(seed)

    async def list(self) -> tuple[Procedure, ...]:
        return self._procedures

    async def search(self, query: str) -> tuple[Procedure, ...]:
        q = query.strip().lower()
        return tuple(
            p for p in self._procedures
            if q in p.code.lower() or q in p.name.lower()
        )
