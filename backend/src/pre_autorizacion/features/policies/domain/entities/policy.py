"""Policy — póliza de seguro de un paciente.
PRD §4.2.2 (DB Notion 4: Pólizas).

Port directo de `frontend/src/app/features/policies/domain/entities/policy.ts`.

Decisiones de mapping TS → Python:
- `startDate` / `endDate` (string ISO en TS) → `datetime.date` en el dominio.
  El parseo string → date vive en infrastructure (DTOs / repos).
- `status` (literal union TS) → `PolicyStatus` StrEnum con los mismos 3 valores
  canónicos en inglés. El mapeo desde el prototipo (`'ACTIVA'`, etc.) sucede en seed.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum


class PolicyStatus(StrEnum):
    """PolicyStatus — estado canónico de una póliza."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


@dataclass(frozen=True, slots=True)
class Policy:
    """Policy — entidad inmutable de póliza."""

    number: str
    patient_id: str
    plan: str
    insurer_id: str
    start_date: date
    end_date: date
    status: PolicyStatus
