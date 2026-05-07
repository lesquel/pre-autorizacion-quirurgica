"""Schemas Pydantic v2 del feature `auth`.

Convención de naming:
- En Python usamos snake_case (estándar PEP 8).
- En el wire (JSON) usamos camelCase para alinear con el frontend Angular.
- `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)`
  hace ambos: serializa a camelCase y permite parsear tanto camelCase como
  snake_case.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from pre_autorizacion.features.auth.domain.entities import Role, User

# Regex laxo deliberadamente — el mercado real es Latam y RFC 5322 es overkill.
# Para validación estricta agregaremos `email-validator` cuando lo justifique.
_EMAIL_REGEX = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


class _CamelModel(BaseModel):
    """Base de schemas que serializan a camelCase."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class LoginRequest(_CamelModel):
    """Body de `POST /auth/login`."""

    email: str = Field(min_length=3, max_length=320, pattern=_EMAIL_REGEX)
    password: str = Field(min_length=1, max_length=200)


class RefreshRequest(_CamelModel):
    """Body de `POST /auth/refresh`."""

    refresh_token: str = Field(min_length=10)


class UserOut(_CamelModel):
    """Representación pública de un usuario (sin hash)."""

    id: str
    email: str
    name: str
    role: Role

    @classmethod
    def from_domain(cls, user: User) -> UserOut:
        return cls(id=user.id, email=user.email, name=user.name, role=user.role)


class LoginResponse(_CamelModel):
    """Respuesta de `POST /auth/login`."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshResponse(_CamelModel):
    """Respuesta de `POST /auth/refresh`."""

    access_token: str
    token_type: str = "bearer"


__all__ = [
    "LoginRequest",
    "LoginResponse",
    "RefreshRequest",
    "RefreshResponse",
    "UserOut",
]
