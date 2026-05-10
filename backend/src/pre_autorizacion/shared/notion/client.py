"""NotionClient — wrapper async finito sobre `notion-client`.

Notion-client expone tanto un cliente sync (`Client`) como uno async
(`AsyncClient`). Acá envolvemos el async para:

- centralizar el manejo de errores y traducirlos a `NotionError` del dominio
  (los repos y use cases NO deben acoplarse a `httpx.HTTPError`),
- encapsular la paginación (`start_cursor` + `has_more`) en una API simple
  que devuelve el listado completo,
- exponer la superficie mínima usada por los adapters: `query_database`,
  `create_page`, `update_page`, `retrieve_page`.

PRD §4.2.2 / §4.3.1 — la persistencia primaria del MVP son 7 DBs Notion.
"""

from __future__ import annotations

from typing import Any, cast

import httpx
from notion_client import AsyncClient
from notion_client.errors import APIResponseError, RequestTimeoutError

from pre_autorizacion.shared.notion.errors import NotionRequestError

# Notion permite hasta 100 resultados por página de query. Lo dejamos en el
# máximo para minimizar round-trips en DBs medianas (~7 DBs × ~100 rows = ok).
_PAGE_SIZE: int = 100


class NotionClient:
    """Wrapper async sobre `notion_client.AsyncClient`.

    El constructor recibe el token explícitamente para que la DI controle
    de dónde sale (env var, secret manager, etc.) — el cliente NO lee
    `os.environ` por su cuenta.
    """

    def __init__(self, token: str, *, client: AsyncClient | None = None) -> None:
        self._client = client if client is not None else AsyncClient(auth=token)

    # ─── DBs ────────────────────────────────────────────────────────────

    async def query_database(
        self,
        database_id: str,
        *,
        filter: dict[str, Any] | None = None,
        sorts: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """Lista TODAS las pages de una DB, paginando internamente.

        Notion deprecó `databases.query` en favor de `data_sources.query`. Cada
        Notion DB tiene una o varias data sources; en este MVP asumimos 1 data
        source por DB y usamos su id directamente. El nombre del parámetro
        sigue siendo `database_id` para coherencia conceptual con el PRD §4.2.2;
        en la práctica se inyecta el `data_source_id` provisto por la config.

        Args:
            database_id: data_source_id de la DB en Notion.
            filter:      filtro opcional en formato Notion (ya armado).
            sorts:       sorts opcional en formato Notion.

        Returns:
            Lista de pages crudas (dicts tal como vienen de la API).
        """
        results: list[dict[str, Any]] = []
        start_cursor: str | None = None

        while True:
            payload: dict[str, Any] = {
                "data_source_id": database_id,
                "page_size": _PAGE_SIZE,
            }
            if filter is not None:
                payload["filter"] = filter
            if sorts is not None:
                payload["sorts"] = sorts
            if start_cursor is not None:
                payload["start_cursor"] = start_cursor

            try:
                response = cast(
                    "dict[str, Any]",
                    await self._client.data_sources.query(**payload),
                )
            except (APIResponseError, RequestTimeoutError, httpx.HTTPError) as exc:
                raise NotionRequestError(
                    f"Notion query_database failed: {exc}",
                    status_code=getattr(exc, "status", None),
                ) from exc

            page_results = cast("list[dict[str, Any]]", response.get("results", []))
            results.extend(page_results)

            if not response.get("has_more", False):
                break
            next_cursor = response.get("next_cursor")
            if not isinstance(next_cursor, str):
                # Defensivo: has_more=True sin next_cursor no debería pasar,
                # pero si pasa cortamos para evitar loop infinito.
                break
            start_cursor = next_cursor

        return results

    # ─── Pages ──────────────────────────────────────────────────────────

    async def retrieve_page(self, page_id: str) -> dict[str, Any]:
        try:
            return cast("dict[str, Any]", await self._client.pages.retrieve(page_id=page_id))
        except (APIResponseError, RequestTimeoutError, httpx.HTTPError) as exc:
            raise NotionRequestError(
                f"Notion retrieve_page failed: {exc}",
                status_code=getattr(exc, "status", None),
            ) from exc

    async def create_page(
        self,
        database_id: str,
        properties: dict[str, Any],
    ) -> dict[str, Any]:
        """Crea una fila bajo un data source (id de colección / `NOTION_DB_*`).

        Notion API `2025-09-03` espera `parent.type=data_source_id`, no
        `database_id` plano, cuando el identificador configurado es el de la
        fuente de datos.
        """
        try:
            return cast(
                "dict[str, Any]",
                await self._client.pages.create(
                    parent={"type": "data_source_id", "data_source_id": database_id},
                    properties=properties,
                ),
            )
        except (APIResponseError, RequestTimeoutError, httpx.HTTPError) as exc:
            raise NotionRequestError(
                f"Notion create_page failed: {exc}",
                status_code=getattr(exc, "status", None),
            ) from exc

    async def update_page(
        self,
        page_id: str,
        properties: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            return cast(
                "dict[str, Any]",
                await self._client.pages.update(
                    page_id=page_id,
                    properties=properties,
                ),
            )
        except (APIResponseError, RequestTimeoutError, httpx.HTTPError) as exc:
            raise NotionRequestError(
                f"Notion update_page failed: {exc}",
                status_code=getattr(exc, "status", None),
            ) from exc

    async def archive_page(self, page_id: str) -> dict[str, Any]:
        """Soft-delete: marca la page como archivada.

        Notion no expone un endpoint DELETE para pages; el patrón oficial
        es `pages.update(archived=True)`. La page queda invisible en queries
        pero recuperable desde la papelera de Notion.
        """
        try:
            return cast(
                "dict[str, Any]",
                await self._client.pages.update(page_id=page_id, archived=True),
            )
        except (APIResponseError, RequestTimeoutError, httpx.HTTPError) as exc:
            raise NotionRequestError(
                f"Notion archive_page failed: {exc}",
                status_code=getattr(exc, "status", None),
            ) from exc

    async def aclose(self) -> None:
        """Cierra el HTTP client subyacente (gracefully).

        Conveniente para shutdown handlers de FastAPI.
        """
        await self._client.aclose()


__all__ = ["NotionClient"]
