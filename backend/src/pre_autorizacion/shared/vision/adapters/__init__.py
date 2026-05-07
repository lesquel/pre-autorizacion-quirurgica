"""Adapters concretos de `VisionExtractor`.

Wave B3:
- `GeminiVisionAdapter` — default v1, usa `langchain-google-genai`.
"""

from pre_autorizacion.shared.vision.adapters.gemini_adapter import GeminiVisionAdapter

__all__ = ["GeminiVisionAdapter"]
