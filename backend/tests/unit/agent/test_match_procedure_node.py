"""Tests para `match_procedure_node` — invariantes safety-critical.

Issues #2 y #3: el agente reportaba `APPROVED_AUTO` con `confidence=0.00`
porque `match_score` se calculaba como `1.0` para match exacto sin
considerar `extraction.confidence`. El fix (commit `bb8f32c`) cap el
score por la confidence de la extracción para que un PDF malo (low
confidence) no pueda inflar artificialmente el match.

Estos tests congelan los invariantes:
- Match exacto + confidence=0.30 → score=0.30 (NO 1.0).
- Fuzzy: score = raw_similarity × confidence.
- extracted=None → score=0.0, procedure_covered=False.
- procedure_covered = covered AND score >= 0.85.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from pre_autorizacion.features.authorization_cases.application.agent.nodes.match_procedure import (
    match_procedure_node,
)
from pre_autorizacion.features.authorization_cases.application.agent.state import (
    AgentGraphState,
)
from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (
    ExtractedMedicalReport,
)
from pre_autorizacion.features.policies.domain.entities import Coverage


def _make_coverage(
    *, procedure_code: str = "COL-LAP", covered: bool = True, waiting_days: int = 30
) -> Coverage:
    """Builder mínimo de Coverage para los tests."""
    return Coverage(
        policy_number="POL-001",
        procedure_code=procedure_code,
        covered=covered,
        waiting_days=waiting_days,
        copay=Decimal("0"),
        required_docs=(),
    )


def _make_extracted(
    *,
    procedure_code: str | None = "COL-LAP",
    procedure_name: str | None = "Colecistectomía laparoscópica",
    confidence: float = 0.95,
) -> ExtractedMedicalReport:
    """Builder mínimo de ExtractedMedicalReport para los tests."""
    return ExtractedMedicalReport(
        extracted_procedure_name=procedure_name,
        extracted_procedure_code=procedure_code,
        extracted_diagnosis_code="K80.20",
        extracted_diagnosis_description="Colelitiasis",
        confidence=confidence,
        evidence_quotes=("informe dice X",),
    )


def _make_state(
    *, coverage: Coverage, extracted: ExtractedMedicalReport | None
) -> AgentGraphState:
    """State mínimo del grafo para invocar el nodo aislado."""
    state: AgentGraphState = {
        "coverage": coverage,
        "extracted": extracted,
        "trace_steps": [],
        "errors": [],
    }
    return state


class TestMatchProcedureNodeExactMatch:
    """Match exacto del código entre extracción y coverage."""

    async def test_exact_code_match_high_confidence__score_equals_confidence(
        self,
    ) -> None:
        """Match exacto + confidence=0.95 → score=0.95 (capado, no 1.0)."""
        coverage = _make_coverage(procedure_code="COL-LAP")
        extracted = _make_extracted(procedure_code="COL-LAP", confidence=0.95)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] == pytest.approx(0.95)
        assert patch["procedure_covered"] is True

    async def test_exact_code_match_perfect_confidence__score_capped_at_one(
        self,
    ) -> None:
        """Confidence > 1.0 (defensivo) → score capado en 1.0."""
        coverage = _make_coverage(procedure_code="COL-LAP")
        extracted = _make_extracted(procedure_code="COL-LAP", confidence=1.5)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] == 1.0
        assert patch["procedure_covered"] is True

    async def test_exact_code_match_low_confidence__breaks_false_positive_chain(
        self,
    ) -> None:
        """Issue #3 regresión guard: confidence=0.30 + match exacto NO debe
        producir score=1.0. Tiene que dar 0.30 → procedure_covered=False
        → persist_case escala con LOW_CONFIDENCE_PROCEDURE_MATCH.

        Este es el invariante que rompe la cadena false-positive
        APPROVED_AUTO@0.00.
        """
        coverage = _make_coverage(procedure_code="COL-LAP")
        extracted = _make_extracted(procedure_code="COL-LAP", confidence=0.30)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] == pytest.approx(0.30)
        assert patch["procedure_covered"] is False, (
            "match exacto con confidence=0.30 NO debe pasar el threshold 0.85 "
            "— si vuelve a True, la cadena false-positive se reintroduce"
        )

    async def test_exact_code_match_zero_confidence__score_is_zero(self) -> None:
        """confidence=0.0 → score=0.0 aunque los códigos coincidan."""
        coverage = _make_coverage(procedure_code="COL-LAP")
        extracted = _make_extracted(procedure_code="COL-LAP", confidence=0.0)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] == 0.0
        assert patch["procedure_covered"] is False

    async def test_exact_code_match_normalization__case_insensitive(self) -> None:
        """`COL-LAP` debe matchear `col-lap` (normalize lower + strip)."""
        coverage = _make_coverage(procedure_code="COL-LAP")
        extracted = _make_extracted(procedure_code="  col-lap  ", confidence=0.90)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] == pytest.approx(0.90)


class TestMatchProcedureNodeFuzzyMatch:
    """Match fuzzy por similaridad de nombre (cuando los códigos no coinciden)."""

    async def test_fuzzy_match__score_is_similarity_times_confidence(self) -> None:
        """Fuzzy: score = raw_similarity × confidence (NO max, NO addition)."""
        coverage = _make_coverage(procedure_code="LAS-MIO")
        extracted = _make_extracted(
            procedure_code="DIFFERENT",
            procedure_name="LAS-MIO",  # nombre idéntico al code → similarity = 1.0
            confidence=0.50,
        )
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        # similarity 1.0 × 0.50 = 0.50, NO 1.0
        assert patch["procedure_match_score"] == pytest.approx(0.50)
        assert patch["procedure_covered"] is False  # 0.50 < 0.85

    async def test_fuzzy_match_no_similarity__score_zero(self) -> None:
        """Sin similaridad de nombre y confidence alta → score=0.0."""
        coverage = _make_coverage(procedure_code="LAS-MIO")
        extracted = _make_extracted(
            procedure_code="DIFFERENT",
            procedure_name="zzzzzzzzz",
            confidence=0.99,
        )
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        # similarity baja × confidence 0.99 sigue siendo bajo
        assert patch["procedure_match_score"] < 0.85
        assert patch["procedure_covered"] is False

    async def test_fuzzy_match_high_confidence_high_similarity__above_threshold(
        self,
    ) -> None:
        """Similaridad alta + confidence alta → puede pasar el threshold."""
        coverage = _make_coverage(procedure_code="LAS-MIO")
        extracted = _make_extracted(
            procedure_code="OTHER",
            procedure_name="LAS-MIO",
            confidence=0.95,
        )
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        # 1.0 × 0.95 = 0.95 >= 0.85
        assert patch["procedure_match_score"] == pytest.approx(0.95)
        assert patch["procedure_covered"] is True


class TestMatchProcedureNodeNoExtraction:
    """Sin extracción del LLM (`extracted=None`)."""

    async def test_no_extraction__score_zero_not_covered(self) -> None:
        """`extracted=None` → score=0.0, procedure_covered=False."""
        coverage = _make_coverage(procedure_code="COL-LAP", covered=True)
        state = _make_state(coverage=coverage, extracted=None)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] == 0.0
        assert patch["procedure_covered"] is False


class TestMatchProcedureNodeCoverageNotCovered:
    """Coverage marca `covered=False` (procedimiento explícitamente excluido)."""

    async def test_exact_match_but_coverage_not_covered__not_covered(self) -> None:
        """Score puede ser alto pero `covered=False` en Coverage corta el match."""
        coverage = _make_coverage(procedure_code="COL-LAP", covered=False)
        extracted = _make_extracted(procedure_code="COL-LAP", confidence=0.95)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        # score alto pero covered=False en la cobertura → procedure_covered False
        assert patch["procedure_match_score"] == pytest.approx(0.95)
        assert patch["procedure_covered"] is False


class TestMatchProcedureNodeThreshold:
    """Boundary del threshold por defecto (0.85)."""

    async def test_score_exactly_at_threshold__procedure_covered_true(self) -> None:
        """score == 0.85 cumple (>=, no >)."""
        coverage = _make_coverage(procedure_code="COL-LAP")
        # confidence=0.85 + match exacto → score=0.85
        extracted = _make_extracted(procedure_code="COL-LAP", confidence=0.85)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] == pytest.approx(0.85)
        assert patch["procedure_covered"] is True

    async def test_score_just_below_threshold__procedure_covered_false(self) -> None:
        """score = 0.849... NO cumple."""
        coverage = _make_coverage(procedure_code="COL-LAP")
        extracted = _make_extracted(procedure_code="COL-LAP", confidence=0.84)
        state = _make_state(coverage=coverage, extracted=extracted)

        patch = await match_procedure_node(state)

        assert patch["procedure_match_score"] < 0.85
        assert patch["procedure_covered"] is False
