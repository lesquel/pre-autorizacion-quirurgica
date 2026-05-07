"""InMemoryPolicyRepository — fallback adapter (read + CRUD) seedeado con SEED_POLICIES."""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.policies.domain.entities import Policy
from pre_autorizacion.features.policies.domain.ports import PolicyRepository
from pre_autorizacion.shared.domain.errors import NotFoundError
from pre_autorizacion.shared.fixtures import SEED_POLICIES


class PolicyAlreadyExistsError(Exception):
    """Raised when create() is called with a number that already exists."""


class PolicyNotFoundError(NotFoundError):
    title = "Policy not found"


class InMemoryPolicyRepository(PolicyRepository):
    def __init__(self, seed: Iterable[Policy] = SEED_POLICIES) -> None:
        self._policies: dict[str, Policy] = {p.number: p for p in seed}

    async def list(self) -> tuple[Policy, ...]:
        return tuple(self._policies.values())

    async def find_by_number(self, n: str) -> Policy | None:
        return self._policies.get(n)

    async def create(self, policy: Policy) -> Policy:
        if policy.number in self._policies:
            raise PolicyAlreadyExistsError(f"Policy already exists: {policy.number!r}")
        self._policies[policy.number] = policy
        return policy

    async def update(self, policy: Policy) -> Policy:
        if policy.number not in self._policies:
            raise PolicyNotFoundError(f"No policy: {policy.number!r}")
        self._policies[policy.number] = policy
        return policy

    async def delete(self, number: str) -> None:
        self._policies.pop(number, None)
