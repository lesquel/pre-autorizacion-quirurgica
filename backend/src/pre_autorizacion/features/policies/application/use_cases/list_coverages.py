"""ListCoveragesUseCase — listado de coberturas, opcionalmente filtrado por póliza."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Coverage
    from pre_autorizacion.features.policies.domain.ports import CoverageRepository


@dataclass(slots=True)
class ListCoveragesUseCase:
    """Lista coberturas (todas o filtradas por número de póliza)."""

    coverage_repository: CoverageRepository

    async def execute(self, policy_number: str | None = None) -> tuple[Coverage, ...]:
        """Si `policy_number` es `None` → todas; si no → solo las de esa póliza."""
        if policy_number is None:
            return await self.coverage_repository.list()
        return await self.coverage_repository.list_for_policy(policy_number)
