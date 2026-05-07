"""JwtService — emisión y verificación de access/refresh tokens.

Detalles del payload:
- `sub`: user id.
- `email`: email del usuario (UI).
- `role`: rol (`hospital`/`insurer`/`auditor`) — se evalúa en `require_role`.
- `type`: `"access"` | `"refresh"` — un refresh nunca debe usarse como access.
- `iat` / `exp`: timestamps UTC.

Errores se propagan como `AuthError` (DomainError → 401 vía error handlers).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt

from pre_autorizacion.features.auth.domain.entities import Role, User
from pre_autorizacion.shared.domain.errors import AuthError

TokenType = Literal["access", "refresh"]


@dataclass(frozen=True, slots=True)
class JwtPayload:
    """Payload tipado decodificado del JWT."""

    sub: str
    email: str
    role: Role
    type: TokenType
    iat: datetime
    exp: datetime


class JwtService:
    """Servicio de JWT (HS256 por default). Stateless — no invalida tokens."""

    def __init__(
        self,
        *,
        secret: str,
        algorithm: str,
        access_ttl_minutes: int,
        refresh_ttl_days: int,
    ) -> None:
        self._secret = secret
        self._algorithm = algorithm
        self._access_ttl = timedelta(minutes=access_ttl_minutes)
        self._refresh_ttl = timedelta(days=refresh_ttl_days)

    # ── Emisión ──────────────────────────────────────────────────────────

    def create_access_token(self, user: User) -> str:
        """Emite un access token para `user`."""
        return self._encode(user, ttl=self._access_ttl, token_type="access")

    def create_refresh_token(self, user: User) -> str:
        """Emite un refresh token para `user`."""
        return self._encode(user, ttl=self._refresh_ttl, token_type="refresh")

    # ── Decodificación ───────────────────────────────────────────────────

    def decode(self, token: str, *, expected_type: TokenType | None = None) -> JwtPayload:
        """Decodifica y valida `token`.

        Raises:
            AuthError: si la firma es inválida, expiró, o el `type` no coincide.
        """
        try:
            raw: dict[str, Any] = jwt.decode(
                token,
                self._secret,
                algorithms=[self._algorithm],
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("Token expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthError("Invalid token") from exc

        try:
            role = Role(raw["role"])
            token_type: TokenType = raw["type"]
            payload = JwtPayload(
                sub=str(raw["sub"]),
                email=str(raw["email"]),
                role=role,
                type=token_type,
                iat=datetime.fromtimestamp(int(raw["iat"]), tz=UTC),
                exp=datetime.fromtimestamp(int(raw["exp"]), tz=UTC),
            )
        except (KeyError, ValueError) as exc:
            raise AuthError("Malformed token payload") from exc

        if expected_type is not None and payload.type != expected_type:
            raise AuthError(f"Expected {expected_type} token, got {payload.type}")

        return payload

    # ── Internos ─────────────────────────────────────────────────────────

    def _encode(self, user: User, *, ttl: timedelta, token_type: TokenType) -> str:
        now = datetime.now(tz=UTC)
        payload: dict[str, Any] = {
            "sub": user.id,
            "email": user.email,
            "role": user.role.value,
            "type": token_type,
            "iat": int(now.timestamp()),
            "exp": int((now + ttl).timestamp()),
        }
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)


__all__ = ["JwtPayload", "JwtService", "TokenType"]
