"""SubmitCaseUseCase — crea un `AuthorizationCase`, ejecuta el flow de decisión.

Diseño:
- DI por constructor (los routers lo arman vía FastAPI `Depends`).
- Acepta un `AgentOrchestrator` opcional. Cuando es `None`, usa **flow MOCK**:
  arma un trace sintético, llama directo al rule engine determinístico (Wave B1),
  y construye un `AgentDecision` plausible.
- Cuando hay orchestrator real (Wave B3 / LangGraph), delega — el flow MOCK
  queda como fallback para demos sin LLM key.

Si la póliza (y/o coberturas) no existen en el catálogo persistido, se **registran
automáticamente** en esta primera subida — típico cuando el número viene solo del
PDF y los jurados no conocen números de demo.

Los errores de dominio (`PolicyNotFoundError`, `CoverageNotFoundError`) heredan
de `NotFoundError` (`shared/domain/errors.py`) → 404 a nivel HTTP por el handler
global.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from pre_autorizacion.features.authorization_cases.domain.entities import (
    AuthorizationCase,
    MedicalReport,
)
from pre_autorizacion.features.authorization_cases.domain.ports.agent_orchestrator import (
    AgentDoneEvent,
    AgentErrorEvent,
    AgentRunRequest,
    AgentStepEvent,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects import (
    AgentDecision,
    CaseStatus,
    DecidedBy,
    Outcome,
    TraceStep,
    TraceStepState,
)
from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    evaluate_authorization,
)
from pre_autorizacion.features.policies.domain import PolicyNotFoundError
from pre_autorizacion.features.policies.domain.entities import Coverage, Policy, PolicyStatus
from pre_autorizacion.shared.domain.errors import NotFoundError

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.ports.agent_orchestrator import (
        AgentOrchestrator,
    )
    from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
        CaseRepository,
    )
    from pre_autorizacion.features.policies.domain.ports import (
        CoverageRepository,
        PolicyRepository,
    )


# ─── Errores específicos del flow ──────────────────────────────────────────


class CoverageNotFoundError(NotFoundError):
    """No hay cobertura aplicable a la póliza/procedimiento."""

    title = "Coverage not found"


# ─── Input ─────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SubmitCaseInput:
    """Input del use case `SubmitCaseUseCase`.

    Campos:
        report:        informe médico ya armado (entidad de dominio).
        policy_number: número de póliza del paciente.
        scenario_key:  override opcional para demos (forzar un escenario).
        case_id:       id pre-generado por el caller. Cuando viene set, el use
                       case lo usa; si es None, genera uno con uuid4.
                       Útil para que el endpoint de upload pueda reservar el
                       case_id antes de persistir el archivo bajo ese path.
    """

    report: MedicalReport
    policy_number: str
    scenario_key: str | None = None
    case_id: str | None = None


# ─── Alta automática de catálogo (primera vez que aparece la póliza) ───────


def _hint_looks_like_notion_page_id(hint: str) -> bool:
    raw = hint.strip()
    if len(raw) < 32:
        return False
    try:
        uuid.UUID(raw)
    except ValueError:
        return False
    return True


def _procedure_code_from_report(report: MedicalReport) -> str:
    hint = (report.procedure_solicited_hint or "").strip()
    if not hint or _hint_looks_like_notion_page_id(hint):
        return "UNKNOWN"
    if hint[0].isalpha() and any(ch.isdigit() for ch in hint):
        return hint
    return "UNKNOWN"


def _auto_registered_policy(policy_number: str) -> Policy:
    today = date.today()
    pn = policy_number.strip()
    return Policy(
        number=pn,
        patient_id="",
        plan="Registrada automáticamente (solicitud)",
        insurer_id="",
        start_date=today - timedelta(days=400),
        end_date=today + timedelta(days=365),
        status=PolicyStatus.ACTIVE,
    )


def _auto_registered_coverage(policy_number: str, report: MedicalReport) -> Coverage:
    pn = policy_number.strip()
    code = _procedure_code_from_report(report)
    return Coverage(
        policy_number=pn,
        procedure_code=code,
        covered=True,
        waiting_days=0,
        copay=Decimal("0"),
        required_docs=(),
    )


# ─── Internos del flow MOCK ────────────────────────────────────────────────


_MOCK_NODES: tuple[str, ...] = (
    "extract_report",
    "match_procedure",
    "load_policy_coverage",
    "check_waiting_period",
    "check_required_docs",
    "make_decision",
)
"""Nodos que el flow MOCK simula. Subset alineado con LangGraph (B3)."""

_MOCK_MODEL: str = "mock-rule-engine"


def _confidence_for_scenario(scenario_key: str | None) -> float:
    """Mapea el `scenario_key` a un confidence determinístico para la demo."""
    if scenario_key is None:
        return 0.92
    key = scenario_key.upper()
    if "LOW_CONF" in key or "LOW_CONFIDENCE" in key:
        return 0.55
    if "ESCALATED" in key or "ESCALATE" in key:
        return 0.78
    if "DOCS" in key:
        return 0.88
    return 0.92


def _outcome_to_status(outcome: Outcome) -> CaseStatus:
    """Mapea `Outcome` (dominio del agente) a `CaseStatus` (workflow del dashboard)."""
    match outcome:
        case Outcome.APPROVED_AUTO:
            return CaseStatus.APROBADO_AUTO
        case Outcome.DOCS_REQUESTED:
            return CaseStatus.DOCS_PEDIDOS
        case Outcome.ESCALATED:
            return CaseStatus.ESCALADO
        case Outcome.DECIDED:
            return CaseStatus.DECIDIDO
        case Outcome.PENDING:
            return CaseStatus.PENDIENTE


def _rationale_for(outcome: Outcome, missing_docs: tuple[str, ...]) -> str:
    """Texto humano plausible que acompaña al `AgentDecision` MOCK."""
    match outcome:
        case Outcome.APPROVED_AUTO:
            return (
                "Cobertura activa, carencia cumplida y documentación completa. "
                "Aprobación automática conforme a las reglas determinísticas."
            )
        case Outcome.DOCS_REQUESTED:
            joined = ", ".join(missing_docs) if missing_docs else "documentos faltantes"
            return f"Faltan documentos requeridos por la cobertura: {joined}."
        case Outcome.ESCALATED:
            return (
                "El caso requiere revisión por un auditor humano (regla "
                "determinística o gate de confianza)."
            )
        case Outcome.DECIDED:
            return "Caso ya decidido."
        case Outcome.PENDING:
            return "Caso recién creado, sin corrida del agente."


# ─── Use case ──────────────────────────────────────────────────────────────


@dataclass(slots=True)
class SubmitCaseUseCase:
    """Crea un caso, ejecuta el flow de decisión, persiste la traza final.

    El flow real (LangGraph) llega en Wave B3. En MVP se usa el flow MOCK
    cuando `agent_orchestrator is None` — corre `evaluate_authorization` del
    rule engine y arma un `AgentDecision` sintético.
    """

    case_repository: CaseRepository
    policy_repository: PolicyRepository
    coverage_repository: CoverageRepository
    agent_orchestrator: AgentOrchestrator | None = None
    _step_delay_seconds: float = field(default=0.0)
    """Delay entre pasos del trace MOCK; útil para demos visuales (default 0)."""

    async def execute(self, input: SubmitCaseInput) -> AuthorizationCase:
        """Ejecuta el caso end-to-end.

        Pasos:
            1. Resolver `Policy` y `Coverage` (creando filas mínimas si no existían).
            2. Crear el caso con `status=PENDIENTE`.
            3. Persistirlo (estado inicial).
            4. Correr el flow (MOCK o real) → `AgentDecision` + traza.
            5. Update del caso con la decisión final.
            6. Re-fetch para devolver la versión persistida.
        """
        pn = input.policy_number.strip()
        policy, coverages = await self._ensure_catalog_for_upload(pn, input.report)
        coverage = self._select_coverage(coverages, input.report)
        if coverage is None:
            raise CoverageNotFoundError(f"No coverage found for policy={pn!r}")

        created_at = datetime.now(UTC)
        case = AuthorizationCase(
            id=input.case_id or f"CASE-{uuid.uuid4().hex[:8].upper()}",
            report_id=input.report.id,
            policy_number=pn,
            status=CaseStatus.PENDIENTE,
            created_at=created_at,
        )
        await self.case_repository.create(case)

        decision, trace = await self._decide(input, policy, coverage)
        decided_at = datetime.now(UTC)
        new_status = _outcome_to_status(decision.outcome)

        await self.case_repository.update(
            case.id,
            status=new_status,
            decision=decision,
            agent_trace=trace,
            decided_at=decided_at,
        )

        refreshed = await self.case_repository.find_by_id(case.id)
        if refreshed is None:
            # Fallback defensivo: si el adapter no soporta read-after-write,
            # devolvemos la versión que armamos en memoria.
            return AuthorizationCase(
                id=case.id,
                report_id=case.report_id,
                policy_number=case.policy_number,
                status=new_status,
                created_at=case.created_at,
                decision=decision,
                agent_trace=trace,
                decided_at=decided_at,
            )
        return refreshed

    async def _ensure_catalog_for_upload(
        self,
        policy_number: str,
        report: MedicalReport,
    ) -> tuple[Policy, tuple[Coverage, ...]]:
        """Garantiza filas de catálogo para poder evaluar el caso.

        Si la póliza no existe, se crea con valores placeholder razonables.
        Si no hay coberturas para ese número, se inserta una cobertura mínima
        (procedimiento deducido del informe cuando sea posible).
        """
        pn = policy_number.strip()
        if not pn:
            raise PolicyNotFoundError("No policy found for number=''")

        policy = await self.policy_repository.find_by_number(pn)
        if policy is None:
            await self.policy_repository.create(_auto_registered_policy(pn))
            policy = await self.policy_repository.find_by_number(pn)
            if policy is None:
                raise PolicyNotFoundError(f"No policy found for number={pn!r}")

        coverages = await self.coverage_repository.list_for_policy(pn)
        if not coverages:
            await self.coverage_repository.replace_for_policy(
                pn,
                (_auto_registered_coverage(pn, report),),
            )
            coverages = await self.coverage_repository.list_for_policy(pn)

        return policy, coverages

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _select_coverage(
        coverages: tuple[Coverage, ...],
        report: MedicalReport,
    ) -> Coverage | None:
        """Selecciona la cobertura aplicable.

        En MVP: match por `procedure_code == report.procedure_solicited_hint`
        si el hint coincide con un código exacto; si no, devuelve la primera
        cobertura — suficiente para la demo, refinable en B3 con embeddings.
        """
        if not coverages:
            return None
        hint = (report.procedure_solicited_hint or "").strip()
        if hint:
            for cov in coverages:
                if cov.procedure_code == hint:
                    return cov
        return coverages[0]

    async def _decide(
        self,
        input: SubmitCaseInput,
        policy: Policy,
        coverage: Coverage,
    ) -> tuple[AgentDecision, tuple[TraceStep, ...]]:
        """Despacha al flow real (LangGraph) o al flow MOCK."""
        if self.agent_orchestrator is None:
            return await self._mock_decide(input, policy, coverage)
        return await self._run_orchestrator(input, policy, coverage, self.agent_orchestrator)

    async def _mock_decide(
        self,
        input: SubmitCaseInput,
        policy: Policy,
        coverage: Coverage,
    ) -> tuple[AgentDecision, tuple[TraceStep, ...]]:
        """Flow MOCK: trace sintético + rule engine determinístico."""
        confidence = _confidence_for_scenario(input.scenario_key)

        trace: list[TraceStep] = []
        for node in _MOCK_NODES:
            ts = datetime.now(UTC)
            trace.append(
                TraceStep(
                    node=node,
                    timestamp=ts,
                    state=TraceStepState.DONE,
                    duration_ms=12,
                    model_used=_MOCK_MODEL,
                    detail=f"mock node {node}",
                )
            )
            if self._step_delay_seconds > 0:
                await asyncio.sleep(self._step_delay_seconds)

        evaluation = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset(),  # MVP: sin attached_docs reales.
            confidence=confidence,
            evaluation_date=input.report.submitted_at.date(),
        )

        decision = AgentDecision(
            outcome=evaluation.outcome,
            rationale=_rationale_for(evaluation.outcome, evaluation.missing_docs),
            confidence=confidence,
            decided_by=DecidedBy.AGENT,
            evidence=(),
            missing_docs=evaluation.missing_docs,
            escalation_reason=evaluation.escalation_reason,
            model_used=_MOCK_MODEL,
        )
        return decision, tuple(trace)

    async def _run_orchestrator(
        self,
        input: SubmitCaseInput,
        policy: Policy,
        coverage: Coverage,
        orchestrator: AgentOrchestrator,
    ) -> tuple[AgentDecision, tuple[TraceStep, ...]]:
        """Drena el `AsyncIterator[AgentEvent]` y arma `(decision, trace)`.

        El SSE endpoint (`/api/v1/cases/{id}/events`, post-MVP) puede
        republicar los `AgentStepEvent` en tiempo real; este use case solo
        consume el resultado terminal para persistirlo.
        """
        request = AgentRunRequest(
            report=input.report,
            policy=policy,
            coverage=coverage,
            scenario_key=input.scenario_key,
        )
        steps: list[TraceStep] = []
        async for event in orchestrator.run(request):
            match event:
                case AgentStepEvent(step=step):
                    steps.append(step)
                case AgentDoneEvent(decision=decision, trace=trace):
                    return decision, trace if trace else tuple(steps)
                case AgentErrorEvent(error=err):
                    raise RuntimeError(f"Agent run failed: {err}") from None
        raise RuntimeError("Agent orchestrator finished without terminal event")
