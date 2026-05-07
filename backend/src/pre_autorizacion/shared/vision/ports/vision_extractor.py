"""VisionExtractor — port low-level que abstrae extracción desde PDFs / imágenes.

PRD §3.1.4 — Patrón de desacople LLM y Vision.

DeepSeek (LLM default) NO acepta imágenes; por eso vision vive en su propio port,
con su propia familia de adapters intercambiables:
- `GeminiVisionAdapter` (default candidato v1)
- `AnthropicVisionAdapter`
- `OpenAIVisionAdapter`
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, TypeVar

if TYPE_CHECKING:
    from pydantic import BaseModel

T = TypeVar("T", bound="BaseModel")


class VisionExtractionError(Exception):
    """Falla al extraer texto / datos desde un PDF o imagen.

    Lanzada por implementaciones de `VisionExtractor` cuando el documento es
    ilegible, está corrupto, o el proveedor de visión no responde. El agente
    captura este error y escala el caso (PRD §5.2: "Vision API mala extracción
    de PDFs escaneados → ESCALATE con razón clara").
    """


class VisionExtractor(ABC):
    """Port low-level que abstrae la extracción de texto / datos desde PDFs e imágenes.

    El dominio sólo depende de este contrato; los adapters concretos viven en
    `shared/vision/adapters/` y se inyectan vía DI en `config/di.py`.
    """

    @abstractmethod
    async def extract_from_pdf(
        self,
        pdf_bytes: bytes,
        *,
        prompt: str | None = None,
    ) -> str:
        """Extrae texto plano del PDF.

        Args:
            pdf_bytes: contenido binario del PDF.
            prompt: instrucción opcional para guiar al modelo de visión
                (por ejemplo, "extrae solo procedimiento y diagnóstico").

        Returns:
            Texto plano extraído del documento.

        Raises:
            VisionExtractionError: si la extracción falla o el PDF es ilegible.
        """

    @abstractmethod
    async def extract_structured(
        self,
        pdf_bytes: bytes,
        *,
        schema: type[T],
        prompt: str | None = None,
    ) -> T:
        """Extrae datos estructurados del PDF según un schema Pydantic.

        Args:
            pdf_bytes: contenido binario del PDF.
            schema: clase Pydantic v2 que describe el shape esperado.
            prompt: instrucción opcional adicional para el modelo de visión.

        Returns:
            Instancia válida de `schema`.

        Raises:
            VisionExtractionError: si la extracción falla o el output no
                respeta el schema.
        """
