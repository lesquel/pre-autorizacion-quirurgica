"""DeletePolicyUseCase — baja de póliza por número."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.ports import PolicyRepository


@dataclass(slots=True)
class DeletePolicyUseCase:
    policy_repository: PolicyRepository

    async def execute(self, number: str) -> None:
        await self.policy_repository.delete(number)
