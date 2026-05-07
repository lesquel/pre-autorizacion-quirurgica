"""Tests para `check_waiting_period`.

Carencia: días mínimos desde `policy.start_date` durante los cuales
ciertos procedimientos NO están cubiertos. Función pura: date math
sobre `evaluation_date - policy.start_date` vs `coverage.waiting_days`.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from pre_autorizacion.features.authorization_cases.infrastructure.decision.rule_engine import (
    WaitingPeriodResult,
    check_waiting_period,
)
from tests.unit.rule_engine.conftest import make_coverage, make_policy


class TestCheckWaitingPeriod:
    """check_waiting_period — calcula carencia (date math determinístico)."""

    def test_check_waiting_period_exact_days__met(self) -> None:
        """Si transcurrieron exactamente los días requeridos, la carencia se cumple."""
        start = date(2026, 1, 1)
        coverage = make_coverage(waiting_days=90)
        policy = make_policy(start_date=start)
        evaluation = start + timedelta(days=90)

        result = check_waiting_period(coverage, policy, evaluation)

        assert result == WaitingPeriodResult(
            met=True, days_elapsed=90, days_required=90, days_short=0
        )

    def test_check_waiting_period_one_day_short__not_met(self) -> None:
        """Un día menos del requerido → no cumple, days_short=1."""
        start = date(2026, 1, 1)
        coverage = make_coverage(waiting_days=90)
        policy = make_policy(start_date=start)
        evaluation = start + timedelta(days=89)

        result = check_waiting_period(coverage, policy, evaluation)

        assert result.met is False
        assert result.days_elapsed == 89
        assert result.days_required == 90
        assert result.days_short == 1

    def test_check_waiting_period_one_day_over__met(self) -> None:
        """Un día más que requerido → cumple, days_short=0."""
        start = date(2026, 1, 1)
        coverage = make_coverage(waiting_days=90)
        policy = make_policy(start_date=start)
        evaluation = start + timedelta(days=91)

        result = check_waiting_period(coverage, policy, evaluation)

        assert result.met is True
        assert result.days_elapsed == 91
        assert result.days_required == 90
        assert result.days_short == 0

    def test_check_waiting_period_zero_waiting__met_immediately(self) -> None:
        """Carencia 0 → cumple desde el día 0 de la póliza."""
        start = date(2026, 5, 6)
        coverage = make_coverage(waiting_days=0)
        policy = make_policy(start_date=start)

        result = check_waiting_period(coverage, policy, evaluation_date=start)

        assert result == WaitingPeriodResult(
            met=True, days_elapsed=0, days_required=0, days_short=0
        )

    def test_check_waiting_period_90d_with_100d_elapsed__met(self) -> None:
        """Carencia 90, transcurrieron 100 → cumple holgadamente."""
        start = date(2026, 1, 1)
        coverage = make_coverage(waiting_days=90)
        policy = make_policy(start_date=start)
        evaluation = start + timedelta(days=100)

        result = check_waiting_period(coverage, policy, evaluation)

        assert result.met is True
        assert result.days_elapsed == 100
        assert result.days_short == 0

    def test_check_waiting_period_90d_with_89d_elapsed__not_met(self) -> None:
        """Carencia 90, transcurrieron 89 → no cumple, falta 1 día."""
        start = date(2026, 1, 1)
        coverage = make_coverage(waiting_days=90)
        policy = make_policy(start_date=start)
        evaluation = start + timedelta(days=89)

        result = check_waiting_period(coverage, policy, evaluation)

        assert result.met is False
        assert result.days_elapsed == 89
        assert result.days_short == 1

    def test_check_waiting_period_evaluation_equals_start__met_iff_zero_waiting(self) -> None:
        """evaluation_date == start_date → days_elapsed=0; cumple solo si waiting=0."""
        start = date(2026, 5, 6)
        coverage = make_coverage(waiting_days=5)
        policy = make_policy(start_date=start)

        result = check_waiting_period(coverage, policy, evaluation_date=start)

        assert result.met is False
        assert result.days_elapsed == 0
        assert result.days_required == 5
        assert result.days_short == 5

    def test_check_waiting_period_evaluation_before_start__not_met_with_negative_elapsed(
        self,
    ) -> None:
        """Póliza arranca en el futuro → days_elapsed negativo, no cumple."""
        start = date(2026, 6, 1)
        coverage = make_coverage(waiting_days=30)
        policy = make_policy(start_date=start)
        evaluation = date(2026, 5, 6)  # 26 días ANTES de start

        result = check_waiting_period(coverage, policy, evaluation)

        assert result.met is False
        assert result.days_elapsed == -26
        assert result.days_required == 30
        # Para alcanzar la carencia desde "hoy" faltan 30 - (-26) = 56 días
        assert result.days_short == 56

    @pytest.mark.parametrize(
        ("waiting_days", "elapsed_days", "expected_met", "expected_short"),
        [
            (30, 30, True, 0),
            (30, 29, False, 1),
            (30, 31, True, 0),
            (180, 90, False, 90),
            (60, 200, True, 0),
        ],
    )
    def test_check_waiting_period_parametrized(
        self,
        waiting_days: int,
        elapsed_days: int,
        expected_met: bool,
        expected_short: int,
    ) -> None:
        """Tabla parametrizada para validar el cálculo en múltiples escenarios."""
        start = date(2026, 1, 1)
        coverage = make_coverage(waiting_days=waiting_days)
        policy = make_policy(start_date=start)
        evaluation = start + timedelta(days=elapsed_days)

        result = check_waiting_period(coverage, policy, evaluation)

        assert result.met is expected_met
        assert result.days_elapsed == elapsed_days
        assert result.days_required == waiting_days
        assert result.days_short == expected_short
