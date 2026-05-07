"""InMemoryPolicyRepository — adapter fallback de `PolicyRepository`.

Se usa cuando NO hay credenciales de Notion (`NOTION_TOKEN` ausente) — la DI
elige este adapter automáticamente. Mismo contrato que `NotionPolicyRepository`,
zero dependencias de red, datos seedeados desde `shared.fixtures.seed`.

`async def` aunque internamente sea sincrónico: respeta el port y permite
swap transparente con el adapter Notion (que sí hace HTTP I/O).
"""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.policies.domain.entities import Policy
from pre_autorizacion.features.policies.domain.ports import PolicyRepository
from pre_autorizacion.shared.fixtures import SEED_POLICIES


class InMemoryPolicyRepository(PolicyRepository):
    """Repo de pólizas in-memory para demo / tests / fallback sin Notion."""

    def __init__(self, seed: Iterable[Policy] = SEED_POLICIES) -> None:
        # `tuple` para reforzar inmutabilidad y evitar mutación accidental
        # del estado interno por consumidores.
        self._policies: tuple[Policy, ...] = tuple(seed)

    async def list(self) -> tuple[Policy, ...]:
        return self._policies

    async def find_by_number(self, n: str) -> Policy | None:
        for p in self._policies:
            if p.number == n:
                return p
        return None
