"""Ports del slice `policies/domain`.

Re-exporta los 3 repositorios del feature (read-only en MVP).
Adapters concretos viven en `features/policies/infrastructure/repos/`.
"""

from pre_autorizacion.features.policies.domain.ports.coverage_repository import (
    CoverageRepository,
)
from pre_autorizacion.features.policies.domain.ports.insurer_repository import (
    InsurerRepository,
)
from pre_autorizacion.features.policies.domain.ports.policy_repository import (
    PolicyRepository,
)

__all__ = [
    "CoverageRepository",
    "InsurerRepository",
    "PolicyRepository",
]
