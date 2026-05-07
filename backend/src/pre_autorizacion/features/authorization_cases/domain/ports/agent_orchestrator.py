"""AgentOrchestrator — port que ejecuta el grafo del agente y emite eventos.

Port directo de `frontend/src/app/features/authorization-cases/domain/ports/agent-orchestrator.port.ts`.

Decisiones de mapping TS → Python:
- TS usa `Observable<AgentEvent>` (RxJS); Python usa `AsyncIterator[AgentEvent]`
  — la SSE del backend (PRD §4.3.2 `/api/v1/cases/{id}/events`) consume este
  iterator y traduce cada evento a un mensaje SSE.
- El tagged union TS (`{ kind: 'step' | 'done' | 'error', ... }`) se modela
  con TRES dataclasses frozen + un type alias `AgentEvent = AgentStepEvent |
  AgentDoneEvent | AgentErrorEvent`. Esta forma (vs `Literal` + dict) habilita
  pattern matching exhaustivo (`match event: case AgentStepEvent(): ...`)
  que mypy chequea en tiempo de compilación.
- `readonly TraceStep[]` → `tuple[TraceStep, ...]`.
- `scenarioKey?: string` → `scenario_key: str | None = None`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from pre_autorizacion.features.policies.domain.entities import Coverage, Policy

if TYPE_CHECKING:
    # Forward references — entidades y value objects creados en paralelo.
    from pre_autorizacion.features.authorization_cases.domain.entities import (
        MedicalReport,
    )
    from pre_autorizacion.features.authorization_cases.domain.value_objects import (
        AgentDecision,
        TraceStep,
    )


@dataclass(frozen=True, slots=True)
class AgentRunRequest:
    """Input para correr el agente sobre un caso concreto.

    Campos:
        report:       informe médico que se va a evaluar.
        policy:       póliza del paciente (cobertura/vigencia).
        coverage:     fila póliza × procedimiento (carencia, copago, docs).
        scenario_key: override opcional para forzar un escenario en demos
                      (`"APPROVED_AUTO"`, `"ESCALATED_PDF_FAIL"`, etc.).
                      Cuando viene, el adapter NO infiere el escenario y usa
                      este valor tal cual. Útil para reproducir una decisión
                      exacta en la demo del hackathon.
    """

    report: MedicalReport
    policy: Policy
    coverage: Coverage
    scenario_key: str | None = None


# ── AgentEvent — tagged union ────────────────────────────────────────────────
# Se usan tres dataclasses frozen + type alias en lugar de un dict tipado, para
# que `match` sobre el evento sea exhaustivo y verificable por mypy.
# El campo `kind` (Literal) es redundante en Python (ya tenemos el tipo nominal),
# pero se mantiene para alinear con el wire format del frontend (TS) y simplificar
# la serialización en el adapter SSE.


@dataclass(frozen=True, slots=True)
class AgentStepEvent:
    """Un paso de la traza del agente. Estado: `running`, `done` o `error`."""

    step: TraceStep
    kind: Literal["step"] = "step"


@dataclass(frozen=True, slots=True)
class AgentDoneEvent:
    """La corrida terminó exitosamente — incluye decisión final + traza completa."""

    decision: AgentDecision
    trace: tuple[TraceStep, ...]
    kind: Literal["done"] = "done"


@dataclass(frozen=True, slots=True)
class AgentErrorEvent:
    """La corrida falló de forma irrecuperable — la traza acumulada se entrega igual."""

    error: str
    trace: tuple[TraceStep, ...]
    kind: Literal["error"] = "error"


AgentEvent = AgentStepEvent | AgentDoneEvent | AgentErrorEvent
"""Evento emitido por el stream del agente. Discriminado por `kind`."""


class AgentOrchestrator(ABC):
    """Port del agente de pre-autorización.

    Contrato:
    - `run` devuelve un `AsyncIterator[AgentEvent]` que emite los pasos en orden,
      terminando con un evento `AgentDoneEvent` o `AgentErrorEvent`.
    - El iterator DEBE completarse después del evento terminal.
    - El adapter LangGraph es la implementación canónica; en MVP de pruebas se
      puede usar un mock que reproduzca un escenario fijo.
    """

    @abstractmethod
    def run(self, request: AgentRunRequest) -> AsyncIterator[AgentEvent]:
        """Corre el agente sobre el caso descrito por `request`.

        Args:
            request: datos del caso + scenario_key opcional para demos.

        Returns:
            Async iterator de `AgentEvent`. Consumir con `async for`.
        """
