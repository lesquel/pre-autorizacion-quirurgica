"""Procedure — procedimiento quirúrgico (catálogo CIE-10).
PRD §4.2.2 (DB Notion 3: Procedimientos).

Port directo de `frontend/src/app/shared/domain/entities/procedure.ts`.

- `code`                    : código CIE-10 (ej: 'K80.20').
- `category`                : especialidad (Cirugía general, Traumatología, ...).
- `waiting_days_typical`    : carencia típica del catálogo. La carencia REAL
                              aplicable vive en `Coverage.waiting_days` por
                              póliza × procedimiento.

Naming TS → Python: `waitingDaysTypical` → `waiting_days_typical` (snake_case).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Procedure:
    """Procedure — entidad inmutable del catálogo de procedimientos."""

    code: str
    name: str
    category: str | None = None
    waiting_days_typical: int | None = None
