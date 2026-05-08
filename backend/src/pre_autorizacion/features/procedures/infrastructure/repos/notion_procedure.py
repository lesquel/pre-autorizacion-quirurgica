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

from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
from pre_autorizacion.shared.domain.entities import Procedure
from pre_autorizacion.shared.notion import NotionClient
from pre_autorizacion.shared.notion.entities import notion_to_procedure


class NotionProcedureRepository(ProcedureRepository):
    """Adapter Notion del catálogo de procedimientos (read-only)."""

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
