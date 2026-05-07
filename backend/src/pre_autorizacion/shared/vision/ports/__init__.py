"""Ports compartidos del subsistema de visión (PDFs / imágenes).

Re-exporta el contrato `VisionExtractor` y la excepción de dominio
`VisionExtractionError`. Los adapters viven en `shared/vision/adapters/`.
"""

from pre_autorizacion.shared.vision.ports.vision_extractor import (
    VisionExtractionError,
    VisionExtractor,
)

__all__ = [
    "VisionExtractionError",
    "VisionExtractor",
]
