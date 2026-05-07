"""Excepciones del adapter Notion.

Vivimos en `shared/notion/` (capa de infrastructure compartida) — los slices
que necesiten distinguir errores Notion de otros fallos importan desde acá.
"""

from __future__ import annotations


class NotionError(Exception):
    """Error genérico de la integración con Notion (HTTP, parsing, etc.)."""


class NotionRequestError(NotionError):
    """Falla en la request HTTP a la API de Notion."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class NotionMappingError(NotionError):
    """Una page de Notion no tiene la forma esperada y no puede mapearse a dominio."""


__all__ = [
    "NotionError",
    "NotionMappingError",
    "NotionRequestError",
]
