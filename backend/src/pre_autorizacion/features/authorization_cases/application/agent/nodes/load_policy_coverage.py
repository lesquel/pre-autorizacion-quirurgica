"""Nodo `load_policy_coverage` — tercer nodo del grafo (PRD §3.1.3).

En la arquitectura actual el `SubmitCaseUseCase` ya resolvió `Policy` y
`Coverage` antes de invocar al grafo, así que este nodo es una verificación
defensiva: confirma presencia y captura `policy_active` para los nodos
siguientes.

Si la política llegara desnormalizada (i.e. `Policy is None` por bug del
caller), el nodo emite un error que `persist_case` escalará con
`POLICY_INACTIVE` o `UNEXPECTED_ERROR` según corresponda.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pre_autorizacion.features.authorization_cases.application.agent._trace import (
    trace_node,
)
from pre_autorizacion.features.policies.domain.entities.policy import PolicyStatus

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


async def load_policy_coverage_node(state: AgentGraphState) -> dict[str, Any]:
    """Confirma `Policy`/`Coverage` presentes y registra `policy_active`."""
    policy = state.get("policy")
    coverage = state.get("coverage")

    async with trace_node(state, node="load_policy_coverage") as set_detail:
        if policy is None or coverage is None:
            # Defensivo: no debería pasar nunca con el use case actual.
            raise RuntimeError(
                "load_policy_coverage_node invoked without policy/coverage in state"
            )

        policy_active = policy.status is PolicyStatus.ACTIVE
        set_detail(
            f"policy={policy.number!r} status={policy.status.value} "
            f"coverage={coverage.procedure_code!r}"
        )

    return {"policy_active": policy_active}


__all__ = ["load_policy_coverage_node"]
