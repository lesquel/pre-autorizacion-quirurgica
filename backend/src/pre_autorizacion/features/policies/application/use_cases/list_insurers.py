"""ListInsurersUseCase — listado del catálogo de aseguradoras."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Insurer
    from pre_autorizacion.features.policies.domain.ports import InsurerRepository


@dataclass(slots=True)
class ListInsurersUseCase:
    """Lista todas las aseguradoras conocidas."""

    insurer_repository: InsurerRepository

    async def execute(self) -> tuple[Insurer, ...]:
        """Delega al repo."""
        return await self.insurer_repository.list()
