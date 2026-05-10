"""DTOs del feature `procedures`."""

from __future__ import annotations

from pre_autorizacion.shared.api.schemas import CamelModel
from pre_autorizacion.shared.domain.entities import Procedure


class ProcedureOut(CamelModel):
    code: str
    name: str
    category: str | None = None
    waiting_days_typical: int | None = None


class ProcedureIn(CamelModel):
    """Body de POST/PUT /procedures."""

    code: str
    name: str
    category: str | None = None
    waiting_days_typical: int | None = None


def procedure_to_out(p: Procedure) -> ProcedureOut:
    return ProcedureOut(
        code=p.code,
        name=p.name,
        category=p.category,
        waiting_days_typical=p.waiting_days_typical,
    )


def procedure_in_to_domain(body: ProcedureIn) -> Procedure:
    return Procedure(
        code=body.code,
        name=body.name,
        category=body.category,
        waiting_days_typical=body.waiting_days_typical,
    )


__all__ = [
    "ProcedureIn",
    "ProcedureOut",
    "procedure_in_to_domain",
    "procedure_to_out",
]
