"""DeleteProcedureUseCase — baja de procedimiento por código CIE-10."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository


@dataclass(slots=True)
class DeleteProcedureUseCase:
    procedure_repository: ProcedureRepository

    async def execute(self, code: str) -> None:
        await self.procedure_repository.delete(code)
