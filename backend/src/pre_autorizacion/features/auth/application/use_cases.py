"""Use cases del feature `auth`.

- `LoginUseCase`: email + password → (access, refresh, user).
- `RefreshTokenUseCase`: refresh token → nuevo access token.
- `GetCurrentUserUseCase`: payload decodificado → User entity.

Sin mutación, sin side-effects (más allá del logging). El JWT es stateless.
"""

from __future__ import annotations

from dataclasses import dataclass

from pre_autorizacion.features.auth.application.jwt_service import JwtService
from pre_autorizacion.features.auth.domain.entities import User
from pre_autorizacion.features.auth.domain.ports import UserRepository
from pre_autorizacion.features.auth.infrastructure.in_memory_user_store import verify_password
from pre_autorizacion.shared.domain.errors import AuthError


@dataclass(frozen=True, slots=True)
class TokenPair:
    """Resultado de un login exitoso."""

    access_token: str
    refresh_token: str
    user: User


class LoginUseCase:
    """Login con email + password. Devuelve un par (access, refresh) + user."""

    def __init__(self, *, users: UserRepository, jwt_service: JwtService) -> None:
        self._users = users
        self._jwt = jwt_service

    async def execute(self, email: str, password: str) -> TokenPair:
        user = await self._users.find_by_email(email)
        if user is None or not verify_password(password, user.hashed_password):
            # Mismo mensaje en ambos casos para evitar enumeración de usuarios.
            raise AuthError("Invalid credentials")
        return TokenPair(
            access_token=self._jwt.create_access_token(user),
            refresh_token=self._jwt.create_refresh_token(user),
            user=user,
        )


class RefreshTokenUseCase:
    """Renueva el access token a partir de un refresh token válido."""

    def __init__(self, *, users: UserRepository, jwt_service: JwtService) -> None:
        self._users = users
        self._jwt = jwt_service

    async def execute(self, refresh_token: str) -> str:
        payload = self._jwt.decode(refresh_token, expected_type="refresh")
        user = await self._users.find_by_id(payload.sub)
        if user is None:
            raise AuthError("User no longer exists")
        return self._jwt.create_access_token(user)


class GetCurrentUserUseCase:
    """Resuelve un User a partir de un access token decodificado."""

    def __init__(self, *, users: UserRepository) -> None:
        self._users = users

    async def execute(self, user_id: str) -> User:
        user = await self._users.find_by_id(user_id)
        if user is None:
            raise AuthError("User no longer exists")
        return user


__all__ = ["GetCurrentUserUseCase", "LoginUseCase", "RefreshTokenUseCase", "TokenPair"]
