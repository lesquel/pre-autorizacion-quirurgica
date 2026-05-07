"""Errores de dominio del feature `policies`.

Subclases de los errores base de `shared/domain/errors.py`. El handler
global de FastAPI mapea cada uno a Problem+JSON con el status code
correspondiente.
"""

from __future__ import annotations

from pre_autorizacion.shared.domain.errors import ConflictError, NotFoundError


class PolicyNotFoundError(NotFoundError):
    """Póliza referenciada no existe."""

    title = "Policy not found"


class PolicyAlreadyExistsError(ConflictError):
    """Intento de crear una póliza con un `number` ya existente."""

    title = "Policy already exists"
