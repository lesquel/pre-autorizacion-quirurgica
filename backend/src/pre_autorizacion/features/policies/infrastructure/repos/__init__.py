"""Adapters de los repos de policies (Notion + InMemory fallback)."""

from pre_autorizacion.features.policies.infrastructure.repos.in_memory_coverage import (
    InMemoryCoverageRepository,
)
from pre_autorizacion.features.policies.infrastructure.repos.in_memory_insurer import (
    InMemoryInsurerRepository,
)
from pre_autorizacion.features.policies.infrastructure.repos.in_memory_policy import (
    InMemoryPolicyRepository,
)
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
