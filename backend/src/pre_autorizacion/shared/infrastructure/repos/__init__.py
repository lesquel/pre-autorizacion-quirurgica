"""Adapters compartidos de repos cross-feature (Patient).

Sigue el mismo patrón que `features/policies/infrastructure/repos/`:
import lazy del adapter Notion vía PEP 562 (`__getattr__`) para evitar
deadlocks de import en `uvicorn --reload`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pre_autorizacion.shared.infrastructure.repos.in_memory_patient import (
    InMemoryPatientRepository,
)

if TYPE_CHECKING:
    from pre_autorizacion.shared.infrastructure.repos.notion_patient import (
        NotionPatientRepository,
    )

__all__ = [
    "InMemoryPatientRepository",
    "NotionPatientRepository",
]


def __getattr__(name: str) -> object:
    if name == "NotionPatientRepository":
        from pre_autorizacion.shared.infrastructure.repos.notion_patient import (
            NotionPatientRepository as _Cls,
        )

        return _Cls
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
