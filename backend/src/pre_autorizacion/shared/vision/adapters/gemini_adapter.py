"""GeminiVisionAdapter — adapter de `VisionExtractor` para Gemini.

DeepSeek no acepta imágenes / PDFs (PRD §3.1.4); Gemini sí, y soporta el PDF
como input multimodal nativo (sin OCR previo). Este adapter es el default v1
para `VisionExtractor`.

Decisiones:
- Formato del PDF: bloque multimodal `{"type": "media", "mime_type": ..., "data": <b64>}`
  dentro de un `HumanMessage`. Es el formato que `langchain-google-genai`
  acepta para inline data; Gemini procesa el PDF nativamente sin OCR.
- Wrap de cualquier excepción (httpx, google api errors, validación) en
  `VisionExtractionError` para que el agente pueda escalar el caso con razón
  clara (`PDF_EXTRACTION_FAILURE`).
- `with_structured_output(schema)` para `extract_structured` — Gemini soporta
  `json_schema` nativo y langchain devuelve la instancia Pydantic validada.
"""

from __future__ import annotations

import base64
from typing import TYPE_CHECKING, Final, TypeVar, cast, final

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from pre_autorizacion.shared.vision.ports.vision_extractor import (
    VisionExtractionError,
    VisionExtractor,
)

if TYPE_CHECKING:
    from langchain_core.messages import BaseMessage
    from pydantic import BaseModel

T = TypeVar("T", bound="BaseModel")

PROVIDER_NAME: Final[str] = "gemini"
DEFAULT_PROMPT: Final[str] = (
    "Extraé el texto completo de este documento médico, preservando estructura "
    "y secciones (encabezado, paciente, antecedentes, diagnóstico, "
    "procedimiento solicitado, indicaciones). Devolvé sólo texto plano."
)


@final
class GeminiVisionAdapter(VisionExtractor):
    """Adapter de `VisionExtractor` para Gemini (langchain-google-genai)."""

    def __init__(
        self,
        api_key: str,
        *,
        model: str = "gemini-2.5-flash",
        timeout: float = 60.0,
    ) -> None:
        if not api_key:
            raise ValueError("GeminiVisionAdapter requires a non-empty api_key.")
        self._model_name = model
        self._client = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            timeout=timeout,
        )

    @staticmethod
    def _build_message(pdf_bytes: bytes, prompt: str) -> HumanMessage:
        """Arma el `HumanMessage` multimodal con el PDF inline (base64) + prompt."""
        if not pdf_bytes:
            raise VisionExtractionError("Empty PDF bytes — nothing to extract.")
        encoded = base64.b64encode(pdf_bytes).decode("ascii")
        # Formato `media` con mime_type es el inline data que langchain-google-genai
        # convierte al `inlineData` del SDK de google.generativeai.
        return HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {
                    "type": "media",
                    "mime_type": "application/pdf",
                    "data": encoded,
                },
            ]
        )

    async def extract_from_pdf(
        self,
        pdf_bytes: bytes,
        *,
        prompt: str | None = None,
    ) -> str:
        message = self._build_message(pdf_bytes, prompt or DEFAULT_PROMPT)
        messages: list[BaseMessage] = [message]

        try:
            response = await self._client.ainvoke(messages)
        except VisionExtractionError:
            raise
        except Exception as exc:  # noqa: BLE001 — wrap de proveedor externo.
            raise VisionExtractionError(
                f"Gemini PDF extraction failed: {exc}",
            ) from exc

        content = response.content
        if isinstance(content, str):
            return content
        return "".join(part for part in content if isinstance(part, str))

    async def extract_structured(
        self,
        pdf_bytes: bytes,
        *,
        schema: type[T],
        prompt: str | None = None,
    ) -> T:
        message = self._build_message(pdf_bytes, prompt or DEFAULT_PROMPT)
        messages: list[BaseMessage] = [message]

        structured = self._client.with_structured_output(schema)

        try:
            result = await structured.ainvoke(messages)
        except VisionExtractionError:
            raise
        except Exception as exc:  # noqa: BLE001 — wrap de proveedor externo.
            raise VisionExtractionError(
                f"Gemini structured extraction failed: {exc}",
            ) from exc

        return cast("T", result)


__all__ = ["GeminiVisionAdapter"]
