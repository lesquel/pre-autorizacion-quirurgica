"""NotionInsurerRepository — adapter de `InsurerRepository` sobre Notion API.

Opera sobre la **DB Notion 2: Aseguradoras** (PRD §4.2.2).
"""

from __future__ import annotations

from pre_autorizacion.features.policies.domain.entities import Insurer
from pre_autorizacion.features.policies.domain.ports import InsurerRepository
from pre_autorizacion.shared.notion import NotionClient
from pre_autorizacion.shared.notion.entities import notion_to_insurer


class NotionInsurerRepository(InsurerRepository):
    """Adapter Notion del repo de aseguradoras (read-only en MVP)."""

    def __init__(self, notion_client: NotionClient, database_id: str) -> None:
        self._client = notion_client
        self._database_id = database_id

    async def list(self) -> tuple[Insurer, ...]:
        pages = await self._client.query_database(self._database_id)
        return tuple(notion_to_insurer(page) for page in pages)

    async def find_by_id(self, id: str) -> Insurer | None:
        # En Notion el "id de Insurer" es el page_id. Lo más eficiente es
        # `pages.retrieve` directo en lugar de filtrar la DB.
        page = await self._client.retrieve_page(id)
        if not page:
            return None
        return notion_to_insurer(page)
