"""Adapters concretos de `LLMProvider`.

Wave B3:
- `DeepSeekLLMAdapter` — default v1, usa la API OpenAI-compatible de DeepSeek.
"""

from pre_autorizacion.shared.llm.adapters.deepseek_adapter import DeepSeekLLMAdapter

__all__ = ["DeepSeekLLMAdapter"]
