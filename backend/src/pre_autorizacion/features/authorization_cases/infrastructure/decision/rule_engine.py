"""Rule engine determinístico del agente de pre-autorización.

Toda la lógica LEGAL del flujo (carencia, documentos requeridos, gate de
confidence, ordenamiento de razones de escalamiento) vive acá. El LLM solo
extrae datos y redacta el mensaje final — *jamás* decide cobertura.

Política PRD §3.1.3:
    - El agente NUNCA auto-rechaza. Toda condición desfavorable → ESCALATED.
    - Si confidence < threshold (default 0.80), se fuerza ESCALATED con
      escalation_reason = LOW_CONFIDENCE, sin importar qué eligió el LLM.

Funciones puras: sin I/O, sin estado, sin mocks. Inputs explícitos, outputs
explícitos, totalmente unit-testeables.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    # Importamos los tipos finales solo para el type-checker. En runtime el
    # rule engine acepta cualquier objeto que cumpla con los Protocols
    # estructurales definidos abajo (compile-time forward references).
    from pre_autorizacion.features.policies.domain.entities.coverage import Coverage  # noqa: F401
    from pre_autorizacion.features.policies.domain.entities.policy import Policy  # noqa: F401

# Importamos los enums en runtime — son tipos primitivos cerrados que no
# generan ciclos y son la única dependencia "fuerte" del rule engine.
from pre_autorizacion.features.authorization_cases.domain.value_objects.escalation_reason import (
    EscalationReason,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.outcome import Outcome
from pre_autorizacion.features.policies.domain.entities.policy import PolicyStatus

# ─── Threshold de confidence ───────────────────────────────────────────────

DEFAULT_CONFIDENCE_THRESHOLD: float = 0.80
"""Umbral por defecto para el gate de confidence (PRD §3.1.3)."""

# ─── Protocols estructurales ───────────────────────────────────────────────
# El rule engine NO depende de la implementación concreta de Coverage/Policy.
# Solo necesita los atributos que lee. Estos Protocols documentan ese contrato
# y permiten que los tests sean intercambiables y rápidos (zero I/O).


class _CoverageLike(Protocol):
    """Lo que el rule engine necesita de un Coverage."""

    @property
    def covered(self) -> bool: ...

    @property
    def waiting_days(self) -> int: ...

    @property
    def required_docs(self) -> tuple[str, ...]: ...


class _PolicyLike(Protocol):
    """Lo que el rule engine necesita de un Policy."""

    @property
    def start_date(self) -> date: ...

    @property
    def status(self) -> PolicyStatus: ...


# ─── Result types (frozen, slots) ──────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class WaitingPeriodResult:
    """Resultado de evaluar la carencia de una cobertura."""

    met: bool
    days_elapsed: int
    days_required: int
    days_short: int
    """Cuántos días faltan para cumplir la carencia. 0 si ya está cumplida."""


@dataclass(frozen=True, slots=True)
class RequiredDocsResult:
    """Resultado de validar el set de documentos requeridos."""

    complete: bool
    missing: tuple[str, ...]
    """Documentos faltantes, ordenados alfabéticamente para output determinístico."""


@dataclass(frozen=True, slots=True)
class RuleEngineResult:
    """Veredicto final del rule engine integrando todas las reglas."""

    outcome: Outcome
    escalation_reason: EscalationReason | None
    missing_docs: tuple[str, ...]


# ─── Reglas individuales ───────────────────────────────────────────────────


def check_waiting_period(
    coverage: _CoverageLike,
    policy: _PolicyLike,
    evaluation_date: date,
) -> WaitingPeriodResult:
    """Calcula si la carencia está cumplida a la fecha de evaluación.

    `days_elapsed` puede ser **negativo** si la póliza arranca en el futuro.
    En ese caso `met=False` y `days_short = days_required - days_elapsed`,
    que es siempre el número correcto de días faltantes.
    """
    days_elapsed = (evaluation_date - policy.start_date).days
    days_required = coverage.waiting_days
    met = days_elapsed >= days_required
    days_short = 0 if met else days_required - days_elapsed
    return WaitingPeriodResult(
        met=met,
        days_elapsed=days_elapsed,
        days_required=days_required,
        days_short=days_short,
    )


def check_required_docs(
    coverage: _CoverageLike,
    attached_docs: frozenset[str],
) -> RequiredDocsResult:
    """Valida que el set adjunto cubra TODOS los docs requeridos.

    `coverage.required_docs` es `tuple[str, ...]` (immutable, port del TS
    `readonly string[]`). Lo normalizo a `frozenset` para hacer set-diff.
    `missing` se devuelve **ordenado alfabéticamente** para output determinístico.
    """
    required = frozenset(coverage.required_docs)
    missing_set = required - attached_docs
    missing = tuple(sorted(missing_set))
    return RequiredDocsResult(complete=len(missing) == 0, missing=missing)


def apply_confidence_gate(
    outcome: Outcome,
    confidence: float,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    existing_reason: EscalationReason | None = None,
) -> tuple[Outcome, EscalationReason | None]:
    """Gate post-LLM (PRD §3.1.3).

    Reglas:
        - APPROVED_AUTO + confidence < threshold → ESCALATED + LOW_CONFIDENCE
        - DOCS_REQUESTED + confidence < threshold → ESCALATED + LOW_CONFIDENCE
        - ESCALATED → respeta `existing_reason` (no lo override).
        - Otros outcomes (DECIDED, PENDING) o confidence >= threshold → passthrough.

    El LLM **no puede** saltarse este gate: vive en código determinístico,
    no en el prompt.
    """
    if outcome is Outcome.ESCALATED:
        return outcome, existing_reason

    if outcome in (Outcome.APPROVED_AUTO, Outcome.DOCS_REQUESTED) and confidence < threshold:
        return Outcome.ESCALATED, EscalationReason.LOW_CONFIDENCE

    return outcome, None


# ─── Orquestador ───────────────────────────────────────────────────────────


def evaluate_authorization(
    coverage: _CoverageLike,
    policy: _PolicyLike,
    attached_docs: frozenset[str],
    confidence: float,
    evaluation_date: date,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> RuleEngineResult:
    """Aplica las reglas en el orden que define el grafo del PRD.

    Orden (la primera regla que falla domina):

        1. Póliza inactiva           → ESCALATED + POLICY_INACTIVE
        2. Procedimiento no cubierto → ESCALATED + PROCEDURE_NOT_COVERED
        3. Carencia no cumplida      → ESCALATED + WAITING_PERIOD_NOT_MET
        4. Faltan documentos         → DOCS_REQUESTED (sujeto a gate)
        5. Todo OK + confidence alta → APPROVED_AUTO
        6. Confidence baja           → ESCALATED + LOW_CONFIDENCE

    Nota de diseño: las reglas 1-3 son escalamientos "duros" que NO pasan
    por el gate de confidence — si la póliza está vencida no importa cuán
    seguro está el LLM, igual escala. Las reglas 4-5 sí lo aplican.
    """
    # 1. Póliza inactiva (cualquier status != ACTIVE)
    if policy.status is not PolicyStatus.ACTIVE:
        return RuleEngineResult(
            outcome=Outcome.ESCALATED,
            escalation_reason=EscalationReason.POLICY_INACTIVE,
            missing_docs=(),
        )

    # 2. Procedimiento no cubierto
    if not coverage.covered:
        return RuleEngineResult(
            outcome=Outcome.ESCALATED,
            escalation_reason=EscalationReason.PROCEDURE_NOT_COVERED,
            missing_docs=(),
        )

    # 3. Carencia no cumplida
    waiting = check_waiting_period(coverage, policy, evaluation_date)
    if not waiting.met:
        return RuleEngineResult(
            outcome=Outcome.ESCALATED,
            escalation_reason=EscalationReason.WAITING_PERIOD_NOT_MET,
            missing_docs=(),
        )

    # 4. Faltan docs → DOCS_REQUESTED (sujeto al gate de confidence)
    docs = check_required_docs(coverage, attached_docs)
    if not docs.complete:
        gated_outcome, gated_reason = apply_confidence_gate(
            Outcome.DOCS_REQUESTED, confidence, threshold
        )
        return RuleEngineResult(
            outcome=gated_outcome,
            escalation_reason=gated_reason,
            missing_docs=docs.missing,
        )

    # 5 & 6. Todo OK → APPROVED_AUTO sujeto al gate de confidence
    gated_outcome, gated_reason = apply_confidence_gate(
        Outcome.APPROVED_AUTO, confidence, threshold
    )
    return RuleEngineResult(
        outcome=gated_outcome,
        escalation_reason=gated_reason,
        missing_docs=(),
    )
