"""NotionCoverageRepository — adapter de `CoverageRepository` sobre Notion API.

Opera sobre la **DB Notion 5: Coberturas** (PRD §4.2.2). `list_for_policy`
filtra por la property plana `PolizaNumero` (rich_text) — más simple y rápido
que resolver la relation a page_id antes de consultar.
"""

from __future__ import annotations

from typing import Any

from pre_autorizacion.features.policies.domain.entities import Coverage
from pre_autorizacion.features.policies.domain.ports import CoverageRepository
from pre_autorizacion.shared.notion import NotionClient
from pre_autorizacion.shared.notion.entities import notion_to_coverage


class NotionCoverageRepository(CoverageRepository):
    """Adapter Notion del repo de coberturas (read-only en MVP)."""

    def __init__(self, notion_client: NotionClient, database_id: str) -> None:
        self._client = notion_client
        self._database_id = database_id

    async def list(self) -> tuple[Coverage, ...]:
        pages = await self._client.query_database(self._database_id)
        return tuple(notion_to_coverage(page) for page in pages)

    async def list_for_policy(self, policy_number: str) -> tuple[Coverage, ...]:
        filter_: dict[str, Any] = {
            "property": "PolizaNumero",
            "rich_text": {"equals": policy_number},
        }
        pages = await self._client.query_database(self._database_id, filter=filter_)
        return tuple(notion_to_coverage(page) for page in pages)
