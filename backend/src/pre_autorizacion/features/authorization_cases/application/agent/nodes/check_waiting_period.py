"""Nodo `check_waiting_period` — cuarto nodo del grafo (PRD §3.1.3).

Delega en el rule engine determinístico (`check_waiting_period`) que vive
en `infrastructure/decision/rule_engine.py`. El nodo NO toma decisiones
de cobertura; sólo registra el booleano para que `persist_case` arme el
outcome final.

`evaluation_date` se toma de `report.submitted_at.date()` para que sea
estable y reproducible (mismo report → misma evaluación).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pre_autorizacion.features.authorization_cases.application.agent._trace import (
    trace_node,
)
from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    check_waiting_period,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


async def check_waiting_period_node(state: AgentGraphState) -> dict[str, Any]:
    """Calcula si la carencia está cumplida según el rule engine."""
    coverage = state["coverage"]
    policy = state["policy"]
    report = state["report"]

    async with trace_node(state, node="check_waiting_period") as set_detail:
        result = check_waiting_period(
            coverage=coverage,
            policy=policy,
            evaluation_date=report.submitted_at.date(),
        )
        set_detail(
            f"met={result.met} elapsed={result.days_elapsed} "
            f"required={result.days_required} short={result.days_short}"
        )

    return {"waiting_period_met": result.met}


__all__ = ["check_waiting_period_node"]
