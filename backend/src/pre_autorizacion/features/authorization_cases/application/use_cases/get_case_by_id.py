"""GetCaseByIdUseCase — fetch puntual de un caso por id.

Lee del repo y, si no existe, levanta `CaseNotFoundError` (404 vía error
handler global). Sin lógica adicional: el use case es un wrapper para
mantener la consistencia arquitectónica (el router NUNCA toca el repo
directo — siempre vía use case).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pre_autorizacion.features.authorization_cases.application.use_cases.resolve_case import (
    CaseNotFoundError,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.entities import (
        AuthorizationCase,
    )
    from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
        CaseRepository,
    )


@dataclass(slots=True)
class GetCaseByIdUseCase:
    """Devuelve un caso por id; raise `CaseNotFoundError` si no existe."""

    case_repository: CaseRepository

    async def execute(self, case_id: str) -> AuthorizationCase:
        """Busca y devuelve el caso. 404 si no existe."""
        case = await self.case_repository.find_by_id(case_id)
        if case is None:
            raise CaseNotFoundError(f"No case found for id={case_id!r}")
        return case
