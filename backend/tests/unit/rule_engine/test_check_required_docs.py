"""Tests para `check_required_docs`.

Set diff puro: `coverage.required_docs` (tuple) vs `attached_docs` (frozenset).
Devuelve missing ordenado alfabéticamente para output determinístico.
"""

from __future__ import annotations

import pytest

from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    RequiredDocsResult,
    check_required_docs,
)
from tests.unit.rule_engine.conftest import make_coverage


class TestCheckRequiredDocs:
    """check_required_docs — set diff determinístico."""

    def test_check_required_docs_empty_required__always_complete(self) -> None:
        """Sin docs requeridos, cualquier set adjunto es completo."""
        coverage = make_coverage(required_docs=())

        result = check_required_docs(coverage, frozenset())
        assert result == RequiredDocsResult(complete=True, missing=())

        result_with_extras = check_required_docs(coverage, frozenset({"extra.pdf"}))
        assert result_with_extras == RequiredDocsResult(complete=True, missing=())

    def test_check_required_docs_exact_match__complete(self) -> None:
        """Set requerido idéntico al adjunto → complete=True."""
        coverage = make_coverage(required_docs=("informe.pdf", "biopsia.pdf"))
        attached = frozenset({"informe.pdf", "biopsia.pdf"})

        result = check_required_docs(coverage, attached)

        assert result == RequiredDocsResult(complete=True, missing=())

    def test_check_required_docs_attached_superset__complete(self) -> None:
        """Adjuntos contienen los requeridos y más → complete=True."""
        coverage = make_coverage(required_docs=("informe.pdf",))
        attached = frozenset({"informe.pdf", "extra1.pdf", "extra2.pdf"})

        result = check_required_docs(coverage, attached)

        assert result == RequiredDocsResult(complete=True, missing=())

    def test_check_required_docs_one_missing__incomplete_with_that_one(self) -> None:
        """Falta uno → complete=False, missing contiene exactamente ese."""
        coverage = make_coverage(required_docs=("informe.pdf", "biopsia.pdf"))
        attached = frozenset({"informe.pdf"})

        result = check_required_docs(coverage, attached)

        assert result == RequiredDocsResult(complete=False, missing=("biopsia.pdf",))

    def test_check_required_docs_two_missing__incomplete_alphabetical(self) -> None:
        """Faltan dos → missing ordenado alfabéticamente para determinismo."""
        coverage = make_coverage(
            required_docs=("informe.pdf", "biopsia.pdf", "ecografia.pdf")
        )
        attached = frozenset({"informe.pdf"})

        result = check_required_docs(coverage, attached)

        assert result.complete is False
        # Orden alfabético: 'biopsia.pdf' < 'ecografia.pdf'
        assert result.missing == ("biopsia.pdf", "ecografia.pdf")

    def test_check_required_docs_disjoint_sets__missing_is_full_required(self) -> None:
        """Adjuntos completamente distintos a requeridos → falta TODO el required."""
        coverage = make_coverage(required_docs=("a.pdf", "b.pdf", "c.pdf"))
        attached = frozenset({"x.pdf", "y.pdf"})

        result = check_required_docs(coverage, attached)

        assert result.complete is False
        assert result.missing == ("a.pdf", "b.pdf", "c.pdf")

    @pytest.mark.parametrize(
        ("required", "attached", "expected_complete", "expected_missing"),
        [
            # Caso simple OK
            (("a.pdf",), frozenset({"a.pdf"}), True, ()),
            # Una falta
            (("a.pdf", "b.pdf"), frozenset({"a.pdf"}), False, ("b.pdf",)),
            # Insensible a duplicados en required (tuple → frozenset normaliza)
            (("a.pdf", "a.pdf"), frozenset({"a.pdf"}), True, ()),
            # Required ordenado descendentemente — el output sigue alfabético
            (("z.pdf", "a.pdf"), frozenset({"a.pdf"}), False, ("z.pdf",)),
        ],
    )
    def test_check_required_docs_parametrized(
        self,
        required: tuple[str, ...],
        attached: frozenset[str],
        expected_complete: bool,
        expected_missing: tuple[str, ...],
    ) -> None:
        """Tabla parametrizada de set-diff con orden alfabético garantizado."""
        coverage = make_coverage(required_docs=required)

        result = check_required_docs(coverage, attached)

        assert result.complete is expected_complete
        assert result.missing == expected_missing
