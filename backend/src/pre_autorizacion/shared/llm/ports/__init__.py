"""Ports compartidos del subsistema LLM (texto).

Re-exporta el contrato puro `LLMProvider` que los features consumen.
Los adapters concretos viven en `shared/llm/adapters/` y se enchufan vía DI.
"""

from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider

__all__ = ["LLMProvider"]
