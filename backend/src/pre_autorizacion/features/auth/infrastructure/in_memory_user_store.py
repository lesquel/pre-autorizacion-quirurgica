"""InMemoryUserStore — adapter MVP con 3 usuarios sembrados (uno por rol).

Credenciales demo (para `/auth/login`):
- hospital@demo.com / hospital
- insurer@demo.com  / insurer
- auditor@demo.com  / auditor

Las contraseñas viven hasheadas con bcrypt — el adapter NUNCA almacena la
contraseña en plano. Sólo se generan en construcción a partir de constantes
documentadas, para permitir un demo end-to-end sin BD.
"""

from __future__ import annotations

import bcrypt

from pre_autorizacion.features.auth.domain.entities import Role, User
from pre_autorizacion.features.auth.domain.ports import UserRepository

# Credenciales demo — visibles a propósito (PRD MVP). Reemplazar con BD real.
_DEMO_USERS_RAW: tuple[tuple[str, str, str, Role, str], ...] = (
    ("usr_hospital_demo", "hospital@demo.com", "Hospital Demo", Role.HOSPITAL, "hospital"),
    ("usr_insurer_demo", "insurer@demo.com", "Insurer Demo", Role.INSURER, "insurer"),
    ("usr_auditor_demo", "auditor@demo.com", "Auditor Demo", Role.AUDITOR, "auditor"),
)


def _hash_password(plain: str) -> str:
    """Hashea con bcrypt; cost=12 (default razonable, ~250ms en CPU moderna)."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica `plain` contra el hash bcrypt `hashed`. Constante en tiempo."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _build_seed_users() -> tuple[User, ...]:
    """Construye los 3 usuarios sembrados con passwords hasheados."""
    return tuple(
        User(
            id=user_id,
            email=email,
            name=name,
            role=role,
            hashed_password=_hash_password(plain),
        )
        for user_id, email, name, role, plain in _DEMO_USERS_RAW
    )


class InMemoryUserStore(UserRepository):
    """Repositorio in-memory de usuarios. Sembrado al construir."""

    def __init__(self, users: tuple[User, ...] | None = None) -> None:
        self._users: tuple[User, ...] = users if users is not None else _build_seed_users()
        # Índice precalculado para lookup O(1) por email lower.
        self._by_email: dict[str, User] = {u.email.lower(): u for u in self._users}
        self._by_id: dict[str, User] = {u.id: u for u in self._users}

    async def find_by_email(self, email: str) -> User | None:
        return self._by_email.get(email.strip().lower())

    async def find_by_id(self, user_id: str) -> User | None:
        return self._by_id.get(user_id)


__all__ = ["InMemoryUserStore", "verify_password"]
