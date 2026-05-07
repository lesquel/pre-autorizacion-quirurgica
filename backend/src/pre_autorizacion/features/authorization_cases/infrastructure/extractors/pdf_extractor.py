"""PdfMedicalReportExtractor — extrae entidades clínicas de informes en PDF.

Adapter high-level de `MedicalReportExtractor` que compone un `VisionExtractor`
(Gemini default) para PDFs. Usa structured output directo: una sola llamada
al modelo de visión devuelve el schema con códigos CIE-10 + citas.

PRD §3.1.3 — nodo `extract_report` cuando `report.format == PDF`.

Resolución de `report.content` (str) → `bytes`:

El dataclass `MedicalReport` define `content: str`, pero un PDF es binario.
La convención que adopta este adapter (documentada acá para Wave B3+):

1. Si `report.content` empieza con `data:application/pdf;base64,`  → decodear el b64.
2. Si `report.content` parece un base64 puro (regex laxa)            → decodear.
3. Si hay `FileStorage` inyectado y `content` parece una key/path    → `await storage.read(content)`.
4. Si nada matchea                                                   → `VisionExtractionError`.

El submitter (use case) sabe lo que escribió ahí y elige la convención
correcta. Para v1 in-memory el caller pasa `data:application/pdf;base64,...`,
y cuando wired-up `FileStorage` se almacena la key y se hidrata en runtime.
"""

from __future__ import annotations

import base64
import binascii
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
from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractionError

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.entities import MedicalReport
    from pre_autorizacion.shared.storage.ports.file_storage import FileStorage
    from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractor


DATA_URI_PREFIX: Final[str] = "data:application/pdf;base64,"

EXTRACTION_PROMPT: Final[str] = (
    "Analizá este informe médico en PDF y extraé las entidades clínicas: "
    "procedimiento solicitado (nombre + código CIE-10 si lo deducís), "
    "diagnóstico (descripción + código CIE-10), y citas TEXTUALES del documento "
    "que respalden la extracción. NUNCA inventes datos: si un campo no está, "
    "devolvelo como null. Asigná un confidence ∈ [0.0, 1.0] que refleje qué tan "
    "claro está el informe."
)


class _PdfExtractionSchema(BaseModel):
    """Schema que Gemini debe respetar (mismo shape que el text extractor)."""

    extracted_procedure_name: str | None = Field(default=None)
    extracted_procedure_code: str | None = Field(default=None)
    extracted_diagnosis_code: str | None = Field(default=None)
    extracted_diagnosis_description: str | None = Field(default=None)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_quotes: list[str] = Field(default_factory=list)


@final
class PdfMedicalReportExtractor(MedicalReportExtractor):
    """Extractor de informes PDF vía `VisionExtractor.extract_structured`."""

    def __init__(
        self,
        vision: VisionExtractor,
        *,
        storage: FileStorage | None = None,
    ) -> None:
        self._vision = vision
        self._storage = storage

    async def extract(self, report: MedicalReport) -> ExtractedMedicalReport:
        if report.format is not ReportFormat.PDF:
            raise ValidationError(
                f"PdfMedicalReportExtractor only handles ReportFormat.PDF, "
                f"got {report.format!r}. Use TextMedicalReportExtractor for text."
            )

        pdf_bytes = await self._resolve_bytes(report.content)

        result = await self._vision.extract_structured(
            pdf_bytes,
            schema=_PdfExtractionSchema,
            prompt=EXTRACTION_PROMPT,
        )

        return ExtractedMedicalReport(
            extracted_procedure_name=result.extracted_procedure_name,
            extracted_procedure_code=result.extracted_procedure_code,
            extracted_diagnosis_code=result.extracted_diagnosis_code,
            extracted_diagnosis_description=result.extracted_diagnosis_description,
            confidence=result.confidence,
            evidence_quotes=tuple(result.evidence_quotes),
        )

    async def _resolve_bytes(self, content: str) -> bytes:
        """Resuelve `report.content` (str) a los bytes binarios del PDF.

        Convenciones aceptadas (en orden):
        1. Data URI `data:application/pdf;base64,<b64>`.
        2. Base64 puro (sin prefijo).
        3. Storage key/path → `await self._storage.read(content)` si hay storage.
        """
        if not content:
            raise VisionExtractionError("MedicalReport.content is empty for PDF format.")

        # Caso 1: data URI.
        if content.startswith(DATA_URI_PREFIX):
            payload = content[len(DATA_URI_PREFIX) :]
            return self._decode_b64_or_raise(payload)

        # Caso 2: base64 puro. Heurística defensiva: si decodea sin error y el
        # resultado tiene cabecera PDF (`%PDF-`) lo aceptamos.
        try:
            decoded = base64.b64decode(content, validate=True)
        except (binascii.Error, ValueError):
            decoded = None
        if decoded is not None and decoded.startswith(b"%PDF-"):
            return decoded

        # Caso 3: storage key.
        if self._storage is not None:
            try:
                return await self._storage.read(content)
            except FileNotFoundError as exc:
                raise VisionExtractionError(
                    f"PDF not found in FileStorage under key {content!r}."
                ) from exc

        raise VisionExtractionError(
            "Could not resolve MedicalReport.content to PDF bytes: not a data URI, "
            "not valid base64, and no FileStorage available to read by key."
        )

    @staticmethod
    def _decode_b64_or_raise(payload: str) -> bytes:
        try:
            return base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise VisionExtractionError(f"Invalid base64 PDF payload: {exc}") from exc


__all__ = ["PdfMedicalReportExtractor"]
