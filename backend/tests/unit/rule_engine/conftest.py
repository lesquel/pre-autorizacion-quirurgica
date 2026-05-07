"""Helpers compartidos para los tests del rule engine.

Construir Coverage y Policy reales del dominio en cada test sería
ruidoso (muchos campos no relevantes). Estos helpers exponen factories
con defaults sanos — solo overrideás lo que importa al test.

Mantener cero I/O, cero mocks, cero networking.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pre_autorizacion.features.policies.domain.entities.coverage import Coverage
from pre_autorizacion.features.policies.domain.entities.policy import Policy, PolicyStatus


def make_coverage(
    *,
    policy_number: str = "POL-0001",
    procedure_code: str = "K80.20",
    covered: bool = True,
    waiting_days: int = 0,
    copay: Decimal = Decimal("0"),
    required_docs: tuple[str, ...] = (),
) -> Coverage:
    """Construye una Coverage minimal con defaults amigables."""
    return Coverage(
        policy_number=policy_number,
        procedure_code=procedure_code,
        covered=covered,
        waiting_days=waiting_days,
        copay=copay,
        required_docs=required_docs,
    )


def make_policy(
    *,
    number: str = "POL-0001",
    patient_id: str = "PAT-001",
    plan: str = "Premium",
    insurer_id: str = "INS-001",
    start_date: date = date(2025, 1, 1),
    end_date: date = date(2027, 1, 1),
    status: PolicyStatus = PolicyStatus.ACTIVE,
) -> Policy:
    """Construye una Policy minimal con defaults amigables (vigente, ACTIVA)."""
    return Policy(
        number=number,
        patient_id=patient_id,
        plan=plan,
        insurer_id=insurer_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
    )
