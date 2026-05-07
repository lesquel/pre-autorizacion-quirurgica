"""TraceStep — paso individual de la traza del agente (LangGraph 7 nodos).

Port directo de
`frontend/src/app/features/authorization-cases/domain/value-objects/trace-step.ts`.

Nodos esperados (ver `AGENT_NODES` en agent.js):
  extract_report, match_procedure, load_policy_coverage, check_waiting_period,
  check_required_docs, make_decision, persist_case.

Estados:
- RUNNING : nodo en ejecución.
- DONE    : completado exitosamente.
- ERROR   : falló (incluye casos `warn`/`pending` del prototipo, normalizados acá
            a DONE o ERROR según severidad).

Decisiones de mapping TS → Python:
- `state` (literal union TS) → `TraceStepState` StrEnum.
- `timestamp: string`        → `datetime` del stdlib (con timezone-aware en el boundary).
- `durationMs?: number`      → `duration_ms: int | None`.
- `tokensIn?: number`        → `tokens_in: int | None`.
- `tokensOut?: number`       → `tokens_out: int | None`.
- `modelUsed?: string`       → `model_used: str | None`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class TraceStepState(StrEnum):
    """TraceStepState — estado terminal o en progreso de un paso de traza."""

    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class TraceStep:
    """TraceStep — paso inmutable de la traza del agente."""

    node: str
    timestamp: datetime
    state: TraceStepState
    duration_ms: int | None = None
    model_used: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    detail: str | None = None
    error: str | None = None
