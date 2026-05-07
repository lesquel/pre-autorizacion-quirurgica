"""MedicalReportExtractor — port high-level que extrae entidades clínicas de un informe.

PRD §3.1.4 — port high-level que vive ENCIMA de `LLMProvider` (texto) o
`VisionExtractor` (PDF). Las dos implementaciones concretas:
- `LLMReportExtractor`  → consume `LLMProvider` para informes texto.
- `PdfReportExtractor`  → consume `VisionExtractor` para informes PDF.

Devuelve un `ExtractedMedicalReport` (dataclass inmutable de este mismo módulo)
con los campos clínicos clave + score de confianza + citas literales que sirvan
luego como `evidence` en la decisión final del agente.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Forward reference: la entidad la crea otro subagente en paralelo.
    from pre_autorizacion.features.authorization_cases.domain.entities import (
        MedicalReport,
    )


@dataclass(frozen=True, slots=True)
class ExtractedMedicalReport:
    """Output del `MedicalReportExtractor`.

    Estructura intermedia que viaja del nodo `extract_report` al nodo
    `match_procedure` del agente (PRD §3.1.3). Inmutable y sin lógica de dominio.

    Campos:
        extracted_procedure_name: nombre libre del procedimiento detectado.
        extracted_procedure_code: código CIE-10 si el LLM lo dedujo.
        extracted_diagnosis_code: código CIE-10 del diagnóstico.
        extracted_diagnosis_description: descripción libre del diagnóstico.
        confidence: score [0.0, 1.0] que reporta la confianza del extractor.
            El gate determinístico de confianza global vive en el rule engine,
            no acá — este score sólo refleja la extracción.
        evidence_quotes: citas literales del informe que respaldan la extracción.
            Se reusan luego como `Evidence` con `source="report"` en la
            `AgentDecision` final.
    """

    extracted_procedure_name: str | None
    extracted_procedure_code: str | None
    extracted_diagnosis_code: str | None
    extracted_diagnosis_description: str | None
    confidence: float
    evidence_quotes: tuple[str, ...]


class MedicalReportExtractor(ABC):
    """Port high-level que extrae entidades clínicas desde un `MedicalReport`."""

    @abstractmethod
    async def extract(self, report: MedicalReport) -> ExtractedMedicalReport:
        """Extrae los campos clínicos relevantes del informe.

        Args:
            report: informe médico (formato texto o PDF; el adapter decide
                qué port low-level usar).

        Returns:
            `ExtractedMedicalReport` con procedure/diagnosis hint + confidence + quotes.

        Raises:
            VisionExtractionError: si el adapter PDF no puede leer el documento.
            LLMProviderError: si la llamada al LLM falla.
        """
