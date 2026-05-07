"""Auth domain — entidades + ports."""

from pre_autorizacion.features.auth.domain.entities import Role, User
from pre_autorizacion.features.auth.domain.ports import UserRepository

__all__ = ["Role", "User", "UserRepository"]
