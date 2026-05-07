"""Router FastAPI del feature `procedures`."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from pre_autorizacion.features.auth.domain.entities import User
from pre_autorizacion.features.procedures.api.schemas import ProcedureOut, procedure_to_out
from pre_autorizacion.features.procedures.application.use_cases import ListProceduresUseCase
from pre_autorizacion.shared.api.deps import ProcedureRepositoryDep, require_authenticated

router = APIRouter(prefix="/api/v1/procedures", tags=["procedures"])


def _get_use_case(repo: ProcedureRepositoryDep) -> ListProceduresUseCase:
    return ListProceduresUseCase(procedure_repository=repo)


ListProceduresDep = Annotated[ListProceduresUseCase, Depends(_get_use_case)]


@router.get("", response_model=list[ProcedureOut], summary="List or search procedures")
async def list_procedures(
    use_case: ListProceduresDep,
    _user: Annotated[User, Depends(require_authenticated)],
    q: Annotated[str | None, Query(description="Substring filter by code or name.")] = None,
) -> list[ProcedureOut]:
    items = await use_case.execute(q)
    return [procedure_to_out(p) for p in items]


__all__ = ["router"]
