"""Helpers para construir `TraceStep`s desde dentro de los nodos del grafo.

Convención que usa este agente:
- Cada nodo emite UN `TraceStep` con `state=DONE` (o `ERROR` si fallo).
  No se emiten dos eventos `running` + `done` por nodo — el orchestrator
  drena el state final y publica un evento `AgentStepEvent` por TraceStep.
  Esto simplifica el contrato `astream` y evita duplicar trazas.
- `duration_ms` se mide con `time.perf_counter_ns` para precisión sub-ms.
- `model_used` lo setea el caller (por ejemplo el extractor reporta el
  modelo del LLM/vision); para nodos puramente determinísticos vale `None`.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from pre_autorizacion.features.authorization_cases.domain.value_objects import (
    TraceStep,
    TraceStepState,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


def _now() -> datetime:
    """Timestamp UTC determinístico — siempre `aware`."""
    return datetime.now(UTC)


def _push_step(state: AgentGraphState, step: TraceStep) -> list[TraceStep]:
    """Apenndea `step` al trace del state y devuelve la lista resultante.

    LangGraph hace shallow merge del parche, así que devolvemos siempre la
    lista completa (mutada) para que la siguiente iteración la vea igual.
    """
    trace = state.get("trace_steps")
    if trace is None:
        trace = []
        state["trace_steps"] = trace
    trace.append(step)
    return trace


def _push_error(state: AgentGraphState, message: str) -> list[str]:
    errors = state.get("errors")
    if errors is None:
        errors = []
        state["errors"] = errors
    errors.append(message)
    return errors


@asynccontextmanager
async def trace_node(
    state: AgentGraphState,
    *,
    node: str,
    model_used: str | None = None,
) -> AsyncIterator[Callable[[str | None], None]]:
    """Context manager que mide duración y emite un único TraceStep por nodo.

    Uso típico:

        async with trace_node(state, node="extract_report") as set_detail:
            ...
            set_detail("matched=true")

    Si el bloque levanta excepción se emite un TraceStep con `state=ERROR`,
    se appenda al `errors` del state y la excepción se re-lanza para que
    LangGraph la propague (el orchestrator la convierte en AgentErrorEvent).
    """
    started = time.perf_counter_ns()
    detail_box: dict[str, str | None] = {"detail": None}

    def set_detail(value: str | None) -> None:
        detail_box["detail"] = value

    try:
        yield set_detail
    except Exception as exc:  # noqa: BLE001 — re-raised below.
        elapsed_ms = max(1, (time.perf_counter_ns() - started) // 1_000_000)
        _push_step(
            state,
            TraceStep(
                node=node,
                timestamp=_now(),
                state=TraceStepState.ERROR,
                duration_ms=int(elapsed_ms),
                model_used=model_used,
                detail=detail_box["detail"],
                error=str(exc),
            ),
        )
        _push_error(state, f"{node}: {exc}")
        raise
    else:
        elapsed_ms = max(1, (time.perf_counter_ns() - started) // 1_000_000)
        _push_step(
            state,
            TraceStep(
                node=node,
                timestamp=_now(),
                state=TraceStepState.DONE,
                duration_ms=int(elapsed_ms),
                model_used=model_used,
                detail=detail_box["detail"],
            ),
        )


__all__ = ["trace_node"]
