"""Adapters de los repos de policies (Notion + InMemory fallback).

Los adapters Notion se cargan con ``__getattr__`` (PEP 562) para evitar
``_ModuleLock`` / deadlocks cuando ``uvicorn --reload`` importa el paquete
desde varios hilos al mismo tiempo que ``config.di`` hace imports perezosos.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pre_autorizacion.features.policies.infrastructure.repos.in_memory_coverage import (
    InMemoryCoverageRepository,
)
from pre_autorizacion.features.policies.infrastructure.repos.in_memory_insurer import (
    InMemoryInsurerRepository,
)
from pre_autorizacion.features.policies.infrastructure.repos.in_memory_policy import (
    InMemoryPolicyRepository,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.infrastructure.repos.notion_coverage import (
        NotionCoverageRepository,
    )
    from pre_autorizacion.features.policies.infrastructure.repos.notion_insurer import (
        NotionInsurerRepository,
    )
    from pre_autorizacion.features.policies.infrastructure.repos.notion_policy import (
        NotionPolicyRepository,
    )

__all__ = [
    "InMemoryCoverageRepository",
    "InMemoryInsurerRepository",
    "InMemoryPolicyRepository",
    "NotionCoverageRepository",
    "NotionInsurerRepository",
    "NotionPolicyRepository",
]


def __getattr__(name: str) -> object:
    if name == "NotionCoverageRepository":
        from pre_autorizacion.features.policies.infrastructure.repos.notion_coverage import (
            NotionCoverageRepository as _Cls,
        )

        return _Cls
    if name == "NotionInsurerRepository":
        from pre_autorizacion.features.policies.infrastructure.repos.notion_insurer import (
            NotionInsurerRepository as _Cls,
        )

        return _Cls
    if name == "NotionPolicyRepository":
        from pre_autorizacion.features.policies.infrastructure.repos.notion_policy import (
            NotionPolicyRepository as _Cls,
        )

        return _Cls
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
