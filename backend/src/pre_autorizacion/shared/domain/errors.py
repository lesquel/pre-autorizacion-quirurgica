"""Errores base del dominio. Mapeables a Problem Details (RFC 7807).

Pirámide:
- `DomainError`        — base abstracto. NO se instancia directo.
- `NotFoundError`      — recurso ausente (404).
- `ValidationError`    — input inválido a nivel dominio (422).
- `ConflictError`      — estado incompatible (409).
- `AuthError`          — credencial faltante o inválida (401).
- `ForbiddenError`     — autenticado pero sin permiso para el recurso (403).
- `IntegrationError`   — falló un sistema externo (502 / 503).

Las features lanzan subclases concretas; el handler global de FastAPI mapea
a respuestas Problem+JSON.
"""

from __future__ import annotations


class DomainError(Exception):
    """Base de todos los errores del dominio.

    Atributos opcionales:
    - `title`:   resumen humano para Problem Details.
    - `status`:  HTTP status code asociado por default.
    - `type_uri`: URI estable del tipo de problema.
    - `detail`:  mensaje específico — generalmente el `args[0]`.
    """

    title: str = "Domain error"
    status: int = 500
    type_uri: str = "about:blank"

    def __init__(self, detail: str = "") -> None:
        super().__init__(detail or self.title)
        self.detail = detail or self.title


class NotFoundError(DomainError):
    """Recurso no encontrado."""

    title = "Resource not found"
    status = 404
    type_uri = "https://pre-autorizacion.dev/errors/not-found"


class ValidationError(DomainError):
    """Input inválido a nivel de dominio (no de schema HTTP)."""

    title = "Validation error"
    status = 422
    type_uri = "https://pre-autorizacion.dev/errors/validation"


class ConflictError(DomainError):
    """Operación incompatible con el estado actual del recurso."""

    title = "Conflict"
    status = 409
    type_uri = "https://pre-autorizacion.dev/errors/conflict"


class AuthError(DomainError):
    """Credencial ausente o inválida."""

    title = "Unauthorized"
    status = 401
    type_uri = "https://pre-autorizacion.dev/errors/unauthorized"


class ForbiddenError(DomainError):
    """Autenticado pero sin permiso suficiente."""

    title = "Forbidden"
    status = 403
    type_uri = "https://pre-autorizacion.dev/errors/forbidden"


class IntegrationError(DomainError):
    """Sistema externo (Notion, LLM, Vision, etc.) inalcanzable o erróneo."""

    title = "Upstream integration error"
    status = 502
    type_uri = "https://pre-autorizacion.dev/errors/integration"


class NotionError(IntegrationError):
    """Falla puntual del cliente Notion."""

    title = "Notion integration error"
    type_uri = "https://pre-autorizacion.dev/errors/notion"


__all__ = [
    "AuthError",
    "ConflictError",
    "DomainError",
    "ForbiddenError",
    "IntegrationError",
    "NotFoundError",
    "NotionError",
    "ValidationError",
]
