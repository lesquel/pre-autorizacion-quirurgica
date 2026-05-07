"""GetPolicyUseCase — fetch puntual de una póliza por número."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pre_autorizacion.shared.domain.errors import NotFoundError

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Policy
    from pre_autorizacion.features.policies.domain.ports import PolicyRepository


class PolicyNotFoundError(NotFoundError):
    """No existe una póliza con ese número."""

    title = "Policy not found"


@dataclass(slots=True)
class GetPolicyUseCase:
    """Devuelve una póliza por `number`; raise `PolicyNotFoundError` si no existe."""

    policy_repository: PolicyRepository

    async def execute(self, number: str) -> Policy:
        """Busca y devuelve la póliza."""
        policy = await self.policy_repository.find_by_number(number)
        if policy is None:
            raise PolicyNotFoundError(f"No policy found for number={number!r}")
        return policy
