"""UpdateProcedureUseCase — edición de procedimiento por código CIE-10."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
    from pre_autorizacion.shared.domain.entities import Procedure


@dataclass(slots=True)
class UpdateProcedureUseCase:
    procedure_repository: ProcedureRepository

    async def execute(self, procedure: Procedure) -> Procedure:
        return await self.procedure_repository.update(procedure)
