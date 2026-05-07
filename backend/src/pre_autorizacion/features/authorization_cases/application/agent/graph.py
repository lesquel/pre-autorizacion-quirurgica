"""LangGraph build — arma y compila el grafo del agente de pre-autorización.

Topología (PRD §3.1.3):

    START
      │
      ▼
    extract_report
      │
      ▼
    match_procedure
      │
      ▼
    load_policy_coverage
      │
      ▼
    check_waiting_period
      │
      ▼
    check_required_docs
      │
      ▼
    make_decision
      │
      ▼
    persist_case
      │
      ▼
     END

Decisiones de diseño:

- **Edges lineales** — el grafo es una pipeline pura. Las "ramificaciones"
  (escalamiento por carencia, docs faltantes, confidence baja) NO se
  modelan como conditional edges; se concentran en `persist_case`, que es
  el agregador final. Esto:
  * mantiene los nodos simples y testeables individualmente,
  * facilita razonar sobre la traza (siempre 7 pasos en el mismo orden),
  * evita explosión de paths en el grafo.

- **Inyección de dependencias** vive en el state — `extractor` y
  `decision_maker` se pasan al `initial_state` por el orchestrator. Los
  nodos los toman desde ahí. Alternativa rechazada: closures globales o
  partials — eso acopla el grafo al lifecycle de la app.

- **Concurrencia**: por ahora la pipeline es secuencial. `match_procedure`
  + `load_policy_coverage` + `check_waiting_period` + `check_required_docs`
  podrían ejecutarse en paralelo (no comparten side effects), pero LangGraph
  parallel branches complica la traza visual. Se deja para post-MVP.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from langgraph.graph import END, START, StateGraph

from pre_autorizacion.features.authorization_cases.application.agent.nodes import (
    check_required_docs_node,
    check_waiting_period_node,
    extract_report_node,
    load_policy_coverage_node,
    make_decision_node,
    match_procedure_node,
    persist_case_node,
)
from pre_autorizacion.features.authorization_cases.application.agent.state import (
    AgentGraphState,
)

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph


def build_graph() -> CompiledStateGraph[AgentGraphState, None, AgentGraphState, AgentGraphState]:
    """Construye y compila el grafo del agente.

    No recibe extractors ni decision_maker como argumentos — esos viajan en
    el `AgentGraphState` y los nodos los consumen desde ahí. Esto permite
    que el grafo sea un **singleton** que la app construye una sola vez al
    arranque, mientras que las dependencias por-request se inyectan vía
    state.
    """
    graph: StateGraph[AgentGraphState] = StateGraph(AgentGraphState)

    # Nodos
    graph.add_node("extract_report", extract_report_node)
    graph.add_node("match_procedure", match_procedure_node)
    graph.add_node("load_policy_coverage", load_policy_coverage_node)
    graph.add_node("check_waiting_period", check_waiting_period_node)
    graph.add_node("check_required_docs", check_required_docs_node)
    graph.add_node("make_decision", make_decision_node)
    graph.add_node("persist_case", persist_case_node)

    # Edges (pipeline lineal)
    graph.add_edge(START, "extract_report")
    graph.add_edge("extract_report", "match_procedure")
    graph.add_edge("match_procedure", "load_policy_coverage")
    graph.add_edge("load_policy_coverage", "check_waiting_period")
    graph.add_edge("check_waiting_period", "check_required_docs")
    graph.add_edge("check_required_docs", "make_decision")
    graph.add_edge("make_decision", "persist_case")
    graph.add_edge("persist_case", END)

    return graph.compile()


__all__ = ["build_graph"]
