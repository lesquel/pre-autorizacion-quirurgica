"""ListCasesUseCase — listado paginado de casos, filtrable por rol y status.

Roles:
- HOSPITAL : ve todos sus casos (en MVP no filtramos por hospital — todos los casos).
- INSURER  : ve todos los casos de su aseguradora (MVP: todos los casos).
- AUDITOR  : SOLO ve casos en `ESCALADO` o `DECIDIDO` (carga de trabajo + historial).

Filtros adicionales: `status`, `limit`, `offset`. El orden por default es
`created_at` descendente (más recientes primero).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pre_autorizacion.features.authorization_cases.domain.value_objects import CaseStatus
from pre_autorizacion.features.auth.domain.entities import Role

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.entities import (
        AuthorizationCase,
    )
    from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
        CaseRepository,
    )


_AUDITOR_VISIBLE: frozenset[CaseStatus] = frozenset(
    {CaseStatus.ESCALADO, CaseStatus.DECIDIDO}
)
"""Status que el auditor puede ver — carga de trabajo (escalados) + historial."""


@dataclass(frozen=True, slots=True)
class ListCasesFilter:
    """Filtros para el listado.

    Campos:
        role:   rol del usuario solicitante. Determina qué casos puede ver.
        status: filtro adicional por status del caso.
        limit:  máximo de elementos a devolver (default 50).
        offset: cantidad a saltar (paginación, default 0).
    """

    role: Role | None = None
    status: CaseStatus | None = None
    limit: int = 50
    offset: int = 0


@dataclass(slots=True)
class ListCasesUseCase:
    """Lista casos aplicando filtros de rol + status."""

    case_repository: CaseRepository

    async def execute(
        self,
        filter: ListCasesFilter | None = None,
    ) -> tuple[AuthorizationCase, ...]:
        """Devuelve los casos visibles para el rol, ordenados desc por `created_at`."""
        f = filter or ListCasesFilter()
        all_cases = await self.case_repository.list()

        # Filter por rol
        if f.role is Role.AUDITOR:
            cases = tuple(c for c in all_cases if c.status in _AUDITOR_VISIBLE)
        else:
            # HOSPITAL e INSURER en MVP ven todos. La granularidad de
            # "solo casos del hospital X" / "solo casos de la aseguradora Y"
            # se introduce post-MVP cuando el modelo de tenancy esté definido.
            cases = all_cases

        # Filter por status (sobre el set ya filtrado por rol)
        if f.status is not None:
            cases = tuple(c for c in cases if c.status == f.status)

        # Orden desc por created_at (más recientes primero) — determinista para tests.
        ordered = tuple(sorted(cases, key=lambda c: c.created_at, reverse=True))

        # Pagination (clamp para que limit/offset negativos no rompan)
        offset = max(0, f.offset)
        limit = max(0, f.limit)
        return ordered[offset : offset + limit]
