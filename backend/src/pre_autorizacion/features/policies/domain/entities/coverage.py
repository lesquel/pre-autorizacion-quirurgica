"""Coverage — fila póliza × procedimiento.
PRD §4.2.2 (DB Notion 5: Coberturas).

Port directo de `frontend/src/app/features/policies/domain/entities/coverage.ts`.

Decisiones de mapping TS → Python:
- `requiredDocs: readonly string[]` → `required_docs: tuple[str, ...]` (immutable).
  Las frozen dataclasses no admiten `list` mutable como default; `tuple` es la
  contraparte natural y respeta el contrato `readonly`.
- `copay`: el TS usa `number` (USD). En Python se modela como `Decimal` para
  precisión monetaria — así una corrida del rule engine que use `>= 0` o
  comparaciones contra strings no acumula error de coma flotante. El parseo
  desde JSON (`float`) → `Decimal` sucede en infrastructure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class Coverage:
    """Coverage — entidad inmutable de cobertura póliza × procedimiento."""

    policy_number: str
    procedure_code: str
    covered: bool
    waiting_days: int
    copay: Decimal
    required_docs: tuple[str, ...] = field(default_factory=tuple)
