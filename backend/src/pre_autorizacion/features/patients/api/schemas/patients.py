"""DTOs del feature `patients`."""

from __future__ import annotations

from datetime import date

from pre_autorizacion.shared.api.schemas import CamelModel
from pre_autorizacion.shared.domain.entities import Patient


class PatientOut(CamelModel):
    id: str
    dni: str
    name: str
    dob: date
    sex: str


def patient_to_out(p: Patient) -> PatientOut:
    return PatientOut(
        id=p.id,
        dni=p.dni,
        name=p.name,
        dob=p.dob,
        sex=p.sex.value,
    )


__all__ = ["PatientOut", "patient_to_out"]
