"""Errores de la capa LLM (cross-feature).

Mapean a `IntegrationError` (502 / Problem Details) — el LLM es un sistema
externo y cualquier falla del proveedor debe propagarse como integración rota,
no como error de dominio.
"""

from __future__ import annotations

from pre_autorizacion.shared.domain.errors import IntegrationError


class LLMError(IntegrationError):
    """Falla irrecuperable de un `LLMProvider`.

    Wrap de excepciones de bajo nivel (httpx, openai, validación de schema)
    para que la capa de dominio sólo dependa del jerarca `IntegrationError`.

    Atributos:
        provider: nombre lógico del proveedor (`"deepseek"`, `"openai"`, ...).
        model: id del modelo que falló (`"deepseek-chat"`, `"gpt-4o"`, ...).
        cause: excepción original capturada (opcional, útil para logging).
    """

    title = "LLM provider error"
    type_uri = "https://pre-autorizacion.dev/errors/llm-provider"

    def __init__(
        self,
        detail: str = "",
        *,
        provider: str | None = None,
        model: str | None = None,
        cause: Exception | None = None,
    ) -> None:
        super().__init__(detail)
        self.provider = provider
        self.model = model
        self.cause = cause


__all__ = ["LLMError"]
