"""InMemoryInsurerRepository — adapter fallback de `InsurerRepository`."""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.policies.domain.entities import Insurer
from pre_autorizacion.features.policies.domain.ports import InsurerRepository
from pre_autorizacion.shared.fixtures import SEED_INSURERS


class InMemoryInsurerRepository(InsurerRepository):
    """Repo de aseguradoras in-memory para demo / tests / fallback sin Notion."""

    def __init__(self, seed: Iterable[Insurer] = SEED_INSURERS) -> None:
        self._insurers: tuple[Insurer, ...] = tuple(seed)

    async def list(self) -> tuple[Insurer, ...]:
        return self._insurers

    async def find_by_id(self, id: str) -> Insurer | None:
        for i in self._insurers:
            if i.id == id:
                return i
        return None
