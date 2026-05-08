"""PdfMedicalReportExtractor — extrae entidades clínicas de informes en PDF.

Adapter high-level de `MedicalReportExtractor` que compone un `VisionExtractor`
(Gemini default) para PDFs. Orden: (1) visión estructurada si está disponible;
(2) si falla o no hay API, **texto local con `pypdf`** + el mismo pipeline que
informes TEXT (LLM de texto); (3) hints del hospital como último recurso.

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
from typing import TYPE_CHECKING, Final, Self, final

import structlog
from pydantic import BaseModel, Field, model_validator

from pre_autorizacion.features.authorization_cases.domain.entities.medical_report import (
    MedicalReport,
    ReportFormat,
)
from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (
    ExtractedMedicalReport,
    MedicalReportExtractor,
)
from pre_autorizacion.shared.domain.errors import ValidationError
from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractionError

if TYPE_CHECKING:
    from pre_autorizacion.shared.storage.ports.file_storage import FileStorage
    from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractor


_logger = structlog.get_logger("extractors.pdf")


DATA_URI_PREFIX: Final[str] = "data:application/pdf;base64,"

# Contenido mínimo (hints del hospital + texto pypdf) para intentar el LLM de texto.
_MIN_MERGED_TEXT_CHARS: Final[int] = 24
# Límite razonable para el prompt del LLM de texto (post pypdf).
_MAX_TEXT_CHARS_FOR_LLM: Final[int] = 12_000

# Mismas heurísticas que el text extractor para coherencia entre adapters.
_MIN_CONFIDENCE_WHEN_EXTRACTED: Final[float] = 0.40
_DEFAULT_CONFIDENCE_WHEN_EXTRACTED: Final[float] = 0.50
_SUSPICIOUS_CONFIDENCE_THRESHOLD: Final[float] = 0.50


EXTRACTION_PROMPT: Final[str] = (
    "Analizá este informe médico en PDF y extraé las entidades clínicas: "
    "procedimiento solicitado (nombre + código CIE-10 si lo deducís), "
    "diagnóstico (descripción + código CIE-10), y citas TEXTUALES del documento "
    "que respalden la extracción. NUNCA inventes datos: si un campo no está, "
    "devolvelo como null.\n\n"
    "── CÓMO ASIGNAR `confidence` (0.0–1.0) ──\n"
    "Es OBLIGATORIO emitir `confidence` en CADA respuesta. Reglas:\n"
    "• 0.90–1.00 → procedimiento Y diagnóstico TEXTUALES y unambiguos.\n"
    "• 0.70–0.89 → uno explícito, otro fuertemente inferible por contexto clínico.\n"
    "• 0.50–0.69 → inferibles pero no textuales, o sólo uno con certeza.\n"
    "• 0.40–0.49 → extracción parcial con ambigüedad real.\n"
    "• <0.40 → informe ininteligible, contradictorio o vacío.\n"
    "• 0.00 → SOLO si TODOS los campos quedaron null.\n\n"
    "REGLA DURA: si extrajiste AL MENOS UN campo, `confidence` DEBE ser >= 0.50. "
    "NUNCA confidence=0 con extracción exitosa. Si dudás, usá 0.60."
)


class _PdfExtractionSchema(BaseModel):
    """Schema que Gemini debe respetar (mismo shape que el text extractor).

    `confidence` es **required** (sin default) para forzar al LLM a emitirlo.
    El `model_validator` blinda contra el caso patológico de confidence=0 con
    campos extraídos no-null.
    """

    extracted_procedure_name: str | None = Field(default=None)
    extracted_procedure_code: str | None = Field(default=None)
    extracted_diagnosis_code: str | None = Field(default=None)
    extracted_diagnosis_description: str | None = Field(default=None)
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Confianza de la extracción [0.0, 1.0]. OBLIGATORIO. "
            "Si extrajiste algún campo, DEBE ser >= 0.50."
        ),
    )
    evidence_quotes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _enforce_min_confidence_when_extracted(self) -> Self:
        """Blinda contra LLMs que devuelven confidence=0 con extracción exitosa."""
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
                source="pdf_extractor",
                original_confidence=self.confidence,
                clamped_to=_DEFAULT_CONFIDENCE_WHEN_EXTRACTED,
                # Campos de baja entropía (CIE-10, catálogo cerrado): hashear es
                # rainbow-table-reversible. Logueamos sólo presencia + longitud.
                procedure_name_present=self.extracted_procedure_name is not None,
                procedure_name_len=len(self.extracted_procedure_name or ""),
                procedure_code_present=self.extracted_procedure_code is not None,
                procedure_code_len=len(self.extracted_procedure_code or ""),
                diagnosis_code_present=self.extracted_diagnosis_code is not None,
                diagnosis_code_len=len(self.extracted_diagnosis_code or ""),
                reason="Vision LLM devolvió confidence muy baja pese a extraer campos",
            )
            # Usamos `object.__setattr__` deliberadamente (NO `self.confidence = X`):
            # robusto si alguien activa `validate_assignment=True` en el futuro
            # (que con `self.x =` causaría recursión infinita en este validator).
            # Ambos evaden re-validación con `validate_assignment=False` (default).
            object.__setattr__(self, "confidence", _DEFAULT_CONFIDENCE_WHEN_EXTRACTED)
        return self


@final
class PdfMedicalReportExtractor(MedicalReportExtractor):
    """Extractor de informes PDF vía `VisionExtractor.extract_structured`."""

    def __init__(
        self,
        vision: VisionExtractor,
        *,
        storage: FileStorage | None = None,
        text_pipeline: MedicalReportExtractor | None = None,
        try_structured_vision: bool = True,
    ) -> None:
        self._vision = vision
        self._storage = storage
        self._text_pipeline = text_pipeline
        self._try_structured_vision = try_structured_vision

    async def extract(self, report: MedicalReport) -> ExtractedMedicalReport:
        if report.format is not ReportFormat.PDF:
            raise ValidationError(
                f"PdfMedicalReportExtractor only handles ReportFormat.PDF, "
                f"got {report.format!r}. Use TextMedicalReportExtractor for text."
            )

        pdf_bytes = await self._resolve_bytes(report.content)

        if self._try_structured_vision:
            try:
                result = await self._vision.extract_structured(
                    pdf_bytes,
                    schema=_PdfExtractionSchema,
                    prompt=EXTRACTION_PROMPT,
                )
            except (NotImplementedError, VisionExtractionError):
                pass
            else:
                if result.confidence < _SUSPICIOUS_CONFIDENCE_THRESHOLD and any(
                    (
                        result.extracted_procedure_name,
                        result.extracted_procedure_code,
                        result.extracted_diagnosis_code,
                    )
                ):
                    _logger.info(
                        "llm.confidence_suspicious",
                        source="pdf_extractor.post_validate",
                        confidence=result.confidence,
                        # Solo presencia + longitud — el nombre del procedimiento
                        # es de catálogo cerrado (baja entropía), hashearlo no protege.
                        procedure_name_present=result.extracted_procedure_name is not None,
                        procedure_name_len=len(result.extracted_procedure_name or ""),
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

        return await self._extract_via_local_pdf_merged_hints_llm_or_fallback(
            report, pdf_bytes
        )

    async def _extract_via_local_pdf_merged_hints_llm_or_fallback(
        self,
        report: MedicalReport,
        pdf_bytes: bytes,
    ) -> ExtractedMedicalReport:
        """pypdf + hints → extractor de texto; sin pypdf o sin LLM → hints."""
        plain = ""
        try:
            from pre_autorizacion.shared.text_extraction.pdf_plain_text import (
                extract_plain_text_from_pdf,
            )
        except ModuleNotFoundError:
            plain = ""
        else:
            try:
                plain = extract_plain_text_from_pdf(pdf_bytes)
            except (ValueError, OSError):
                plain = ""

        merged = self._merged_pdf_text_and_hints(report, plain)
        merged_stripped = merged.strip()
        if (
            len(merged_stripped) >= _MIN_MERGED_TEXT_CHARS
            and self._text_pipeline is not None
        ):
            synthetic = MedicalReport(
                id=report.id,
                patient_id=report.patient_id,
                format=ReportFormat.TEXT,
                content=merged_stripped[:_MAX_TEXT_CHARS_FOR_LLM],
                submitted_at=report.submitted_at,
                procedure_solicited_hint=report.procedure_solicited_hint,
                diagnosis=report.diagnosis,
                attending_doctor=report.attending_doctor,
            )
            try:
                return await self._text_pipeline.extract(synthetic)
            except Exception:  # noqa: BLE001 — LLM no configurado o error de red.
                pass

        return self._fallback_from_hospital_hints(
            report,
            reason="sin visión IA: PDF sin texto útil (escaneo) o sin LLM de texto; usá hints del formulario",
        )

    @staticmethod
    def _merged_pdf_text_and_hints(report: MedicalReport, plain: str) -> str:
        """Combina datos del hospital con texto crudo del PDF (pypdf)."""
        lines: list[str] = []
        if report.procedure_solicited_hint and report.procedure_solicited_hint.strip():
            lines.append(
                "Procedimiento indicado por el hospital: "
                f"{report.procedure_solicited_hint.strip()}"
            )
        if report.diagnosis and report.diagnosis.strip():
            lines.append(f"Diagnóstico indicado por el hospital: {report.diagnosis.strip()}")
        head = "\n".join(lines)
        body = plain.strip()
        if head and body:
            return f"{head}\n\n--- Texto extraído del PDF ---\n{body}"
        return head or body

    @staticmethod
    def _fallback_from_hospital_hints(report: MedicalReport, *, reason: str) -> ExtractedMedicalReport:
        """Sin visión IA: usa hints del hospital para no cortar el flujo (demo / sin $).

        Sirve si no hay `GOOGLE_API_KEY`, si la cuota de Gemini se agotó (429),
        o cualquier política que evite llamadas a visión.
        """
        proc = (report.procedure_solicited_hint or "").strip() or None
        dx = (report.diagnosis or "").strip() or None
        quotes: list[str] = []
        if proc:
            quotes.append(f"({reason}) procedimiento indicado por el hospital: {proc}")
        if dx:
            quotes.append(f"({reason}) diagnóstico indicado por el hospital: {dx}")
        if not quotes:
            quotes.append(f"({reason}) sin hints del hospital en el informe.")
        return ExtractedMedicalReport(
            extracted_procedure_name=proc,
            extracted_procedure_code=None,
            extracted_diagnosis_code=None,
            extracted_diagnosis_description=dx,
            confidence=0.35,
            evidence_quotes=tuple(quotes),
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
