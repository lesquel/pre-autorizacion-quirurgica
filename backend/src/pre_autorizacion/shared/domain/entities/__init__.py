"""Shared domain entities — entidades de dominio cross-feature."""

from pre_autorizacion.shared.domain.entities.patient import Patient, Sex
from pre_autorizacion.shared.domain.entities.procedure import Procedure

__all__ = [
    "Patient",
    "Procedure",
    "Sex",
]
