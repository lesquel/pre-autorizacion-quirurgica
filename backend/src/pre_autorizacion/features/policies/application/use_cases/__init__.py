"""Use cases del slice `policies/application`."""

from pre_autorizacion.features.policies.application.use_cases.create_policy import (
    CreatePolicyUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.delete_policy import (
    DeletePolicyUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.get_dashboard_metrics import (
    DashboardMetrics,
    GetDashboardMetricsUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.get_policy import (
    GetPolicyUseCase,
)
from pre_autorizacion.features.policies.domain import PolicyNotFoundError
from pre_autorizacion.features.policies.application.use_cases.list_coverages import (
    ListCoveragesUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.list_insurers import (
    ListInsurersUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.list_policies import (
    ListPoliciesUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.replace_policy_coverages import (
    ReplacePolicyCoveragesUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.update_policy import (
    UpdatePolicyUseCase,
)

__all__ = [
    "CreatePolicyUseCase",
    "DashboardMetrics",
    "DeletePolicyUseCase",
    "GetDashboardMetricsUseCase",
    "GetPolicyUseCase",
    "ListCoveragesUseCase",
    "ListInsurersUseCase",
    "ListPoliciesUseCase",
    "PolicyNotFoundError",
    "ReplacePolicyCoveragesUseCase",
    "UpdatePolicyUseCase",
]
