"""Adapters in-memory del slice authorization_cases.

El adapter Notion vive en `infrastructure/persistence/notion/` por separado
porque Notion es la persistencia primaria del MVP — no merece la simetría
de carpetas con el fallback.
"""

from pre_autorizacion.features.authorization_cases.infrastructure.repos.in_memory_case import (
    InMemoryCaseRepository,
)

__all__ = ["InMemoryCaseRepository"]
