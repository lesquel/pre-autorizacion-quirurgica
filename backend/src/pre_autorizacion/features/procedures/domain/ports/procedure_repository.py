"""ProcedureRepository — port read-only del catálogo de procedimientos."""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.shared.domain.entities import Procedure


class ProcedureRepository(ABC):
    """Port read-only para el catálogo de procedimientos. Adapter típico → Notion."""

    @abstractmethod
    async def list(self) -> tuple[Procedure, ...]:
        """Lista el catálogo completo."""

    @abstractmethod
    async def search(self, query: str) -> tuple[Procedure, ...]:
        """Filtra por substring case-insensitive en `code` o `name`."""
