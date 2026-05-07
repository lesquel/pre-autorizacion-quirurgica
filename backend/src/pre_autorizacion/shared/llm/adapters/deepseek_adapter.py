"""DeepSeekLLMAdapter — adapter de `LLMProvider` para DeepSeek.

DeepSeek expone una API OpenAI-compatible, así que este adapter reusa
`langchain_openai.ChatOpenAI` apuntando al `base_url` del proveedor. Eso nos
da `complete()` (chat) y `complete_structured()` (structured output) sin
mantener un cliente HTTP propio.

Decisiones:
- Structured output via `method="json_mode"`. DeepSeek soporta JSON mode pero
  NO soporta el `response_format={type:"json_schema"}` nativo de OpenAI; con
  `json_mode` le pedimos sólo JSON válido y `langchain` valida contra el schema
  Pydantic localmente. Funciona también con OpenAI por compat.
- Wrap de cualquier `openai.APIError` o `httpx.HTTPError` en `LLMError`.
- `temperature=0.0` por default para outputs deterministas (importante en
  decisiones médicas auditables).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, TypeVar, cast, final

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from openai import APIError

from pre_autorizacion.shared.llm.errors import LLMError
from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider

if TYPE_CHECKING:
    from langchain_core.messages import BaseMessage
    from pydantic import BaseModel

T = TypeVar("T", bound="BaseModel")

PROVIDER_NAME: Final[str] = "deepseek"


@final
class DeepSeekLLMAdapter(LLMProvider):
    """Adapter de `LLMProvider` para DeepSeek (OpenAI-compatible)."""

    def __init__(
        self,
        api_key: str,
        *,
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com",
        timeout: float = 60.0,
    ) -> None:
        if not api_key:
            raise ValueError("DeepSeekLLMAdapter requires a non-empty api_key.")
        self._model_name = model
        self._client = ChatOpenAI(
            model=model,
            openai_api_key=api_key,
            openai_api_base=base_url,
            timeout=timeout,
        )

    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.0,
        max_tokens: int | None = None,
    ) -> str:
        messages: list[BaseMessage] = []
        if system:
            messages.append(SystemMessage(content=system))
        messages.append(HumanMessage(content=prompt))

        try:
            response = await self._client.ainvoke(
                messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except (APIError, httpx.HTTPError) as exc:
            raise LLMError(
                f"DeepSeek completion failed: {exc}",
                provider=PROVIDER_NAME,
                model=self._model_name,
                cause=exc,
            ) from exc

        # `response.content` puede ser str | list[str | dict]; en chat normal
        # es str. Lo normalizamos defensivamente.
        content = response.content
        if isinstance(content, str):
            return content
        # Lista de bloques → concatenamos los que sean texto.
        return "".join(part for part in content if isinstance(part, str))

    async def complete_structured(
        self,
        prompt: str,
        *,
        schema: type[T],
        system: str | None = None,
        temperature: float = 0.0,
    ) -> T:
        messages: list[BaseMessage] = []
        if system:
            messages.append(SystemMessage(content=system))
        messages.append(HumanMessage(content=prompt))

        # `json_mode` es lo que DeepSeek soporta; langchain valida el output
        # contra el Pydantic schema localmente.
        structured = self._client.with_structured_output(schema, method="json_mode")

        try:
            result = await structured.ainvoke(messages, temperature=temperature)
        except (APIError, httpx.HTTPError) as exc:
            raise LLMError(
                f"DeepSeek structured completion failed: {exc}",
                provider=PROVIDER_NAME,
                model=self._model_name,
                cause=exc,
            ) from exc

        # `with_structured_output(schema)` devuelve `dict | BaseModel`. Cuando
        # pasamos una clase Pydantic devuelve esa instancia; el cast satisface
        # mypy strict sin mentirle al runtime.
        return cast("T", result)


__all__ = ["DeepSeekLLMAdapter"]
