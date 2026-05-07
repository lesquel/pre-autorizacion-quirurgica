"""ListPoliciesUseCase — listado read-only del catálogo de pólizas."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Policy
    from pre_autorizacion.features.policies.domain.ports import PolicyRepository


@dataclass(slots=True)
class ListPoliciesUseCase:
    """Lista todas las pólizas conocidas."""

    policy_repository: PolicyRepository

    async def execute(self) -> tuple[Policy, ...]:
        """Devuelve las pólizas tal cual las expone el repo."""
        return await self.policy_repository.list()
