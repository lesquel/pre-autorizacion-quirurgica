"""Insurer — aseguradora. PRD §4.2.2 (DB Notion 2: Aseguradoras).

Port directo de `frontend/src/app/features/policies/domain/entities/insurer.ts`.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Insurer:
    """Insurer — entidad inmutable de aseguradora."""

    id: str
    name: str
    email: str | None = None
