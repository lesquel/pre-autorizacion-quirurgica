"""TextMedicalReportExtractor — extrae entidades clínicas de informes en texto.

Adapter high-level de `MedicalReportExtractor`. Compone un `LLMProvider` y
le pide al LLM que devuelva un JSON estructurado con procedimiento,
diagnóstico, confidence y citas literales del informe.

PRD §3.1.3 — nodo `extract_report` del grafo. El score de confianza que
devuelve el LLM se usa luego en el rule engine (`confidence < 0.80` → ESCALATED).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, final

from pydantic import BaseModel, Field

from pre_autorizacion.features.authorization_cases.domain.entities.medical_report import (
    ReportFormat,
)
from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (
    ExtractedMedicalReport,
    MedicalReportExtractor,
)
from pre_autorizacion.shared.domain.errors import ValidationError

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.entities import MedicalReport
    from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider


SYSTEM_PROMPT: Final[str] = (
    "Sos un experto en codificación CIE-10 y razonamiento clínico para auditoría "
    "de pre-autorizaciones quirúrgicas. Tu tarea es extraer del informe médico "
    "el procedimiento solicitado y el diagnóstico, asignando códigos CIE-10 cuando "
    "sea posible. NUNCA inventes datos; si no está en el informe, devolvé null. "
    "Devolvé citas literales (textuales, sin parafrasear) que respalden la extracción."
)


class _TextExtractionSchema(BaseModel):
    """Schema interno que el LLM debe respetar.

    Mapea 1:1 a `ExtractedMedicalReport` salvo el campo `evidence_quotes` que
    el LLM emite como `list[str]` y nosotros normalizamos a `tuple[str, ...]`.
    """

    extracted_procedure_name: str | None = Field(
        default=None,
        description="Nombre legible del procedimiento solicitado (ej: 'Colecistectomía laparoscópica').",
    )
    extracted_procedure_code: str | None = Field(
        default=None,
        description="Código CIE-10 del procedimiento si lo identificás con certeza.",
    )
    extracted_diagnosis_code: str | None = Field(
        default=None,
        description="Código CIE-10 del diagnóstico (ej: K80.2).",
    )
    extracted_diagnosis_description: str | None = Field(
        default=None,
        description="Descripción libre del diagnóstico.",
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confianza de la extracción [0.0, 1.0].",
    )
    evidence_quotes: list[str] = Field(
        default_factory=list,
        description="Citas TEXTUALES (sin parafrasear) del informe que respaldan los campos extraídos.",
    )


@final
class TextMedicalReportExtractor(MedicalReportExtractor):
    """Extractor de informes en texto plano vía `LLMProvider.complete_structured`."""

    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    async def extract(self, report: MedicalReport) -> ExtractedMedicalReport:
        if report.format is not ReportFormat.TEXT:
            raise ValidationError(
                f"TextMedicalReportExtractor only handles ReportFormat.TEXT, "
                f"got {report.format!r}. Use PdfMedicalReportExtractor for PDFs."
            )

        prompt = self._build_prompt(report)
        result = await self._llm.complete_structured(
            prompt,
            schema=_TextExtractionSchema,
            system=SYSTEM_PROMPT,
            temperature=0.0,
        )

        return ExtractedMedicalReport(
            extracted_procedure_name=result.extracted_procedure_name,
            extracted_procedure_code=result.extracted_procedure_code,
            extracted_diagnosis_code=result.extracted_diagnosis_code,
            extracted_diagnosis_description=result.extracted_diagnosis_description,
            confidence=result.confidence,
            evidence_quotes=tuple(result.evidence_quotes),
        )

    @staticmethod
    def _build_prompt(report: MedicalReport) -> str:
        hint = report.procedure_solicited_hint or "(no informado)"
        diagnosis = report.diagnosis or "(no informado)"
        return (
            "Analizá el siguiente informe médico y extraé las entidades clínicas "
            "solicitadas. Devolvé únicamente JSON válido cumpliendo el schema.\n\n"
            f"Hint del hospital (procedimiento sugerido): {hint}\n"
            f"Hint del hospital (diagnóstico sugerido): {diagnosis}\n\n"
            "--- INFORME ---\n"
            f"{report.content}\n"
            "--- FIN INFORME ---\n"
        )


__all__ = ["TextMedicalReportExtractor"]
