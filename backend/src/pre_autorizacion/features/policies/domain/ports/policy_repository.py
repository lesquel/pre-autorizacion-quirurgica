"""PolicyRepository — port read-only de pólizas.

Port directo de `frontend/src/app/features/policies/domain/ports/policy-repository.port.ts`.

Decisiones de mapping TS → Python:
- `list()`/`findByNumber()` síncronos en el front (in-memory signal). En el back
  se modelan **async** porque el adapter real es Notion (HTTP I/O). En in-memory
  el adapter simplemente devuelve el resultado con `async def` (zero overhead).
- `readonly Policy[]` → `tuple[Policy, ...]` (tuple inmutable, hashable).
- `Policy | undefined` → `Policy | None`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.features.policies.domain.entities import Policy


class PolicyRepository(ABC):
    """Port read-only para pólizas. Adapter típico → Notion."""

    @abstractmethod
    async def list(self) -> tuple[Policy, ...]:
        """Lista todas las pólizas conocidas."""

    @abstractmethod
    async def find_by_number(self, n: str) -> Policy | None:
        """Busca una póliza por su `number`; devuelve `None` si no existe."""
