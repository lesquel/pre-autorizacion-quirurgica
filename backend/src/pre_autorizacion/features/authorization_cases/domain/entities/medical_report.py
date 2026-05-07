"""MedicalReport — informe médico prequirúrgico que el hospital adjunta al caso.
PRD §4.2.2 (DB Notion 6: InformesMédicos).

Port directo de
`frontend/src/app/features/authorization-cases/domain/entities/medical-report.ts`.

Decisiones de mapping TS → Python:
- `format: 'text' | 'pdf'`            → `ReportFormat` StrEnum (TEXT, PDF).
- `procedureSolicitedHint?: string`   → `procedure_solicited_hint: str | None`.
- `attendingDoctor?: string`          → `attending_doctor: str | None`.
- `submittedAt: string` (ISO)         → `submitted_at: datetime` (timezone-aware
                                         en el boundary, se parsea en infrastructure).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class ReportFormat(StrEnum):
    """ReportFormat — formato del informe médico."""

    TEXT = "text"
    PDF = "pdf"


@dataclass(frozen=True, slots=True)
class MedicalReport:
    """MedicalReport — entidad inmutable del informe médico."""

    id: str
    patient_id: str
    format: ReportFormat
    content: str
    submitted_at: datetime
    procedure_solicited_hint: str | None = None
    diagnosis: str | None = None
    attending_doctor: str | None = None
