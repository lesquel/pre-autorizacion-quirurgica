"""Errores de dominio del feature `procedures`.

Subclases de los errores base de `shared/domain/errors.py`. El handler
global de FastAPI los mapea a Problem+JSON con el status code apropiado.
"""

from __future__ import annotations

from pre_autorizacion.shared.domain.errors import ConflictError, NotFoundError


class ProcedureNotFoundError(NotFoundError):
    """Procedimiento referenciado no existe."""

    title = "Procedure not found"


class ProcedureAlreadyExistsError(ConflictError):
    """Intento de crear un procedimiento con un `code` ya existente."""

    title = "Procedure already exists"
