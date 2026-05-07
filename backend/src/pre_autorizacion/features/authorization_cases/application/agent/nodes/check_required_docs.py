"""Nodo `check_required_docs` — quinto nodo del grafo (PRD §3.1.3).

Delega en el rule engine `check_required_docs`. En MVP el set de documentos
adjuntos es vacío (los archivos se gestionan en el frontend mock); el caso
real con FileStorage llegará en post-MVP cuando el agente tenga acceso a la
lista de docs adjuntos del paciente.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pre_autorizacion.features.authorization_cases.application.agent._trace import (
    trace_node,
)
from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    check_required_docs,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


async def check_required_docs_node(state: AgentGraphState) -> dict[str, Any]:
    """Calcula los docs faltantes vs el set requerido por la cobertura."""
    coverage = state["coverage"]

    async with trace_node(state, node="check_required_docs") as set_detail:
        # MVP: el set de docs adjuntos es vacío. Cuando el caso lleve docs
        # adjuntados via FileStorage, este `frozenset` se construye desde el
        # state (TODO MVP+).
        attached: frozenset[str] = frozenset()
        result = check_required_docs(coverage=coverage, attached_docs=attached)
        set_detail(
            f"complete={result.complete} missing={list(result.missing)}"
        )

    return {"missing_docs": result.missing}


__all__ = ["check_required_docs_node"]
