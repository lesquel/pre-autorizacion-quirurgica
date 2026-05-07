"""Ports del dominio de auth."""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.features.auth.domain.entities import User


class UserRepository(ABC):
    """Port read-only del catálogo de usuarios.

    El adapter de MVP es `InMemoryUserStore` (3 usuarios sembrados).
    """

    @abstractmethod
    async def find_by_email(self, email: str) -> User | None:
        """Devuelve el usuario con `email` o `None`. Match case-insensitive."""

    @abstractmethod
    async def find_by_id(self, user_id: str) -> User | None:
        """Devuelve el usuario con `user_id` o `None`."""


__all__ = ["UserRepository"]
