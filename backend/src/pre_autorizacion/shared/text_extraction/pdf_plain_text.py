"""Extracción local de texto desde PDF (sin APIs de visión).

Usa `pypdf` sobre el stream de bytes. Sirve para PDFs con texto embebido;
**no** reemplaza OCR en escaneos casi sólo imagen (ahí seguirá poco texto).

Alternativas más pesadas (p. ej. MarkItDown de Microsoft) pueden aportar
mejor normalización a Markdown; para este MVP `pypdf` + pipeline de texto
LLM alcanza y mantiene dependencias acotadas.
"""

from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


def extract_plain_text_from_pdf(pdf_bytes: bytes) -> str:
    """Devuelve texto plano concatenando todas las páginas.

    Raises:
        ValueError: si los bytes no son un PDF legible por pypdf.
    """
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as exc:  # noqa: BLE001 — pypdf no expone jerarquía estable.
        raise ValueError(f"PDF no legible: {exc}") from exc

    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text and text.strip():
            parts.append(text.strip())
    return "\n\n".join(parts).strip()


__all__ = ["extract_plain_text_from_pdf"]
