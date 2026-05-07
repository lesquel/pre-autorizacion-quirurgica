"""Router FastAPI del feature `authorization_cases`.

Endpoints (PRD §4.3.2):
- `POST /api/v1/cases`               → 202 + CaseOut. Hospital crea + agente decide.
- `GET  /api/v1/cases`                → list[CaseOut] filtrable por role/status.
- `GET  /api/v1/cases/{case_id}`      → CaseOut.
- `GET  /api/v1/cases/{case_id}/trace`→ CaseTraceOut.
- `POST /api/v1/cases/{case_id}/resolve` → CaseOut (auditor only).

Autenticación: TODOS los endpoints exigen JWT vía `Depends(require_authenticated)`
(o `require_role(...)` para los que dependen de rol).

DI: los use cases se construyen acá usando los repos inyectados por `shared/api/deps.py`.
Manteniendo la regla: routers NO usan `Depends` adentro de use cases — los use cases
son agnósticos a FastAPI.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from pre_autorizacion.features.auth.domain.entities import Role, User
from pre_autorizacion.features.authorization_cases.api.schemas.cases import (
    CaseOut,
    CaseSubmitIn,
    CaseTraceOut,
    ResolveCaseIn,
    case_to_out,
    case_trace_to_out,
    medical_report_in_to_domain,
)
from pre_autorizacion.features.authorization_cases.application.use_cases import (
    GetCaseByIdUseCase,
    ListCasesFilter,
    ListCasesUseCase,
    ResolveCaseInput,
    ResolveCaseUseCase,
    SubmitCaseInput,
    SubmitCaseUseCase,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects import CaseStatus
from pre_autorizacion.shared.api.deps import (
    CaseRepositoryDep,
    CoverageRepositoryDep,
    PolicyRepositoryDep,
    require_authenticated,
    require_role,
)

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])


# ── Helpers de DI para use cases ──────────────────────────────────────────


def _get_submit_use_case(
    case_repo: CaseRepositoryDep,
    policy_repo: PolicyRepositoryDep,
    coverage_repo: CoverageRepositoryDep,
) -> SubmitCaseUseCase:
    """Arma el use case `SubmitCaseUseCase` (mock decision flow en MVP)."""
    return SubmitCaseUseCase(
        case_repository=case_repo,
        policy_repository=policy_repo,
        coverage_repository=coverage_repo,
        agent_orchestrator=None,  # TODO B3: inyectar el adapter LangGraph.
    )


def _get_list_use_case(case_repo: CaseRepositoryDep) -> ListCasesUseCase:
    return ListCasesUseCase(case_repository=case_repo)


def _get_by_id_use_case(case_repo: CaseRepositoryDep) -> GetCaseByIdUseCase:
    return GetCaseByIdUseCase(case_repository=case_repo)


def _get_resolve_use_case(case_repo: CaseRepositoryDep) -> ResolveCaseUseCase:
    return ResolveCaseUseCase(case_repository=case_repo)


SubmitUseCaseDep = Annotated[SubmitCaseUseCase, Depends(_get_submit_use_case)]
ListUseCaseDep = Annotated[ListCasesUseCase, Depends(_get_list_use_case)]
GetByIdUseCaseDep = Annotated[GetCaseByIdUseCase, Depends(_get_by_id_use_case)]
ResolveUseCaseDep = Annotated[ResolveCaseUseCase, Depends(_get_resolve_use_case)]


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=CaseOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a new authorization case",
)
async def submit_case(
    body: CaseSubmitIn,
    use_case: SubmitUseCaseDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> CaseOut:
    """Crea un caso de autorización y dispara el flow de decisión.

    En MVP el flow MOCK (rule engine determinístico) corre síncrono y
    devuelve el caso decidido. En producción (B3) se devolvería 202 con
    `status=PENDIENTE` y la decisión llegaría por SSE.
    """
    report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
    domain_report = medical_report_in_to_domain(
        body.report,
        report_id=report_id,
        submitted_at=datetime.now(UTC),
    )
    use_case_input = SubmitCaseInput(
        report=domain_report,
        policy_number=body.policy_number,
        scenario_key=body.scenario_key,
    )
    case = await use_case.execute(use_case_input)
    return case_to_out(case)


@router.get(
    "",
    response_model=list[CaseOut],
    summary="List authorization cases",
)
async def list_cases(
    use_case: ListUseCaseDep,
    user: Annotated[User, Depends(require_authenticated)],
    case_status: Annotated[
        CaseStatus | None,
        Query(alias="status", description="Filtro por status del caso."),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[CaseOut]:
    """Lista paginada de casos visibles para el rol del usuario.

    El rol se extrae del JWT (no del query string) para evitar escalada de
    privilegios — un hospital nunca puede pedir vista de auditor.
    """
    filter_ = ListCasesFilter(
        role=user.role,
        status=case_status,
        limit=limit,
        offset=offset,
    )
    cases = await use_case.execute(filter_)
    return [case_to_out(c) for c in cases]


@router.get(
    "/{case_id}",
    response_model=CaseOut,
    summary="Get a case by id",
)
async def get_case(
    case_id: str,
    use_case: GetByIdUseCaseDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> CaseOut:
    """Detalle de un caso. 404 si no existe."""
    case = await use_case.execute(case_id)
    return case_to_out(case)


@router.get(
    "/{case_id}/trace",
    response_model=CaseTraceOut,
    summary="Get the agent trace for a case",
)
async def get_case_trace(
    case_id: str,
    use_case: GetByIdUseCaseDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> CaseTraceOut:
    """Traza completa del agente para el caso. 404 si no existe."""
    case = await use_case.execute(case_id)
    return case_trace_to_out(case)


@router.post(
    "/{case_id}/resolve",
    response_model=CaseOut,
    summary="Resolve an escalated case (auditor only)",
)
async def resolve_case(
    case_id: str,
    body: ResolveCaseIn,
    use_case: ResolveUseCaseDep,
    _user: Annotated[User, Depends(require_role(Role.AUDITOR))],
) -> CaseOut:
    """El auditor cierra un caso escalado.

    Solo accesible para `Role.AUDITOR`. La decisión queda registrada con
    `decided_by=AUDITOR`, `confidence=1.0`, `outcome=DECIDED`.
    """
    use_case_input = ResolveCaseInput(
        case_id=case_id,
        outcome=body.outcome,
        message=body.message,
        reasoning=body.reasoning,
    )
    case = await use_case.execute(use_case_input)
    return case_to_out(case)


__all__ = ["router"]
