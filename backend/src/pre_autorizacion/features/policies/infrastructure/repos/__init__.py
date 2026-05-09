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
    # Evitamos aliasar el import a un nombre local compartido (`_Cls`) entre
    # branches: mypy infería `_Cls` como el tipo de la primera rama y se
    # quejaba en las siguientes con `[assignment]`. Devolvemos el símbolo
    # importado directamente — un retorno por rama, sin estado compartido.
    if name == "NotionCoverageRepository":
        from pre_autorizacion.features.policies.infrastructure.repos.notion_coverage import (
            NotionCoverageRepository,
        )

        return NotionCoverageRepository
    if name == "NotionInsurerRepository":
        from pre_autorizacion.features.policies.infrastructure.repos.notion_insurer import (
            NotionInsurerRepository,
        )

        return NotionInsurerRepository
    if name == "NotionPolicyRepository":
        from pre_autorizacion.features.policies.infrastructure.repos.notion_policy import (
            NotionPolicyRepository,
        )

        return NotionPolicyRepository
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
