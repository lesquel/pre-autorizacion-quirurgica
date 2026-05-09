"""Router FastAPI del feature `patients`."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from pre_autorizacion.features.auth.domain.entities import User
from pre_autorizacion.features.patients.api.schemas import PatientOut, patient_to_out
from pre_autorizacion.features.patients.application.use_cases import (
    GetPatientByIdUseCase,
    ListPatientsUseCase,
)
from pre_autorizacion.shared.api.deps import PatientRepositoryDep, require_authenticated

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])


def _get_list_use_case(repo: PatientRepositoryDep) -> ListPatientsUseCase:
    return ListPatientsUseCase(patient_repository=repo)


def _get_by_id_use_case(repo: PatientRepositoryDep) -> GetPatientByIdUseCase:
    return GetPatientByIdUseCase(patient_repository=repo)


ListPatientsDep = Annotated[ListPatientsUseCase, Depends(_get_list_use_case)]
GetPatientByIdDep = Annotated[GetPatientByIdUseCase, Depends(_get_by_id_use_case)]


@router.get(
    "",
    response_model=list[PatientOut],
    summary="List or search patients",
    responses={401: {"description": "Missing or invalid bearer token."}},
)
async def list_patients(
    use_case: ListPatientsDep,
    _user: Annotated[User, Depends(require_authenticated)],
    dni: Annotated[str | None, Query(description="Filtra por DNI exacto (devuelve 0 ó 1).")] = None,
) -> list[PatientOut]:
    items = await use_case.execute(dni)
    return [patient_to_out(p) for p in items]


@router.get(
    "/{patient_id}",
    response_model=PatientOut,
    summary="Get a single patient by id",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Patient not found."},
    },
)
async def get_patient(
    patient_id: str,
    use_case: GetPatientByIdDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> PatientOut:
    patient = await use_case.execute(patient_id)
    return patient_to_out(patient)


__all__ = ["router"]
