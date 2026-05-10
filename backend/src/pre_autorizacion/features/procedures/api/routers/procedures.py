"""Router FastAPI del feature `procedures`."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status

from pre_autorizacion.features.auth.domain.entities import User
from pre_autorizacion.features.procedures.api.schemas import (
    ProcedureIn,
    ProcedureOut,
    procedure_in_to_domain,
    procedure_to_out,
)
from pre_autorizacion.features.procedures.application.use_cases import (
    CreateProcedureUseCase,
    DeleteProcedureUseCase,
    ListProceduresUseCase,
    UpdateProcedureUseCase,
)
from pre_autorizacion.shared.api.deps import ProcedureRepositoryDep, require_authenticated

router = APIRouter(prefix="/api/v1/procedures", tags=["procedures"])


def _get_list_use_case(repo: ProcedureRepositoryDep) -> ListProceduresUseCase:
    return ListProceduresUseCase(procedure_repository=repo)


def _get_create_use_case(repo: ProcedureRepositoryDep) -> CreateProcedureUseCase:
    return CreateProcedureUseCase(procedure_repository=repo)


def _get_update_use_case(repo: ProcedureRepositoryDep) -> UpdateProcedureUseCase:
    return UpdateProcedureUseCase(procedure_repository=repo)


def _get_delete_use_case(repo: ProcedureRepositoryDep) -> DeleteProcedureUseCase:
    return DeleteProcedureUseCase(procedure_repository=repo)


ListProceduresDep = Annotated[ListProceduresUseCase, Depends(_get_list_use_case)]
CreateProcedureDep = Annotated[CreateProcedureUseCase, Depends(_get_create_use_case)]
UpdateProcedureDep = Annotated[UpdateProcedureUseCase, Depends(_get_update_use_case)]
DeleteProcedureDep = Annotated[DeleteProcedureUseCase, Depends(_get_delete_use_case)]


@router.get("", response_model=list[ProcedureOut], summary="List or search procedures")
async def list_procedures(
    use_case: ListProceduresDep,
    _user: Annotated[User, Depends(require_authenticated)],
    q: Annotated[str | None, Query(description="Substring filter by code or name.")] = None,
) -> list[ProcedureOut]:
    items = await use_case.execute(q)
    return [procedure_to_out(p) for p in items]


@router.post(
    "",
    response_model=ProcedureOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create a procedure (any authenticated user)",
)
async def create_procedure(
    body: ProcedureIn,
    use_case: CreateProcedureDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> ProcedureOut:
    procedure = await use_case.execute(procedure_in_to_domain(body))
    return procedure_to_out(procedure)


@router.put(
    "/{code}",
    response_model=ProcedureOut,
    summary="Update a procedure by code (any authenticated user)",
)
async def update_procedure(
    code: str,
    body: ProcedureIn,
    use_case: UpdateProcedureDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> ProcedureOut:
    if body.code != code:
        raise HTTPException(
            status_code=400,
            detail=f"Path code {code!r} does not match body code {body.code!r}",
        )
    procedure = await use_case.execute(procedure_in_to_domain(body))
    return procedure_to_out(procedure)


@router.delete(
    "/{code}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete a procedure by code (any authenticated user)",
)
async def delete_procedure(
    code: str,
    use_case: DeleteProcedureDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> None:
    await use_case.execute(code)


__all__ = ["router"]
