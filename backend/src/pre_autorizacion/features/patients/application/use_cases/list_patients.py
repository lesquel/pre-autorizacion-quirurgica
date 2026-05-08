"""ListPatientsUseCase — listar pacientes (con filtro opcional por DNI)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.shared.domain.entities import Patient
    from pre_autorizacion.shared.domain.ports import PatientRepository


@dataclass(slots=True)
class ListPatientsUseCase:
    patient_repository: PatientRepository

    async def execute(self, dni: str | None = None) -> tuple[Patient, ...]:
        """Lista pacientes. Si `dni` viene set, filtra por DNI (devuelve 0 ó 1)."""
        if dni is not None and dni.strip():
            found = await self.patient_repository.find_by_dni(dni.strip())
            return (found,) if found is not None else ()
        return await self.patient_repository.list()
