"""Fixtures portados del frontend — datos sintéticos para demo y fallback in-memory.

Se usan tanto en repos in-memory (cuando no hay credenciales de Notion) como
para hidratar los DBs de Notion en seed scripts.
"""

from pre_autorizacion.shared.fixtures.initial_cases import INITIAL_CASES
from pre_autorizacion.shared.fixtures.seed import (
    SEED_COVERAGES,
    SEED_INSURERS,
    SEED_PATIENTS,
    SEED_POLICIES,
    SEED_PROCEDURES,
)

__all__ = [
    "INITIAL_CASES",
    "SEED_COVERAGES",
    "SEED_INSURERS",
    "SEED_PATIENTS",
    "SEED_POLICIES",
    "SEED_PROCEDURES",
]
