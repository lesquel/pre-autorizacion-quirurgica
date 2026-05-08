"""NotionPatientRepository — adapter de `PatientRepository` sobre Notion API.

Opera sobre la **DB Notion 1: Pacientes** (PRD §4.2.2). Schema esperado:

- `Nombre`           (title)     — string del nombre completo
- `DNI`              (rich_text) — documento de identidad
- `FechaNacimiento`  (date)      — fecha sin hora
- `Sexo`             (select)    — `M` | `F` | `X`

`find_by_id` privilegia `pages.retrieve` cuando el id parece un page_id
Notion (UUID con o sin guiones). Para ids sintéticos (ej. ``"PAC-00481"``
de los seeds) cae a `list()` + filtro client-side: Notion no tiene una
property "Identificador" sintética por contrato — el id en este adapter
ES el page_id de Notion.
"""

from __future__ import annotations

import re
from typing import Any

from pre_autorizacion.shared.domain.entities.patient import Patient
from pre_autorizacion.shared.domain.ports import PatientRepository
from pre_autorizacion.shared.notion import NotionClient
from pre_autorizacion.shared.notion.entities import notion_to_patient

# Notion page_ids son UUIDs v4. Los aceptamos con o sin guiones (la API los
# devuelve con guiones, pero algunos clientes los mandan sin).
_NOTION_PAGE_ID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?"
    r"[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$",
)


def _looks_like_notion_page_id(value: str) -> bool:
    return bool(_NOTION_PAGE_ID_RE.match(value.strip()))


class NotionPatientRepository(PatientRepository):
    """Adapter Notion del repo de pacientes (read-only en MVP)."""

    def __init__(self, notion_client: NotionClient, database_id: str) -> None:
        self._client = notion_client
        self._database_id = database_id

    async def list(self) -> tuple[Patient, ...]:
        pages = await self._client.query_database(self._database_id)
        return tuple(notion_to_patient(page) for page in pages)

    async def find_by_id(self, patient_id: str) -> Patient | None:
        # Si parece page_id Notion → retrieve directo (1 round-trip).
        if _looks_like_notion_page_id(patient_id):
            page = await self._client.retrieve_page(patient_id)
            if not page:
                return None
            return notion_to_patient(page)
        # Fallback: id sintético (no hay property por contrato para filtrarlo).
        # Tira lectura completa y filtra client-side. Acceptable para v1
        # (catálogo chico). Si crece, agregar property `Identificador` y
        # filtrar server-side.
        for p in await self.list():
            if p.id == patient_id:
                return p
        return None

    async def find_by_dni(self, dni: str) -> Patient | None:
        filter_: dict[str, Any] = {
            "property": "DNI",
            "rich_text": {"equals": dni},
        }
        pages = await self._client.query_database(self._database_id, filter=filter_)
        if not pages:
            return None
        return notion_to_patient(pages[0])
