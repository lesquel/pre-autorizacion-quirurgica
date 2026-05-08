"""Port abstracto del repositorio de Pacientes.

`Patient` es una entity cross-feature (vive en `shared/domain/entities/`),
por eso su port también vive en `shared/domain/ports/` y no debajo de un
feature concreto. Adapters típicos: Notion (read-only) e in-memory fallback.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.shared.domain.entities.patient import Patient


class PatientRepository(ABC):
    """Port read-only del catálogo de pacientes."""

    @abstractmethod
    async def list(self) -> tuple[Patient, ...]:
        """Lista el catálogo completo de pacientes."""

    @abstractmethod
    async def find_by_id(self, patient_id: str) -> Patient | None:
        """Busca por id (page_id en Notion, id sintético en in-memory)."""

    @abstractmethod
    async def find_by_dni(self, dni: str) -> Patient | None:
        """Busca por DNI (documento de identidad)."""
