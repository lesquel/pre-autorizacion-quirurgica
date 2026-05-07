"""Tests para `evaluate_authorization` — orquestador del rule engine.

Combina las 3 funciones puras en el orden del PRD §3.1.3:
    1. Póliza inactiva           → ESCALATED + POLICY_INACTIVE
    2. Procedimiento no cubierto → ESCALATED + PROCEDURE_NOT_COVERED
    3. Carencia no cumplida      → ESCALATED + WAITING_PERIOD_NOT_MET
    4. Faltan documentos         → DOCS_REQUESTED (sujeto a gate)
    5. Todo OK + confidence alta → APPROVED_AUTO
    6. Confidence baja           → ESCALATED + LOW_CONFIDENCE

Cuando hay múltiples problemas, el primer chequeo en orden domina.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pre_autorizacion.features.authorization_cases.domain.value_objects.escalation_reason import (
    EscalationReason,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.outcome import Outcome
from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    RuleEngineResult,
    evaluate_authorization,
)
from pre_autorizacion.features.policies.domain.entities.policy import PolicyStatus
from tests.unit.rule_engine.conftest import make_coverage, make_policy

EVALUATION_DATE = date(2026, 5, 6)


class TestEvaluateAuthorization:
    """evaluate_authorization — orquestador integrando las 3 reglas + gate."""

    def test_evaluate_authorization_happy_path__approved_auto(self) -> None:
        """Cobertura OK + carencia cumplida + docs completos + confidence alta."""
        coverage = make_coverage(
            covered=True,
            waiting_days=30,
            required_docs=("informe.pdf",),
            copay=Decimal("100"),
        )
        policy = make_policy(
            start_date=date(2026, 1, 1), status=PolicyStatus.ACTIVE
        )  # 125d transcurridos

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset({"informe.pdf"}),
            confidence=0.95,
            evaluation_date=EVALUATION_DATE,
        )

        assert result == RuleEngineResult(
            outcome=Outcome.APPROVED_AUTO, escalation_reason=None, missing_docs=()
        )

    def test_evaluate_authorization_waiting_not_met__escalated_waiting_period(self) -> None:
        """Carencia 90, póliza arrancó hace 30 → ESCALATED por carencia."""
        coverage = make_coverage(covered=True, waiting_days=90, required_docs=())
        policy = make_policy(start_date=date(2026, 4, 6))  # 30d antes de evaluation

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset(),
            confidence=0.95,
            evaluation_date=EVALUATION_DATE,
        )

        assert result.outcome is Outcome.ESCALATED
        assert result.escalation_reason is EscalationReason.WAITING_PERIOD_NOT_MET
        assert result.missing_docs == ()

    def test_evaluate_authorization_procedure_not_covered__escalated_procedure(self) -> None:
        """Procedimiento `covered=False` → ESCALATED + PROCEDURE_NOT_COVERED."""
        coverage = make_coverage(covered=False, waiting_days=0, required_docs=())
        policy = make_policy(start_date=date(2025, 1, 1))

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset(),
            confidence=0.95,
            evaluation_date=EVALUATION_DATE,
        )

        assert result.outcome is Outcome.ESCALATED
        assert result.escalation_reason is EscalationReason.PROCEDURE_NOT_COVERED

    def test_evaluate_authorization_missing_docs_high_conf__docs_requested(self) -> None:
        """Cobertura + carencia OK pero faltan docs y confidence alta → DOCS_REQUESTED."""
        coverage = make_coverage(
            covered=True,
            waiting_days=30,
            required_docs=("informe.pdf", "biopsia.pdf"),
        )
        policy = make_policy(start_date=date(2026, 1, 1))

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset({"informe.pdf"}),
            confidence=0.92,
            evaluation_date=EVALUATION_DATE,
        )

        assert result.outcome is Outcome.DOCS_REQUESTED
        assert result.escalation_reason is None
        assert result.missing_docs == ("biopsia.pdf",)

    def test_evaluate_authorization_low_confidence__escalated_low_confidence(self) -> None:
        """Todo OK pero confidence < 0.80 → ESCALATED + LOW_CONFIDENCE."""
        coverage = make_coverage(covered=True, waiting_days=30, required_docs=())
        policy = make_policy(start_date=date(2026, 1, 1))

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset(),
            confidence=0.42,
            evaluation_date=EVALUATION_DATE,
        )

        assert result.outcome is Outcome.ESCALATED
        assert result.escalation_reason is EscalationReason.LOW_CONFIDENCE
        assert result.missing_docs == ()

    def test_evaluate_authorization_inactive_policy_dominates(self) -> None:
        """Policy inactiva domina sobre cualquier otra regla.

        Aunque la cobertura no aplique, falten docs y confidence sea baja,
        si la póliza está INACTIVA escala con POLICY_INACTIVE — la primera
        regla en orden gana.
        """
        coverage = make_coverage(
            covered=False,  # también fallaría en cobertura
            waiting_days=999,  # también fallaría en carencia
            required_docs=("falta.pdf",),  # también fallaría en docs
        )
        policy = make_policy(
            start_date=date(2026, 1, 1), status=PolicyStatus.INACTIVE
        )

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset(),
            confidence=0.10,  # también fallaría en gate
            evaluation_date=EVALUATION_DATE,
        )

        assert result.outcome is Outcome.ESCALATED
        assert result.escalation_reason is EscalationReason.POLICY_INACTIVE
        assert result.missing_docs == ()

    def test_evaluate_authorization_waiting_dominates_over_missing_docs(self) -> None:
        """Cuando carencia falla Y faltan docs, gana carencia (regla 3 antes que 4)."""
        coverage = make_coverage(
            covered=True,
            waiting_days=180,  # falla
            required_docs=("informe.pdf",),  # también faltaría
        )
        policy = make_policy(start_date=date(2026, 4, 1))  # ~35d → falla carencia

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset(),  # nada adjuntado
            confidence=0.95,
            evaluation_date=EVALUATION_DATE,
        )

        assert result.outcome is Outcome.ESCALATED
        assert result.escalation_reason is EscalationReason.WAITING_PERIOD_NOT_MET
        # No reporta missing_docs porque ni siquiera llegó a chequearlos
        assert result.missing_docs == ()

    def test_evaluate_authorization_missing_docs_low_conf__escalated_low_confidence(
        self,
    ) -> None:
        """Faltan docs PERO confidence baja → el gate fuerza ESCALATED + LOW_CONFIDENCE.

        Documenta el comportamiento: si dudás de qué docs pedir, escalá —
        no le tires al hospital una lista de docs aleatoria.
        """
        coverage = make_coverage(
            covered=True,
            waiting_days=30,
            required_docs=("informe.pdf", "biopsia.pdf"),
        )
        policy = make_policy(start_date=date(2026, 1, 1))

        result = evaluate_authorization(
            coverage=coverage,
            policy=policy,
            attached_docs=frozenset({"informe.pdf"}),
            confidence=0.55,
            evaluation_date=EVALUATION_DATE,
        )

        assert result.outcome is Outcome.ESCALATED
        assert result.escalation_reason is EscalationReason.LOW_CONFIDENCE
        # Aún así reportamos los docs faltantes — el auditor humano querrá verlos
        assert result.missing_docs == ("biopsia.pdf",)
