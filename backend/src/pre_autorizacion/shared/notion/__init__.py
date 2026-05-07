"""Integración con Notion API — cliente, mappers y excepciones del adapter.

Subpaquete `shared.notion`:
- `client.NotionClient` : wrapper async sobre `notion-client`.
- `mappers.*`           : helpers genéricos por tipo de property.
- `entities.*`          : mappers entity-specific (Notion ↔ dominio).
- `errors.NotionError`  : jerarquía de excepciones del adapter.
"""

from pre_autorizacion.shared.notion.client import NotionClient
from pre_autorizacion.shared.notion.errors import (
    NotionError,
    NotionMappingError,
    NotionRequestError,
)

__all__ = [
    "NotionClient",
    "NotionError",
    "NotionMappingError",
    "NotionRequestError",
]
