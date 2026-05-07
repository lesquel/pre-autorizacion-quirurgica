"""LLMProvider — port low-level que abstrae la llamada a un LLM de texto.

PRD §3.1.4 — Patrón de desacople LLM y Vision.

Adapters previstos en `shared/llm/adapters/`:
- `DeepSeekLLMAdapter` (default v1)
- `OpenAILLMAdapter`
- `GeminiLLMAdapter`
- `AnthropicLLMAdapter`

El dominio NO conoce a ninguno de estos adapters — sólo este contrato puro.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, TypeVar

if TYPE_CHECKING:
    # Pydantic vive en infraestructura, NO en el dominio. Sin embargo el bound
    # del TypeVar lo necesitamos para que mypy valide que `schema` es un modelo
    # Pydantic. Lo importamos sólo en tiempo de chequeo de tipos para no
    # introducir dependencia runtime.
    from pydantic import BaseModel

T = TypeVar("T", bound="BaseModel")


class LLMProvider(ABC):
    """Port low-level que abstrae la llamada a un LLM de texto.

    Implementaciones concretas viven en `shared/llm/adapters/` y se inyectan
    vía DI en el composition root (`config/di.py`). El feature consume sólo
    este contrato — swap de proveedor sin tocar dominio ni use cases.
    """

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.0,
        max_tokens: int | None = None,
    ) -> str:
        """Completion simple de texto.

        Args:
            prompt: prompt principal del usuario.
            system: system prompt opcional (rol / instrucciones globales).
            temperature: 0.0 = determinístico; subir sólo si se necesita creatividad.
            max_tokens: límite duro de tokens del output. `None` deja el default del adapter.

        Returns:
            El texto generado por el LLM.

        Raises:
            LLMProviderError: si la llamada al proveedor falla irrecuperablemente.
        """

    @abstractmethod
    async def complete_structured(
        self,
        prompt: str,
        *,
        schema: type[T],
        system: str | None = None,
        temperature: float = 0.0,
    ) -> T:
        """Completion con structured output validado por un schema Pydantic.

        El adapter debe instruir al LLM (via tool calling, JSON mode, o lo que
        soporte el proveedor) para que devuelva un objeto que cumpla `schema`,
        y validar el resultado antes de devolverlo.

        Args:
            prompt: prompt principal del usuario.
            schema: clase Pydantic v2 (`BaseModel`) que describe el shape esperado.
            system: system prompt opcional.
            temperature: 0.0 recomendado para outputs estructurados.

        Returns:
            Una instancia válida de `schema`.

        Raises:
            LLMProviderError: si la llamada falla o el output no respeta el schema.
        """
