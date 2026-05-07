"""CaseStatus — estado del caso de autorización en el dashboard.

Port directo de `frontend/src/app/features/authorization-cases/domain/value-objects/case-status.ts`.

Mapeo (referencia data.js / agent.js):
- APPROVED_AUTO  → APROBADO_AUTO
- DOCS_REQUESTED → DOCS_PEDIDOS  (alias del prototipo: PENDIENTE_DOCS)
- ESCALATED      → ESCALADO
- DECIDED        → DECIDIDO  (caso cerrado por auditor)
- PENDIENTE      → recién creado, sin correr el agente.
"""

from __future__ import annotations

from enum import StrEnum


class CaseStatus(StrEnum):
    """CaseStatus — estado del workflow del caso (dashboard)."""

    PENDIENTE = "PENDIENTE"
    APROBADO_AUTO = "APROBADO_AUTO"
    DOCS_PEDIDOS = "DOCS_PEDIDOS"
    ESCALADO = "ESCALADO"
    DECIDIDO = "DECIDIDO"
