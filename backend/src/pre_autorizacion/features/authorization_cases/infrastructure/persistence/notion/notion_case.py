"""NotionCaseRepository — adapter de `CaseRepository` sobre Notion API.

Opera sobre la **DB Notion 7: CasosAutorización** (PRD §4.2.2). Persiste
agent_trace y evidence como JSON en rich_text (Notion no acepta arrays
anidados de objetos como property nativa — el agente lo guarda serializado
y lo deserializa en lectura, mismo approach que el front al consumir el caso).

`update()` traduce los campos opcionales del port en un patch parcial. Notion
acepta updates parciales (solo se mandan las keys presentes en `properties`),
así que NO necesitamos hacer un read-modify-write.

`find_by_id` filtra por la property `CaseId` (rich_text) en vez del page_id
real porque el dominio usa el id de negocio (`'CASE-01H7K2'`) como identidad
estable, NO el page_id de Notion (que cambia si se borra y recrea la page).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pre_autorizacion.features.authorization_cases.domain.entities.authorization_case import (
    AuthorizationCase,
)
from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
    CaseRepository,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.agent_decision import (
    AgentDecision,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.case_status import (
    CaseStatus,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.trace_step import TraceStep
from pre_autorizacion.shared.notion import NotionClient
from pre_autorizacion.shared.notion.entities import (
    authorization_case_to_notion_props,
    notion_to_authorization_case,
    serialize_evidence,
    serialize_trace,
)
from pre_autorizacion.shared.notion.mappers import (
    make_datetime,
    make_multi_select,
    make_number,
    make_rich_text,
    make_select,
)


class NotionCaseRepository(CaseRepository):
    """Adapter Notion del repo de casos.

    Args:
        notion_client:        wrapper async de Notion.
        database_id_cases:    page_id de la DB CasosAutorización.
        database_id_reports:  page_id de la DB InformesMédicos. No se usa en
                              read pero queda inyectado para que un futuro
                              `create()` que linkee el report pueda resolver
                              el page_id sin tocar el ctor.
    """

    def __init__(
        self,
        notion_client: NotionClient,
        database_id_cases: str,
        database_id_reports: str,
    ) -> None:
        self._client = notion_client
        self._database_id_cases = database_id_cases
        self._database_id_reports = database_id_reports

    async def list(self) -> tuple[AuthorizationCase, ...]:
        pages = await self._client.query_database(self._database_id_cases)
        return tuple(notion_to_authorization_case(p) for p in pages)

    async def find_by_id(self, case_id: str) -> AuthorizationCase | None:
        page = await self._find_page_by_case_id(case_id)
        if page is None:
            return None
        return notion_to_authorization_case(page)

    async def create(self, case: AuthorizationCase) -> None:
        # Resolución de relations: el caller pasa el `case` con `report_id` y
        # `policy_number` (ids de negocio). Para linkear las relations a las
        # pages reales hay que hacer 2 lookups. Como el contrato del port no
        # nos da los page_ids, los resolvemos acá. Si no se encuentran, las
        # relations quedan vacías — la fuente de verdad para el back son los
        # rich_text PolicyNumber/ReportId, no las relations.
        report_page_id = await self._lookup_report_page_id(case.report_id)
        policy_page_id = await self._lookup_policy_page_id(case.policy_number)
        props = authorization_case_to_notion_props(
            case,
            report_page_id=report_page_id,
            policy_page_id=policy_page_id,
        )
        await self._client.create_page(self._database_id_cases, props)

    async def update(
        self,
        case_id: str,
        *,
        status: CaseStatus | None = None,
        decision: AgentDecision | None = None,
        agent_trace: tuple[TraceStep, ...] | None = None,
        decided_at: datetime | None = None,
    ) -> None:
        page = await self._find_page_by_case_id(case_id)
        if page is None:
            # Idempotencia: NO levantamos.
            return
        page_id = page.get("id")
        if not isinstance(page_id, str):
            return
        patch: dict[str, Any] = {}
        if status is not None:
            patch["Estado"] = make_select(status.value)
        if decision is not None:
            patch["Outcome"] = make_select(decision.outcome.value)
            patch["Rationale"] = make_rich_text(decision.rationale)
            patch["Confidence"] = make_number(decision.confidence)
            patch["Evidence"] = make_rich_text(serialize_evidence(decision.evidence))
            patch["MissingDocs"] = make_multi_select(decision.missing_docs)
            patch["MotivoEscalamiento"] = make_select(
                decision.escalation_reason.value if decision.escalation_reason else None,
            )
            patch["DecidedBy"] = make_select(decision.decided_by.value)
            patch["ModelUsed"] = make_rich_text(decision.model_used or "")
        if agent_trace is not None:
            patch["TrazaAgente"] = make_rich_text(serialize_trace(agent_trace))
        if decided_at is not None:
            patch["DecidedAt"] = make_datetime(decided_at)
        if not patch:
            return
        await self._client.update_page(page_id, patch)

    # ─── Helpers privados ───────────────────────────────────────────────

    async def _find_page_by_case_id(self, case_id: str) -> dict[str, Any] | None:
        filter_: dict[str, Any] = {
            "property": "CaseId",
            "rich_text": {"equals": case_id},
        }
        pages = await self._client.query_database(self._database_id_cases, filter=filter_)
        return pages[0] if pages else None

    async def _lookup_report_page_id(self, report_id: str) -> str | None:
        if not report_id:
            return None
        filter_: dict[str, Any] = {
            "property": "Identificador",
            "title": {"equals": report_id},
        }
        pages = await self._client.query_database(self._database_id_reports, filter=filter_)
        if not pages:
            return None
        page_id = pages[0].get("id")
        return page_id if isinstance(page_id, str) else None

    async def _lookup_policy_page_id(self, policy_number: str) -> str | None:
        # Lookup en la DB Pólizas. Necesitaríamos su id; el contrato actual del
        # ctor sólo nos da `database_id_cases` y `_reports`. Para no romper la
        # firma del port, devolvemos None — la relation queda vacía y el
        # `PolicyNumber` rich_text es la fuente de verdad. Si más adelante el
        # caller quiere relations completas, puede inyectar un repo de pólizas
        # y hacer el lookup en application antes de llamar al adapter.
        del policy_number  # explícito: dejamos el parámetro documentado.
        return None
