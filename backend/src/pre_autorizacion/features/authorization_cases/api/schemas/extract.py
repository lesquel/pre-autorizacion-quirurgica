"""Schemas HTTP para extracción asistida por visión (PDF → campos de formulario).

No crean casos en Notion: sólo devuelven datos para autocompletar la UI antes del submit.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MedicalPdfExtractOut(BaseModel):
    """Campos típicos del informe médico (plantilla `docs/informe-medico-template.md`)."""

    patient_id: str | None = Field(default=None, description="ID o número de historia del paciente si aparece.")
    policy_number: str | None = Field(default=None, description="Número de póliza si consta en el informe.")
    attending_doctor: str | None = Field(default=None, description="Médico tratante.")
    diagnosis: str | None = Field(default=None, description="Diagnóstico principal en texto.")
    diagnosis_code: str | None = Field(default=None, description="CIE-10 del diagnóstico principal.")
    procedure_code: str | None = Field(default=None, description="CIE-10 del procedimiento solicitado, si aplica.")
    procedure_name: str | None = Field(default=None, description="Nombre del procedimiento propuesto.")
    report_text_summary: str | None = Field(
        default=None,
        description="Resumen breve o primeros párrafos citables del informe (opcional).",
    )
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class PolicyPdfExtractOut(BaseModel):
    """Campos típicos de la póliza (plantilla `docs/poliza-paciente-template.md`)."""

    policy_number: str | None = Field(default=None, description="Número de póliza.")
    patient_id: str | None = Field(
        default=None,
        description="Identificación del paciente cubierto si aparece (cédula, ID interno, etc.).",
    )
    insurer_name: str | None = Field(default=None, description="Nombre de la aseguradora.")
    plan_name: str | None = Field(default=None, description="Plan o producto.")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


__all__ = ["MedicalPdfExtractOut", "PolicyPdfExtractOut"]
