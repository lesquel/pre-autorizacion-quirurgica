"""Patient — paciente del hospital. PRD §4.2.2 (DB Notion 1: Pacientes).

Port directo de `frontend/src/app/shared/domain/entities/patient.ts`.

Decisiones de mapping TS → Python:
- `dob` (date of birth) en TS llega como string ISO 'YYYY-MM-DD' en el boundary.
  En el dominio se modela como `datetime.date` (date-only, sin hora ni timezone).
  El parseo de string → date sucede en infrastructure (repos / DTOs), no acá.
- `sex` se modela como StrEnum cerrado (`Sex`) en lugar de `Literal[...]` para que
  el dominio tenga un tipo nominal reutilizable; `'X'` se mantiene por compatibilidad
  con identidad no-binaria, igual que el TS source.
- `@dataclass(frozen=True, slots=True)` → entidad inmutable, hashable por todos sus
  campos (incluido `id`), sin overhead de `__dict__`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum


class Sex(StrEnum):
    """Sex — sexo del paciente. 'X' soporta identidad no-binaria."""

    M = "M"
    F = "F"
    X = "X"


@dataclass(frozen=True, slots=True)
class Patient:
    """Patient — entidad inmutable del paciente."""

    id: str
    dni: str
    name: str
    dob: date
    sex: Sex
