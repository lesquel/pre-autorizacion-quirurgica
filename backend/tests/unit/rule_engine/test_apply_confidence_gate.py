"""Tests para `apply_confidence_gate`.

Gate determinístico post-LLM (PRD §3.1.3): si confidence < threshold,
fuerza ESCALATED + LOW_CONFIDENCE — sin importar lo que diga el LLM.
"""

from __future__ import annotations

import pytest

from pre_autorizacion.features.authorization_cases.domain.value_objects.escalation_reason import (
    EscalationReason,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.outcome import Outcome
from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    apply_confidence_gate,
)


class TestApplyConfidenceGate:
    """apply_confidence_gate — gate post-LLM determinístico."""

    def test_apply_confidence_gate_approved_high_conf__passthrough(self) -> None:
        """APPROVED_AUTO con confidence alta pasa intacto."""
        outcome, reason = apply_confidence_gate(Outcome.APPROVED_AUTO, 0.95)

        assert outcome is Outcome.APPROVED_AUTO
        assert reason is None

    def test_apply_confidence_gate_approved_low_conf__forced_escalated(self) -> None:
        """APPROVED_AUTO con confidence baja → ESCALATED + LOW_CONFIDENCE."""
        outcome, reason = apply_confidence_gate(Outcome.APPROVED_AUTO, 0.79)

        assert outcome is Outcome.ESCALATED
        assert reason is EscalationReason.LOW_CONFIDENCE

    def test_apply_confidence_gate_docs_high_conf__passthrough(self) -> None:
        """DOCS_REQUESTED con confidence alta pasa intacto."""
        outcome, reason = apply_confidence_gate(Outcome.DOCS_REQUESTED, 0.95)

        assert outcome is Outcome.DOCS_REQUESTED
        assert reason is None

    def test_apply_confidence_gate_docs_low_conf__forced_escalated(self) -> None:
        """DOCS_REQUESTED con confidence baja → ESCALATED + LOW_CONFIDENCE.

        Caso clave: si el agente duda de QUÉ docs pedir, escalá — no
        pidas docs aleatorios al hospital.
        """
        outcome, reason = apply_confidence_gate(Outcome.DOCS_REQUESTED, 0.50)

        assert outcome is Outcome.ESCALATED
        assert reason is EscalationReason.LOW_CONFIDENCE

    @pytest.mark.parametrize(
        "existing_reason",
        [
            EscalationReason.WAITING_PERIOD_NOT_MET,
            EscalationReason.PROCEDURE_NOT_COVERED,
            EscalationReason.POLICY_INACTIVE,
            EscalationReason.PDF_EXTRACTION_FAILURE,
            None,  # ESCALATED sin razón (edge — defensivo)
        ],
    )
    def test_apply_confidence_gate_escalated__respects_existing_reason(
        self, existing_reason: EscalationReason | None
    ) -> None:
        """ESCALATED con confidence alta NO override la razón existente.

        Política: una vez que el rule engine determinó por qué escala,
        el gate de confidence no debe pisar esa razón con LOW_CONFIDENCE.
        """
        outcome, reason = apply_confidence_gate(
            Outcome.ESCALATED, 0.95, existing_reason=existing_reason
        )

        assert outcome is Outcome.ESCALATED
        assert reason is existing_reason

    @pytest.mark.parametrize(
        ("input_outcome", "confidence", "threshold", "expected_outcome", "expected_reason"),
        [
            # threshold custom 0.90: 0.85 ya es bajo
            (Outcome.APPROVED_AUTO, 0.85, 0.90, Outcome.ESCALATED, EscalationReason.LOW_CONFIDENCE),
            # threshold custom 0.90: 0.91 alcanza
            (Outcome.APPROVED_AUTO, 0.91, 0.90, Outcome.APPROVED_AUTO, None),
            # threshold custom 0.50: 0.55 alcanza
            (Outcome.DOCS_REQUESTED, 0.55, 0.50, Outcome.DOCS_REQUESTED, None),
            # confidence exactamente == threshold → cumple (>=, no >)
            (Outcome.APPROVED_AUTO, 0.80, 0.80, Outcome.APPROVED_AUTO, None),
        ],
    )
    def test_apply_confidence_gate_custom_threshold(
        self,
        input_outcome: Outcome,
        confidence: float,
        threshold: float,
        expected_outcome: Outcome,
        expected_reason: EscalationReason | None,
    ) -> None:
        """El threshold es parametrizable. >= threshold cumple, < threshold escala."""
        outcome, reason = apply_confidence_gate(input_outcome, confidence, threshold)

        assert outcome is expected_outcome
        assert reason is expected_reason

    def test_apply_confidence_gate_default_threshold_is_080(self) -> None:
        """El threshold por defecto es 0.80 (PRD §3.1.3)."""
        assert DEFAULT_CONFIDENCE_THRESHOLD == 0.80

        # 0.80 exactamente alcanza (gate es < threshold)
        outcome, reason = apply_confidence_gate(Outcome.APPROVED_AUTO, 0.80)
        assert outcome is Outcome.APPROVED_AUTO
        assert reason is None

        # 0.7999... no alcanza
        outcome, reason = apply_confidence_gate(Outcome.APPROVED_AUTO, 0.7999)
        assert outcome is Outcome.ESCALATED
        assert reason is EscalationReason.LOW_CONFIDENCE
