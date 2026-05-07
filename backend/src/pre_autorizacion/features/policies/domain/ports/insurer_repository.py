"""InsurerRepository — port read-only del catálogo de aseguradoras.

Port directo de `frontend/src/app/features/policies/domain/ports/insurer-repository.port.ts`.

En el MVP hay una única aseguradora (`INS-ANDINA`), pero modelamos el catálogo
como repositorio para no quemar el id en código y soportar multi-tenant futuro.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.features.policies.domain.entities import Insurer


class InsurerRepository(ABC):
    """Port read-only para aseguradoras."""

    @abstractmethod
    async def list(self) -> tuple[Insurer, ...]:
        """Lista todas las aseguradoras conocidas."""

    @abstractmethod
    async def find_by_id(self, id: str) -> Insurer | None:
        """Busca una aseguradora por su `id`; devuelve `None` si no existe."""
