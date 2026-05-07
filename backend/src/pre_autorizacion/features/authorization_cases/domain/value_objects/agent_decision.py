"""AgentDecision — value object emitido por el agente o el auditor.

Port directo de
`frontend/src/app/features/authorization-cases/domain/value-objects/agent-decision.ts`.

Contrato auditable definido en PRD §3.1.3 / §4.2.1 y materializado por
`decisionFor` en `preatuomatizacion/agent.js`.

Decisiones de mapping TS → Python:
- `evidence: readonly Evidence[]`     → `tuple[Evidence, ...]` (frozen-friendly).
- `missingDocs: readonly string[]`    → `tuple[str, ...]`.
- `escalationReason: ... | null`      → `EscalationReason | None`.
- `decidedBy: 'agent' | 'auditor'`    → `DecidedBy` StrEnum (tipo nominal reusable).
- `modelUsed?: string`                → `model_used: str | None`.
- `confidence` queda como `float` ∈ [0.0, 1.0]; el PRD pone gate determinístico
  en < 0.80 pero la validación NO vive en el dataclass (eso lo hace rule engine).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from pre_autorizacion.features.authorization_cases.domain.value_objects.escalation_reason import (
    EscalationReason,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.evidence import Evidence
from pre_autorizacion.features.authorization_cases.domain.value_objects.outcome import Outcome


class DecidedBy(StrEnum):
    """DecidedBy — quién emitió la decisión."""

    AGENT = "agent"
    AUDITOR = "auditor"


@dataclass(frozen=True, slots=True)
class AgentDecision:
    """AgentDecision — value object inmutable con la decisión auditable."""

    outcome: Outcome
    rationale: str
    confidence: float
    decided_by: DecidedBy
    evidence: tuple[Evidence, ...] = field(default_factory=tuple)
    missing_docs: tuple[str, ...] = field(default_factory=tuple)
    escalation_reason: EscalationReason | None = None
    model_used: str | None = None
