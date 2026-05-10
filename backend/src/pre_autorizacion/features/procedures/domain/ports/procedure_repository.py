"""ProcedureRepository — port del catálogo de procedimientos (read + CRUD)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.shared.domain.entities import Procedure


class ProcedureRepository(ABC):
    """Port del catálogo de procedimientos. Adapter típico → Notion / InMemory."""

    @abstractmethod
    async def list(self) -> tuple[Procedure, ...]:
        """Lista el catálogo completo."""

    @abstractmethod
    async def search(self, query: str) -> tuple[Procedure, ...]:
        """Filtra por substring case-insensitive en `code` o `name`.

        Contrato: el caller (use case) DEBE garantizar que `query` no sea
        vacío ni solo whitespace. Los adapters NO están obligados a manejar
        ese caso — invocar con blank es comportamiento indefinido.
        """

    @abstractmethod
    async def find_by_code(self, code: str) -> Procedure | None:
        """Devuelve el procedimiento con `code` o `None` si no existe."""

    @abstractmethod
    async def create(self, procedure: Procedure) -> Procedure:
        """Persist a new procedure. Raises if `procedure.code` already exists."""

    @abstractmethod
    async def update(self, procedure: Procedure) -> Procedure:
        """Replace the procedure identified by `procedure.code`. Raises if missing."""

    @abstractmethod
    async def delete(self, code: str) -> None:
        """Remove the procedure by code. No-op if it doesn't exist (idempotent)."""
