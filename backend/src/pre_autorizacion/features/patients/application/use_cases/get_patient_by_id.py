"""GetPatientByIdUseCase — buscar un paciente por id."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pre_autorizacion.shared.domain.errors import NotFoundError

if TYPE_CHECKING:
    from pre_autorizacion.shared.domain.entities import Patient
    from pre_autorizacion.shared.domain.ports import PatientRepository


@dataclass(slots=True)
class GetPatientByIdUseCase:
    patient_repository: PatientRepository

    async def execute(self, patient_id: str) -> Patient:
        patient = await self.patient_repository.find_by_id(patient_id)
        if patient is None:
            raise NotFoundError(f"Patient {patient_id!r} not found.")
        return patient
