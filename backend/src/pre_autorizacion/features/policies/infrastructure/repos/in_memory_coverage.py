"""InMemoryCoverageRepository — adapter fallback de `CoverageRepository`."""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.policies.domain.entities import Coverage
from pre_autorizacion.features.policies.domain.ports import CoverageRepository
from pre_autorizacion.shared.fixtures import SEED_COVERAGES


class InMemoryCoverageRepository(CoverageRepository):
    """Repo de coberturas in-memory para demo / tests / fallback sin Notion."""

    def __init__(self, seed: Iterable[Coverage] = SEED_COVERAGES) -> None:
        self._coverages: tuple[Coverage, ...] = tuple(seed)

    async def list(self) -> tuple[Coverage, ...]:
        return self._coverages

    async def list_for_policy(self, policy_number: str) -> tuple[Coverage, ...]:
        return tuple(c for c in self._coverages if c.policy_number == policy_number)

    async def replace_for_policy(
        self,
        policy_number: str,
        coverages: tuple[Coverage, ...],
    ) -> tuple[Coverage, ...]:
        # Drop existing entries for this policy, then append the new set.
        kept = tuple(c for c in self._coverages if c.policy_number != policy_number)
        new = tuple(c for c in coverages if c.policy_number == policy_number)
        self._coverages = kept + new
        return new
