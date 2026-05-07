"""Entidades del dominio de auth — `User` + `Role`.

`Role` es un `StrEnum` global: `HOSPITAL`, `INSURER`, `AUDITOR`. Se usa tanto
para autorización como para discriminar vistas en el dashboard del frontend.

`User` es inmutable (`frozen=True, slots=True`). Su `hashed_password` viaja
SOLO al adapter de auth — nunca se serializa al cliente. La capa API expone
`UserOut` (Pydantic) sin el hash.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Role(StrEnum):
    """Rol del usuario (PRD §3 — 3 roles del MVP)."""

    HOSPITAL = "hospital"
    INSURER = "insurer"
    AUDITOR = "auditor"


@dataclass(frozen=True, slots=True)
class User:
    """Usuario inmutable — entidad de dominio."""

    id: str
    email: str
    name: str
    role: Role
    hashed_password: str


__all__ = ["Role", "User"]
