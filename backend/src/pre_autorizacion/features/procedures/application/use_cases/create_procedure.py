"""CreateProcedureUseCase — alta de procedimiento del catálogo."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
    from pre_autorizacion.shared.domain.entities import Procedure


@dataclass(slots=True)
class CreateProcedureUseCase:
    procedure_repository: ProcedureRepository

    async def execute(self, procedure: Procedure) -> Procedure:
        return await self.procedure_repository.create(procedure)
