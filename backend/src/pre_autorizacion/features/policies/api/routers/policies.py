"""Router FastAPI del feature `policies`.

Endpoints (PRD §4.3.2):
- `GET /api/v1/policies`              → list[PolicyOut].
- `GET /api/v1/policies/{number}`     → PolicyOut.
- `GET /api/v1/policies/{number}/coverages` → list[CoverageOut].
- `GET /api/v1/coverages`             → list[CoverageOut] (filtrable).
- `GET /api/v1/insurers`              → list[InsurerOut].
- `GET /api/v1/dashboard/metrics`     → DashboardMetricsOut (insurer-only).

MVP: NO endpoints CRUD — todos read-only. Crear/editar pólizas en v2.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from pre_autorizacion.features.auth.domain.entities import Role, User
from pre_autorizacion.features.policies.api.schemas.policies import (
    CoverageOut,
    DashboardMetricsOut,
    InsurerOut,
    PolicyOut,
    coverage_to_out,
    insurer_to_out,
    metrics_to_out,
    policy_to_out,
)
from pre_autorizacion.features.policies.application.use_cases import (
    GetDashboardMetricsUseCase,
    GetPolicyUseCase,
    ListCoveragesUseCase,
    ListInsurersUseCase,
    ListPoliciesUseCase,
)
from pre_autorizacion.shared.api.deps import (
    CaseRepositoryDep,
    CoverageRepositoryDep,
    InsurerRepositoryDep,
    PolicyRepositoryDep,
    require_authenticated,
    require_role,
)

router = APIRouter(prefix="/api/v1", tags=["policies"])


# ── Helpers de DI para use cases ──────────────────────────────────────────


def _get_list_policies(repo: PolicyRepositoryDep) -> ListPoliciesUseCase:
    return ListPoliciesUseCase(policy_repository=repo)


def _get_get_policy(repo: PolicyRepositoryDep) -> GetPolicyUseCase:
    return GetPolicyUseCase(policy_repository=repo)


def _get_list_coverages(repo: CoverageRepositoryDep) -> ListCoveragesUseCase:
    return ListCoveragesUseCase(coverage_repository=repo)


def _get_list_insurers(repo: InsurerRepositoryDep) -> ListInsurersUseCase:
    return ListInsurersUseCase(insurer_repository=repo)


def _get_metrics(repo: CaseRepositoryDep) -> GetDashboardMetricsUseCase:
    return GetDashboardMetricsUseCase(case_repository=repo)


ListPoliciesDep = Annotated[ListPoliciesUseCase, Depends(_get_list_policies)]
GetPolicyDep = Annotated[GetPolicyUseCase, Depends(_get_get_policy)]
ListCoveragesDep = Annotated[ListCoveragesUseCase, Depends(_get_list_coverages)]
ListInsurersDep = Annotated[ListInsurersUseCase, Depends(_get_list_insurers)]
DashboardMetricsDep = Annotated[GetDashboardMetricsUseCase, Depends(_get_metrics)]


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.get(
    "/policies",
    response_model=list[PolicyOut],
    summary="List policies",
)
async def list_policies(
    use_case: ListPoliciesDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> list[PolicyOut]:
    """Listado completo del catálogo de pólizas (read-only en MVP)."""
    policies = await use_case.execute()
    return [policy_to_out(p) for p in policies]


@router.get(
    "/policies/{number}",
    response_model=PolicyOut,
    summary="Get a policy by number",
)
async def get_policy(
    number: str,
    use_case: GetPolicyDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> PolicyOut:
    """Detalle de una póliza por su número. 404 si no existe."""
    policy = await use_case.execute(number)
    return policy_to_out(policy)


@router.get(
    "/policies/{number}/coverages",
    response_model=list[CoverageOut],
    summary="List coverages for a specific policy",
)
async def list_coverages_for_policy(
    number: str,
    use_case: ListCoveragesDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> list[CoverageOut]:
    """Listado de coberturas de la póliza `number`."""
    coverages = await use_case.execute(policy_number=number)
    return [coverage_to_out(c) for c in coverages]


@router.get(
    "/coverages",
    response_model=list[CoverageOut],
    summary="List coverages",
)
async def list_coverages(
    use_case: ListCoveragesDep,
    _user: Annotated[User, Depends(require_authenticated)],
    policy_number: Annotated[
        str | None,
        Query(alias="policyNumber", description="Filtro opcional por número de póliza."),
    ] = None,
) -> list[CoverageOut]:
    """Listado de coberturas. Si `policyNumber` viene, filtra por esa póliza."""
    coverages = await use_case.execute(policy_number=policy_number)
    return [coverage_to_out(c) for c in coverages]


@router.get(
    "/insurers",
    response_model=list[InsurerOut],
    summary="List insurers",
)
async def list_insurers(
    use_case: ListInsurersDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> list[InsurerOut]:
    """Listado del catálogo de aseguradoras."""
    insurers = await use_case.execute()
    return [insurer_to_out(i) for i in insurers]


@router.get(
    "/dashboard/metrics",
    response_model=DashboardMetricsOut,
    summary="Get dashboard KPIs (insurer-only)",
)
async def get_dashboard_metrics(
    use_case: DashboardMetricsDep,
    _user: Annotated[User, Depends(require_role(Role.INSURER))],
) -> DashboardMetricsOut:
    """KPIs agregados para la vista de aseguradora.

    Restringido a `Role.INSURER` — el hospital no necesita estos KPIs y el
    auditor tiene su propia bandeja de trabajo.
    """
    metrics = await use_case.execute()
    return metrics_to_out(metrics)


__all__ = ["router"]
