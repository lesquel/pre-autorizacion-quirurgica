"""ListProceduresUseCase — listar / buscar procedimientos."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
    from pre_autorizacion.shared.domain.entities import Procedure


@dataclass(slots=True)
class ListProceduresUseCase:
    procedure_repository: ProcedureRepository

    async def execute(self, query: str | None = None) -> tuple[Procedure, ...]:
        if query is None or not query.strip():
            return await self.procedure_repository.list()
        return await self.procedure_repository.search(query)
