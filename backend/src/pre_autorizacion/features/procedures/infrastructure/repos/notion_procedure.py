"""NotionProcedureRepository — adapter de `ProcedureRepository` sobre Notion API.

Opera sobre la **DB Notion 3: Procedimientos** (PRD §4.2.2). Schema esperado:

- `CodigoCIE10`        (title)      — código CIE-10 (ej: ``"K80.20"``)
- `Nombre`             (rich_text)  — nombre del procedimiento
- `Categoria`          (select)     — opcional, categoría clínica
- `Descripcion`        (rich_text)  — opcional, descripción larga
- `DiasCarenciaTipico` (number)     — opcional, carencia default del catálogo

Nota: los nombres de property se mantienen en ASCII (sin tildes) para
robustez ante teclados/configuraciones del operador. Si el operador renombra
columnas en Notion, alinear con `shared/notion/entities.py::notion_to_procedure`.

`search` filtra **client-side**. Notion API no tiene OR sobre dos
properties distintas en un solo filter; hacer dos queries y dedupar
es más caro que tirar `list` y filtrar en memoria para un catálogo chico.
"""

from __future__ import annotations

from typing import Any

from pre_autorizacion.features.procedures.domain import (
    ProcedureAlreadyExistsError,
    ProcedureNotFoundError,
)
from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
from pre_autorizacion.shared.domain.entities import Procedure
from pre_autorizacion.shared.notion import NotionClient
from pre_autorizacion.shared.notion.entities import (
    notion_to_procedure,
    procedure_to_notion_props,
)
from pre_autorizacion.shared.notion.errors import NotionRequestError


class NotionProcedureRepository(ProcedureRepository):
    """Adapter Notion del catálogo de procedimientos (read + CRUD)."""

    def __init__(self, notion_client: NotionClient, database_id: str) -> None:
        self._client = notion_client
        self._database_id = database_id

    async def list(self) -> tuple[Procedure, ...]:
        pages = await self._client.query_database(self._database_id)
        return tuple(notion_to_procedure(page) for page in pages)

    async def search(self, query: str) -> tuple[Procedure, ...]:
        # Filtrado client-side por substring case-insensitive en code o name
        # (mismo contrato que `InMemoryProcedureRepository`).
        q = query.strip().lower()
        return tuple(
            p for p in await self.list()
            if q in p.code.lower() or q in p.name.lower()
        )

    async def find_by_code(self, code: str) -> Procedure | None:
        page = await self._find_page_by_code(code)
        return notion_to_procedure(page) if page is not None else None

    async def create(self, procedure: Procedure) -> Procedure:
        if await self._find_page_by_code(procedure.code) is not None:
            raise ProcedureAlreadyExistsError(
                f"Procedure already exists: {procedure.code!r}"
            )
        props = procedure_to_notion_props(procedure)
        await self._client.create_page(self._database_id, props)
        created = await self.find_by_code(procedure.code)
        if created is None:
            raise NotionRequestError(
                f"Procedure create succeeded but query by CodigoCIE10 returned empty: "
                f"{procedure.code!r}",
            )
        return created

    async def update(self, procedure: Procedure) -> Procedure:
        page = await self._find_page_by_code(procedure.code)
        if page is None:
            raise ProcedureNotFoundError(f"No procedure: {procedure.code!r}")
        page_id = page.get("id")
        if not isinstance(page_id, str):
            raise NotionRequestError(
                f"Procedure page for {procedure.code!r} missing string id.",
            )
        await self._client.update_page(page_id, procedure_to_notion_props(procedure))
        updated = await self.find_by_code(procedure.code)
        if updated is None:
            raise NotionRequestError(
                f"Procedure update succeeded but lookup returned empty: "
                f"{procedure.code!r}",
            )
        return updated

    async def delete(self, code: str) -> None:
        page = await self._find_page_by_code(code)
        if page is None:
            # Idempotente: borrar lo que no existe es no-op.
            return
        page_id = page.get("id")
        if not isinstance(page_id, str):
            raise NotionRequestError(
                f"Procedure page for {code!r} missing string id.",
            )
        await self._client.archive_page(page_id)

    async def _find_page_by_code(self, code: str) -> dict[str, Any] | None:
        # `CodigoCIE10` es la property `title` de la DB Procedimientos.
        filter_: dict[str, Any] = {
            "property": "CodigoCIE10",
            "title": {"equals": code},
        }
        pages = await self._client.query_database(self._database_id, filter=filter_)
        if not pages:
            return None
        return pages[0]
