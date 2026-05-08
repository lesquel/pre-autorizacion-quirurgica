"""AgentGraphState — estado mutable que viaja por el grafo LangGraph.

PRD §3.1.3 — el grafo del agente de pre-autorización tiene 7 nodos
(extract_report → match_procedure → load_policy_coverage → check_waiting_period
→ check_required_docs → make_decision → persist_case). Cada nodo lee/escribe
campos de este state y devuelve un dict parche que LangGraph mergea.

Decisiones de diseño:
- `TypedDict` (LangGraph idiomatic) en vez de Pydantic — más liviano y juega
  bien con el merging por defecto de StateGraph.
- `total=False` — todos los campos son opcionales para que el state arranque
  con sólo los inputs y los nodos vayan rellenando el resto.
- `trace_steps: list[TraceStep]` MUTABLE — los nodos hacen append. Esto rompe
  la inmutabilidad pero es la convención de LangGraph para acumuladores; el
  orchestrator clona la lista a tuple en el evento terminal.
- `errors: list[str]` MUTABLE — idem, acumulador.
- Los enums `Outcome` / `EscalationReason` se almacenan tal cual — el persist
  node los baja a `final_outcome` para que el orchestrator los consuma.
"""

from __future__ import annotations

from typing import TypedDict

from pre_autorizacion.features.authorization_cases.domain.entities import MedicalReport
from pre_autorizacion.features.authorization_cases.domain.ports.authorization_decision_maker import (
    AuthorizationDecisionMaker,
)
from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (
    ExtractedMedicalReport,
    MedicalReportExtractor,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects import (
    AgentDecision,
    EscalationReason,
    Outcome,
    TraceStep,
)
from pre_autorizacion.features.policies.domain.entities import Coverage, Policy


class AgentGraphState(TypedDict, total=False):
    """Estado del grafo del agente. Todos los campos son opcionales (`total=False`).

    El orchestrator inicializa los campos de input antes de invocar al grafo;
    los nodos rellenan progresivamente extracción / validación / decisión y
    el nodo `persist_case` consolida el outcome final.
    """

    # ── Input (siempre presentes en el state inicial) ────────────────────────
    case_id: str
    report: MedicalReport
    policy: Policy
    coverage: Coverage
    scenario_key: str | None

    # ── Dependencias inyectadas (vivientes en el state para que los nodos las
    #    puedan usar sin closures globales — facilita testing). ──────────────
    extractor: MedicalReportExtractor
    decision_maker: AuthorizationDecisionMaker

    # ── Extracción ──────────────────────────────────────────────────────────
    extracted: ExtractedMedicalReport | None
    extraction_confidence: float | None

    # ── Validación determinística (rule engine slices) ──────────────────────
    policy_active: bool | None
    procedure_covered: bool | None
    procedure_match_score: float | None
    waiting_period_met: bool | None
    missing_docs: tuple[str, ...]

    # ── Decisión del LLM ────────────────────────────────────────────────────
    agent_decision: AgentDecision | None

    # ── Trace acumulado (mutable) ───────────────────────────────────────────
    trace_steps: list[TraceStep]

    # ── Errores acumulados (mutable) ────────────────────────────────────────
    errors: list[str]

    # ── Output final (consolidado por persist_case) ─────────────────────────
    final_outcome: Outcome | None
    final_escalation_reason: EscalationReason | None


__all__ = ["AgentGraphState"]
