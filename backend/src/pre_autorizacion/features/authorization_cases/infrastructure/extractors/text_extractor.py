"""TextMedicalReportExtractor — extrae entidades clínicas de informes en texto.

Adapter high-level de `MedicalReportExtractor`. Compone un `LLMProvider` y
le pide al LLM que devuelva un JSON estructurado con procedimiento,
diagnóstico, confidence y citas literales del informe.

PRD §3.1.3 — nodo `extract_report` del grafo. El score de confianza que
devuelve el LLM se usa luego en el rule engine (`confidence < 0.80` → ESCALATED).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, Self, final

import structlog
from pydantic import BaseModel, Field, model_validator

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


_logger = structlog.get_logger("extractors.text")


# Mínimo aplicado por el validator cuando el LLM emite confidence=0 o muy baja
# pese a haber extraído al menos un campo clínico.
_MIN_CONFIDENCE_WHEN_EXTRACTED: Final[float] = 0.40
# Default sensato cuando hay extracción pero el LLM "olvidó" emitir confidence.
_DEFAULT_CONFIDENCE_WHEN_EXTRACTED: Final[float] = 0.50
# Umbral para loguear sospechosamente baja confianza pese a tener extracción.
_SUSPICIOUS_CONFIDENCE_THRESHOLD: Final[float] = 0.50


SYSTEM_PROMPT: Final[str] = (
    "Sos un experto en codificación CIE-10 y razonamiento clínico para auditoría "
    "de pre-autorizaciones quirúrgicas. Tu tarea es extraer del informe médico "
    "el procedimiento solicitado y el diagnóstico, asignando códigos CIE-10 cuando "
    "sea posible. NUNCA inventes datos; si no está en el informe, devolvé null. "
    "Devolvé citas literales (textuales, sin parafrasear) que respalden la extracción.\n\n"
    "── CÓMO ASIGNAR `confidence` (0.0–1.0) ──\n"
    "El campo `confidence` refleja qué tan seguro estás de los campos extraídos. "
    "Es OBLIGATORIO emitirlo en CADA respuesta. Reglas:\n"
    "• 0.90–1.00 → procedimiento Y diagnóstico aparecen TEXTUALES y unambiguos en el "
    "informe (ej: 'Colecistectomía laparoscópica' + 'K80.20' explícitos).\n"
    "• 0.70–0.89 → uno explícito y el otro fuertemente inferible por contexto clínico "
    "(ej: nombre del procedimiento claro, código CIE-10 deducido por experto).\n"
    "• 0.50–0.69 → ambos inferibles pero no textuales, o sólo uno extraído con certeza.\n"
    "• 0.40–0.49 → extracción parcial con ambigüedad real (ej: hint del hospital pero "
    "informe vago).\n"
    "• <0.40 → sólo si el informe es ininteligible, contradictorio o vacío.\n"
    "• 0.00 → SOLO si NO extrajiste NINGÚN campo (todos null).\n\n"
    "REGLA DURA: si extrajiste AL MENOS UN campo (procedimiento o diagnóstico), "
    "`confidence` DEBE ser >= 0.50. NUNCA devuelvas confidence=0 cuando hay extracción "
    "exitosa. Si dudás, usá 0.60."
)


class _TextExtractionSchema(BaseModel):
    """Schema interno que el LLM debe respetar.

    Mapea 1:1 a `ExtractedMedicalReport` salvo el campo `evidence_quotes` que
    el LLM emite como `list[str]` y nosotros normalizamos a `tuple[str, ...]`.

    `confidence` se declara como **required** (sin default) para forzar al LLM
    a emitirlo. Un `model_validator` blinda el caso patológico en que llegue
    0.0 con campos extraídos no-null (típico de DeepSeek json_mode "olvidando"
    el campo o devolviendo el default).
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
        ge=0.0,
        le=1.0,
        description=(
            "Confianza de la extracción [0.0, 1.0]. OBLIGATORIO. "
            "Si extrajiste algún campo, DEBE ser >= 0.50."
        ),
    )
    evidence_quotes: list[str] = Field(
        default_factory=list,
        description="Citas TEXTUALES (sin parafrasear) del informe que respaldan los campos extraídos.",
    )

    @model_validator(mode="after")
    def _enforce_min_confidence_when_extracted(self) -> Self:
        """Blinda contra LLMs que devuelven confidence=0 con extracción exitosa.

        Si hay al menos un campo extraído (procedimiento o diagnóstico, código o
        nombre), forzamos `confidence >= _MIN_CONFIDENCE_WHEN_EXTRACTED`. Si el
        LLM mandó <0.40, lo elevamos al default y logueamos.
        """
        has_extraction = any(
            (
                self.extracted_procedure_name,
                self.extracted_procedure_code,
                self.extracted_diagnosis_code,
                self.extracted_diagnosis_description,
            )
        )
        if has_extraction and self.confidence < _MIN_CONFIDENCE_WHEN_EXTRACTED:
            _logger.warning(
                "llm.confidence_suspicious",
                source="text_extractor",
                original_confidence=self.confidence,
                clamped_to=_DEFAULT_CONFIDENCE_WHEN_EXTRACTED,
                procedure_name=self.extracted_procedure_name,
                procedure_code=self.extracted_procedure_code,
                diagnosis_code=self.extracted_diagnosis_code,
                reason="LLM devolvió confidence muy baja pese a extraer campos",
            )
            # Pydantic v2 permite reasignar campos en validators `mode='after'`.
            object.__setattr__(self, "confidence", _DEFAULT_CONFIDENCE_WHEN_EXTRACTED)
        return self


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

        # Logueo defensivo: confidence sospechosa post-validator (ej: 0.40 raso
        # tras clamp, o 0.45 raw del LLM con extracción). Útil para diagnóstico.
        if result.confidence < _SUSPICIOUS_CONFIDENCE_THRESHOLD and any(
            (
                result.extracted_procedure_name,
                result.extracted_procedure_code,
                result.extracted_diagnosis_code,
            )
        ):
            _logger.info(
                "llm.confidence_suspicious",
                source="text_extractor.post_validate",
                confidence=result.confidence,
                procedure_name=result.extracted_procedure_name,
                report_id=str(report.id),
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
            "RECORDATORIO CRÍTICO: el campo `confidence` es OBLIGATORIO. Si extraés "
            "AL MENOS un campo (procedimiento o diagnóstico), `confidence` DEBE ser "
            ">= 0.50 (típicamente 0.85 cuando los datos están explícitos). NUNCA "
            "devuelvas confidence=0 con campos extraídos.\n\n"
            f"Hint del hospital (procedimiento sugerido): {hint}\n"
            f"Hint del hospital (diagnóstico sugerido): {diagnosis}\n\n"
            "--- INFORME ---\n"
            f"{report.content}\n"
            "--- FIN INFORME ---\n"
        )


__all__ = ["TextMedicalReportExtractor"]
