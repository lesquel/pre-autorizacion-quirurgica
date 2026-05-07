"""ReplacePolicyCoveragesUseCase — bulk replace de coberturas para una póliza."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Coverage
    from pre_autorizacion.features.policies.domain.ports import CoverageRepository


@dataclass(slots=True)
class ReplacePolicyCoveragesUseCase:
    coverage_repository: CoverageRepository

    async def execute(
        self,
        policy_number: str,
        coverages: tuple[Coverage, ...],
    ) -> tuple[Coverage, ...]:
        return await self.coverage_repository.replace_for_policy(policy_number, coverages)
