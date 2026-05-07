"""CoverageRepository — port read-only de coberturas (póliza × procedimiento).

Port directo de `frontend/src/app/features/policies/domain/ports/coverage-repository.port.ts`.

`list_for_policy` es el query más usado por el agente y por la vista de Aseguradora
(ver coberturas filtradas por póliza seleccionada).

Mismo razonamiento que `PolicyRepository` para `async`: el adapter real es Notion
(HTTP I/O); en in-memory cuesta cero hacerlo async.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.features.policies.domain.entities import Coverage


class CoverageRepository(ABC):
    """Port read-only para coberturas. Adapter típico → Notion."""

    @abstractmethod
    async def list(self) -> tuple[Coverage, ...]:
        """Lista todas las coberturas conocidas."""

    @abstractmethod
    async def list_for_policy(self, policy_number: str) -> tuple[Coverage, ...]:
        """Lista las coberturas asociadas a la póliza `policy_number`."""

    @abstractmethod
    async def replace_for_policy(
        self,
        policy_number: str,
        coverages: tuple[Coverage, ...],
    ) -> tuple[Coverage, ...]:
        """Atomically replace the full coverage set for `policy_number`."""
