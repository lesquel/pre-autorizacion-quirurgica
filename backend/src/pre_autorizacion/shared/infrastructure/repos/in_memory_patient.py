"""InMemoryPatientRepository — fallback adapter, seeded con `SEED_PATIENTS`.

`async def` aunque internamente sea sincrónico: respeta el port y permite
swap transparente con el adapter Notion (que sí hace HTTP I/O).
"""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.shared.domain.entities.patient import Patient
from pre_autorizacion.shared.domain.ports import PatientRepository
from pre_autorizacion.shared.fixtures import SEED_PATIENTS


class InMemoryPatientRepository(PatientRepository):
    """Repo in-memory del catálogo de pacientes (PRD §4.2.2 DB Notion 1)."""

    def __init__(self, seed: Iterable[Patient] = SEED_PATIENTS) -> None:
        self._patients: tuple[Patient, ...] = tuple(seed)

    async def list(self) -> tuple[Patient, ...]:
        return self._patients

    async def find_by_id(self, patient_id: str) -> Patient | None:
        for p in self._patients:
            if p.id == patient_id:
                return p
        return None

    async def find_by_dni(self, dni: str) -> Patient | None:
        for p in self._patients:
            if p.dni == dni:
                return p
        return None
