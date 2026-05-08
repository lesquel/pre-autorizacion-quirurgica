"""NotionPolicyRepository — adapter de `PolicyRepository` sobre Notion API.

Opera sobre la **DB Notion 4: Pólizas** (PRD §4.2.2). El nombre de la
property usada para `find_by_number` (NumeroPoliza, tipo `title`) debe
coincidir con el schema declarado en los mappers de `shared/notion/entities`.
"""

from __future__ import annotations

from typing import Any

from pre_autorizacion.features.policies.domain import PolicyAlreadyExistsError
from pre_autorizacion.features.policies.domain.entities import Policy
from pre_autorizacion.features.policies.domain.ports import PolicyRepository
from pre_autorizacion.shared.notion import NotionClient
from pre_autorizacion.shared.notion.entities import notion_to_policy, policy_to_notion_props
from pre_autorizacion.shared.notion.errors import NotionRequestError


class NotionPolicyRepository(PolicyRepository):
    """Adapter Notion del repo de pólizas (lectura + alta para registro en subida)."""

    def __init__(self, notion_client: NotionClient, database_id: str) -> None:
        self._client = notion_client
        self._database_id = database_id

    async def list(self) -> tuple[Policy, ...]:
        pages = await self._client.query_database(self._database_id)
        return tuple(notion_to_policy(page) for page in pages)

    async def find_by_number(self, n: str) -> Policy | None:
        # NumeroPoliza es la property `title` en la DB Pólizas.
        filter_: dict[str, Any] = {
            "property": "NumeroPoliza",
            "title": {"equals": n},
        }
        pages = await self._client.query_database(self._database_id, filter=filter_)
        if not pages:
            return None
        return notion_to_policy(pages[0])

    async def create(self, policy: Policy) -> Policy:
        if await self.find_by_number(policy.number):
            raise PolicyAlreadyExistsError(f"Policy already exists: {policy.number!r}")
        props = policy_to_notion_props(policy)
        await self._client.create_page(self._database_id, props)
        created = await self.find_by_number(policy.number)
        if created is None:
            raise NotionRequestError(
                f"Policy create succeeded but query by NumeroPoliza returned empty: "
                f"{policy.number!r}",
            )
        return created

    async def update(self, policy: Policy) -> Policy:  # type: ignore[override]
        raise NotImplementedError(
            "CRUD on Notion is out of scope for v1. Use InMemoryPolicyRepository."
        )

    async def delete(self, number: str) -> None:  # type: ignore[override]
        raise NotImplementedError(
            "CRUD on Notion is out of scope for v1. Use InMemoryPolicyRepository."
        )
