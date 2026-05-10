"""InMemoryProcedureRepository — fallback adapter (read + CRUD) seedeado con SEED_PROCEDURES."""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.procedures.domain import (
    ProcedureAlreadyExistsError,
    ProcedureNotFoundError,
)
from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
from pre_autorizacion.shared.domain.entities import Procedure
from pre_autorizacion.shared.fixtures import SEED_PROCEDURES


class InMemoryProcedureRepository(ProcedureRepository):
    """Repo in-memory del catálogo de procedimientos (PRD §4.2.2 DB Notion 3)."""

    def __init__(self, seed: Iterable[Procedure] = SEED_PROCEDURES) -> None:
        self._procedures: dict[str, Procedure] = {p.code: p for p in seed}

    async def list(self) -> tuple[Procedure, ...]:
        return tuple(self._procedures.values())

    async def search(self, query: str) -> tuple[Procedure, ...]:
        q = query.strip().lower()
        return tuple(
            p for p in self._procedures.values()
            if q in p.code.lower() or q in p.name.lower()
        )

    async def find_by_code(self, code: str) -> Procedure | None:
        return self._procedures.get(code)

    async def create(self, procedure: Procedure) -> Procedure:
        if procedure.code in self._procedures:
            raise ProcedureAlreadyExistsError(
                f"Procedure already exists: {procedure.code!r}"
            )
        self._procedures[procedure.code] = procedure
        return procedure

    async def update(self, procedure: Procedure) -> Procedure:
        if procedure.code not in self._procedures:
            raise ProcedureNotFoundError(f"No procedure: {procedure.code!r}")
        self._procedures[procedure.code] = procedure
        return procedure

    async def delete(self, code: str) -> None:
        self._procedures.pop(code, None)
