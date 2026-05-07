"""Adapters concretos de `MedicalReportExtractor`."""

from pre_autorizacion.features.authorization_cases.infrastructure.extractors.pdf_extractor import (
    PdfMedicalReportExtractor,
)
from pre_autorizacion.features.authorization_cases.infrastructure.extractors.text_extractor import (
    TextMedicalReportExtractor,
)

__all__ = ["PdfMedicalReportExtractor", "TextMedicalReportExtractor"]
