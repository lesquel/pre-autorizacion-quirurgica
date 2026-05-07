"""Outcome — resultado emitido por el agente o el auditor.

Port directo de `frontend/src/app/features/authorization-cases/domain/value-objects/outcome.ts`.

- APPROVED_AUTO   : agente aprueba automáticamente (cobertura + carencia + docs OK).
- DOCS_REQUESTED  : faltan documentos requeridos por la cobertura.
- ESCALATED       : agente escaló a auditor humano (NUNCA auto-rechaza).
- DECIDED         : caso ya cerrado/decidido (estado terminal de visualización).
- PENDING         : caso recién creado, todavía sin corrida del agente.
"""

from __future__ import annotations

from enum import StrEnum


class Outcome(StrEnum):
    """Outcome — resultado emitido por el agente o el auditor."""

    APPROVED_AUTO = "APPROVED_AUTO"
    DOCS_REQUESTED = "DOCS_REQUESTED"
    ESCALATED = "ESCALATED"
    DECIDED = "DECIDED"
    PENDING = "PENDING"
