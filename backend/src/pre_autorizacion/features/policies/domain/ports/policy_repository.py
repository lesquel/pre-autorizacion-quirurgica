"""PolicyRepository — port para pólizas (read + CRUD)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.features.policies.domain.entities import Policy


class PolicyRepository(ABC):
    @abstractmethod
    async def list(self) -> tuple[Policy, ...]: ...

    @abstractmethod
    async def find_by_number(self, n: str) -> Policy | None: ...

    @abstractmethod
    async def create(self, policy: Policy) -> Policy:
        """Persist a new policy. Raises if `policy.number` already exists."""

    @abstractmethod
    async def update(self, policy: Policy) -> Policy:
        """Replace the policy identified by `policy.number`. Raises if missing."""

    @abstractmethod
    async def delete(self, number: str) -> None:
        """Remove the policy by number. No-op if it doesn't exist (idempotent)."""
