"""CreatePolicyUseCase — alta de póliza."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Policy
    from pre_autorizacion.features.policies.domain.ports import PolicyRepository


@dataclass(slots=True)
class CreatePolicyUseCase:
    policy_repository: PolicyRepository

    async def execute(self, policy: Policy) -> Policy:
        return await self.policy_repository.create(policy)
