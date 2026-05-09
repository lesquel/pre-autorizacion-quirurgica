"""Excepciones del adapter Notion.

Hereda de la jerarquía dominio (`shared.domain.errors.NotionError` →
`IntegrationError` → `DomainError`) para que `register_error_handlers`
las mapee a Problem Details RFC 7807. Antes vivían como `Exception`
plana y se caían al handler genérico → 500 opaco.
"""

from __future__ import annotations

from pre_autorizacion.shared.domain.errors import NotionError as _DomainNotionError


class NotionError(_DomainNotionError):
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
