"""Adapters del repo de procedimientos (Notion + InMemory fallback).

Sigue el patrón de `features/policies/infrastructure/repos/`: import lazy
del adapter Notion vía PEP 562 (`__getattr__`).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pre_autorizacion.features.procedures.infrastructure.repos.in_memory_procedure import (
    InMemoryProcedureRepository,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.procedures.infrastructure.repos.notion_procedure import (
        NotionProcedureRepository,
    )

__all__ = [
    "InMemoryProcedureRepository",
    "NotionProcedureRepository",
]


def __getattr__(name: str) -> object:
    if name == "NotionProcedureRepository":
        from pre_autorizacion.features.procedures.infrastructure.repos.notion_procedure import (
            NotionProcedureRepository as _Cls,
        )

        return _Cls
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
