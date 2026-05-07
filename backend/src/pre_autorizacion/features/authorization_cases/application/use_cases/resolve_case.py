"""ResolveCaseUseCase — el auditor cierra un caso escalado.

PRD §3.1.3: el agente NUNCA auto-rechaza. Si llega `REJECTED`, el origen es
SIEMPRE el auditor humano vía este use case (decided_by=AUDITOR, confidence=1.0).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Literal

from pre_autorizacion.features.authorization_cases.domain.value_objects import (
    AgentDecision,
    CaseStatus,
    DecidedBy,
    Outcome,
)
from pre_autorizacion.shared.domain.errors import NotFoundError, ValidationError

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.entities import (
        AuthorizationCase,
    )
    from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
        CaseRepository,
    )


class CaseNotFoundError(NotFoundError):
    """No existe un caso con ese id."""

    title = "Case not found"


ResolveOutcome = Literal["APPROVED", "REJECTED"]


@dataclass(frozen=True, slots=True)
class ResolveCaseInput:
    """Input del use case `ResolveCaseUseCase`.

    Campos:
        case_id:   id del caso a cerrar (debe estar en ESCALADO).
        outcome:   `"APPROVED"` o `"REJECTED"` — decisión del auditor.
        message:   mensaje humano final (lo que verá el hospital).
        reasoning: razonamiento auditable (rationale del auditor).
    """

    case_id: str
    outcome: ResolveOutcome
    message: str
    reasoning: str


@dataclass(slots=True)
class ResolveCaseUseCase:
    """Cierra un caso escalado con la decisión del auditor."""

    case_repository: CaseRepository

    async def execute(self, input: ResolveCaseInput) -> AuthorizationCase:
        """Aplica la decisión del auditor al caso identificado por `case_id`.

        Reglas:
            - El caso debe existir → si no, `CaseNotFoundError` (404).
            - `outcome` debe ser `"APPROVED"` o `"REJECTED"` → si no, `ValidationError`.
            - Status final → `DECIDIDO`. Decisión queda con `decided_by=AUDITOR`,
              `confidence=1.0` (humano en el loop).
            - El `outcome` interno de la decisión queda como `Outcome.DECIDED`
              (estado terminal de visualización, alineado con el front).
        """
        if input.outcome not in ("APPROVED", "REJECTED"):
            raise ValidationError(
                f"Invalid resolve outcome: {input.outcome!r}. "
                "Expected 'APPROVED' or 'REJECTED'."
            )

        existing = await self.case_repository.find_by_id(input.case_id)
        if existing is None:
            raise CaseNotFoundError(f"No case found for id={input.case_id!r}")

        decided_at = datetime.now(UTC)
        rationale = (
            f"[{input.outcome}] {input.message}\n\n{input.reasoning}".strip()
        )
        decision = AgentDecision(
            outcome=Outcome.DECIDED,
            rationale=rationale,
            confidence=1.0,
            decided_by=DecidedBy.AUDITOR,
            evidence=(),
            missing_docs=(),
            escalation_reason=None,
            model_used=None,
        )

        await self.case_repository.update(
            input.case_id,
            status=CaseStatus.DECIDIDO,
            decision=decision,
            decided_at=decided_at,
        )

        refreshed = await self.case_repository.find_by_id(input.case_id)
        if refreshed is None:
            # Defensive: should be impossible right after a successful update.
            raise CaseNotFoundError(f"Case {input.case_id!r} disappeared after update")
        return refreshed
