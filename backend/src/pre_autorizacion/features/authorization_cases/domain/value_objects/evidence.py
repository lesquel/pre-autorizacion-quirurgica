"""Evidence — cita auditable que respalda una decisión del agente.
Contrato del PRD §4.2.1 + agent.js (`decisionFor`).

Port directo de `frontend/src/app/features/authorization-cases/domain/value-objects/evidence.ts`.

Decisión: se modela `source` como `EvidenceSource` StrEnum (en vez de `Literal`)
para mantener un tipo nominal reutilizable y facilitar exhaustividad en el rule
engine y los nodos del agente.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class EvidenceSource(StrEnum):
    """EvidenceSource — origen de la cita."""

    REPORT = "report"
    POLICY = "policy"


@dataclass(frozen=True, slots=True)
class Evidence:
    """Evidence — cita auditable (origen + campo + texto)."""

    source: EvidenceSource
    field: str
    quote: str
