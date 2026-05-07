"""Entity mappers Notion ↔ dominio.

Cada entidad del dominio tiene dos funciones:
- `notion_to_<entity>(page) -> Entity`            : lee una page de Notion.
- `<entity>_to_notion_props(entity) -> dict`      : produce el `properties`
                                                    para `pages.create` /
                                                    `pages.update`.

Los **nombres de propiedades** siguen exactamente el PRD §4.2.2 (Spanish,
TitleCase). Si el operador renombra una columna en Notion, sólo hay que
cambiar la constante acá — los mappers absorben el cambio.

Convenciones:
- Status / Outcome / EscalationReason → Notion `select` con `.value` del enum
  como `name` (case-sensitive, MATTERS — el frontend ya espera ese case).
- Relations → page_ids (tuple[str, ...]). Si el caller solo conoce el dato
  de negocio (DNI del paciente, número de póliza), debe resolver el page_id
  ANTES de llamar al mapper — los mappers NO hacen lookups.
- `agent_trace` se serializa como JSON string en una property `rich_text`
  porque Notion no soporta arrays anidados de objetos. Mismo approach para
  `evidence` (PRD §4.2.2 — TrazaAgente y Evidence son rich_text JSON).
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from pre_autorizacion.features.authorization_cases.domain.entities.authorization_case import (
    AuthorizationCase,
)
from pre_autorizacion.features.authorization_cases.domain.entities.medical_report import (
    MedicalReport,
    ReportFormat,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.agent_decision import (
    AgentDecision,
    DecidedBy,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.case_status import (
    CaseStatus,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.escalation_reason import (
    EscalationReason,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.evidence import (
    Evidence,
    EvidenceSource,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.outcome import Outcome
from pre_autorizacion.features.authorization_cases.domain.value_objects.trace_step import (
    TraceStep,
    TraceStepState,
)
from pre_autorizacion.features.policies.domain.entities.coverage import Coverage
from pre_autorizacion.features.policies.domain.entities.insurer import Insurer
from pre_autorizacion.features.policies.domain.entities.policy import Policy, PolicyStatus
from pre_autorizacion.shared.domain.entities.patient import Patient, Sex
from pre_autorizacion.shared.domain.entities.procedure import Procedure
from pre_autorizacion.shared.notion.errors import NotionMappingError
from pre_autorizacion.shared.notion.mappers import (
    make_checkbox,
    make_date,
    make_datetime,
    make_email,
    make_multi_select,
    make_number,
    make_relation,
    make_rich_text,
    make_select,
    make_title,
    read_checkbox,
    read_date,
    read_datetime,
    read_email,
    read_multi_select,
    read_number,
    read_relation,
    read_rich_text,
    read_select,
    read_title,
)


# ─── Helpers comunes ───────────────────────────────────────────────────────


def _props(page: dict[str, Any]) -> dict[str, Any]:
    """Devuelve `page['properties']` con un fallback robusto para mypy."""
    p = page.get("properties")
    if not isinstance(p, dict):
        raise NotionMappingError(f"Page {page.get('id')!r} has no properties dict.")
    return p


# ─── Patient (DB Notion 1: Pacientes) ──────────────────────────────────────
# Properties: Nombre (title), DNI (rich_text), FechaNacimiento (date),
# Sexo (select: M | F | X)


def notion_to_patient(page: dict[str, Any]) -> Patient:
    p = _props(page)
    dob = read_date(p.get("FechaNacimiento"))
    if dob is None:
        raise NotionMappingError(f"Patient {page.get('id')!r} missing FechaNacimiento.")
    sex_raw = read_select(p.get("Sexo")) or "X"
    try:
        sex = Sex(sex_raw)
    except ValueError as exc:
        raise NotionMappingError(f"Patient invalid Sexo {sex_raw!r}.") from exc
    return Patient(
        id=str(page.get("id", "")),
        name=read_title(p.get("Nombre")),
        dni=read_rich_text(p.get("DNI")),
        dob=dob,
        sex=sex,
    )


def patient_to_notion_props(patient: Patient) -> dict[str, Any]:
    return {
        "Nombre": make_title(patient.name),
        "DNI": make_rich_text(patient.dni),
        "FechaNacimiento": make_date(patient.dob),
        "Sexo": make_select(patient.sex.value),
    }


# ─── Insurer (DB Notion 2: Aseguradoras) ───────────────────────────────────
# Properties: Nombre (title), Email (email)


def notion_to_insurer(page: dict[str, Any]) -> Insurer:
    p = _props(page)
    return Insurer(
        id=str(page.get("id", "")),
        name=read_title(p.get("Nombre")),
        email=read_email(p.get("Email")),
    )


def insurer_to_notion_props(insurer: Insurer) -> dict[str, Any]:
    return {
        "Nombre": make_title(insurer.name),
        "Email": make_email(insurer.email),
    }


# ─── Procedure (DB Notion 3: Procedimientos) ───────────────────────────────
# Properties: CodigoCIE10 (title), Nombre (rich_text), Categoria (select),
# Descripcion (rich_text), DiasCarenciaTipico (number)


def notion_to_procedure(page: dict[str, Any]) -> Procedure:
    p = _props(page)
    waiting = read_number(p.get("DiasCarenciaTipico"))
    return Procedure(
        code=read_title(p.get("CodigoCIE10")),
        name=read_rich_text(p.get("Nombre")),
        category=read_select(p.get("Categoria")),
        waiting_days_typical=int(waiting) if waiting is not None else None,
    )


def procedure_to_notion_props(procedure: Procedure) -> dict[str, Any]:
    return {
        "CodigoCIE10": make_title(procedure.code),
        "Nombre": make_rich_text(procedure.name),
        "Categoria": make_select(procedure.category),
        "DiasCarenciaTipico": make_number(procedure.waiting_days_typical),
    }


# ─── Policy (DB Notion 4: Pólizas) ─────────────────────────────────────────
# Properties: NumeroPoliza (title), Paciente (relation), Aseguradora (relation),
# Plan (rich_text), FechaInicio (date), FechaFin (date),
# Estado (select: ACTIVE | INACTIVE | SUSPENDED)


def notion_to_policy(page: dict[str, Any]) -> Policy:
    p = _props(page)
    start = read_date(p.get("FechaInicio"))
    end = read_date(p.get("FechaFin"))
    if start is None or end is None:
        raise NotionMappingError(f"Policy {page.get('id')!r} missing FechaInicio/FechaFin.")
    status_raw = read_select(p.get("Estado")) or PolicyStatus.ACTIVE.value
    try:
        status = PolicyStatus(status_raw)
    except ValueError as exc:
        raise NotionMappingError(f"Policy invalid Estado {status_raw!r}.") from exc
    patient_rel = read_relation(p.get("Paciente"))
    insurer_rel = read_relation(p.get("Aseguradora"))
    return Policy(
        number=read_title(p.get("NumeroPoliza")),
        patient_id=patient_rel[0] if patient_rel else "",
        plan=read_rich_text(p.get("Plan")),
        insurer_id=insurer_rel[0] if insurer_rel else "",
        start_date=start,
        end_date=end,
        status=status,
    )


def policy_to_notion_props(policy: Policy) -> dict[str, Any]:
    """Construye properties para crear/actualizar una Policy.

    Las relations esperan **page_ids reales de Notion**. Si los `patient_id` /
    `insurer_id` del Policy son ids del catálogo (ej: 'PAC-00481'), el caller
    debe resolverlos a page_ids antes de pasar el Policy. Pasamos los strings
    tal cual — Notion va a 400 si no son page_ids válidos. Decisión consciente:
    no hacemos lookups ocultos en el mapper.
    """
    return {
        "NumeroPoliza": make_title(policy.number),
        "Paciente": make_relation([policy.patient_id]) if policy.patient_id else make_relation([]),
        "Aseguradora": (
            make_relation([policy.insurer_id]) if policy.insurer_id else make_relation([])
        ),
        "Plan": make_rich_text(policy.plan),
        "FechaInicio": make_date(policy.start_date),
        "FechaFin": make_date(policy.end_date),
        "Estado": make_select(policy.status.value),
    }


# ─── Coverage (DB Notion 5: Coberturas) ────────────────────────────────────
# Properties: Poliza (relation), Procedimiento (relation), Cubierto (checkbox),
# DiasCarencia (number), Copago (number), DocsRequeridos (multi_select),
# (title obligatoria) Identificador (title) = "<policyNumber>×<procedureCode>"


def notion_to_coverage(page: dict[str, Any]) -> Coverage:
    p = _props(page)
    waiting_n = read_number(p.get("DiasCarencia"))
    copay_n = read_number(p.get("Copago"))
    # `policy_number` y `procedure_code` se almacenan también como rich_text
    # planos para soportar lookups que no requieran join. Si están, los usamos;
    # si no, dejamos vacío (el caller debe resolver desde la relation).
    policy_number_plain = read_rich_text(p.get("PolizaNumero"))
    procedure_code_plain = read_rich_text(p.get("ProcedimientoCodigo"))
    return Coverage(
        policy_number=policy_number_plain,
        procedure_code=procedure_code_plain,
        covered=read_checkbox(p.get("Cubierto")),
        waiting_days=int(waiting_n) if waiting_n is not None else 0,
        copay=Decimal(str(copay_n)) if copay_n is not None else Decimal("0"),
        required_docs=read_multi_select(p.get("DocsRequeridos")),
    )


def coverage_to_notion_props(
    coverage: Coverage,
    *,
    policy_page_id: str | None = None,
    procedure_page_id: str | None = None,
) -> dict[str, Any]:
    """Construye properties para crear/actualizar una Coverage.

    `policy_page_id` y `procedure_page_id` son los page_ids reales en Notion
    (resueltos por el caller). Si no se pasan, las relations quedan vacías.
    `Identificador` (title) se sintetiza para que Notion tenga algo legible.
    """
    return {
        "Identificador": make_title(f"{coverage.policy_number}×{coverage.procedure_code}"),
        "PolizaNumero": make_rich_text(coverage.policy_number),
        "ProcedimientoCodigo": make_rich_text(coverage.procedure_code),
        "Poliza": make_relation([policy_page_id] if policy_page_id else []),
        "Procedimiento": make_relation([procedure_page_id] if procedure_page_id else []),
        "Cubierto": make_checkbox(coverage.covered),
        "DiasCarencia": make_number(coverage.waiting_days),
        "Copago": make_number(float(coverage.copay)),
        "DocsRequeridos": make_multi_select(coverage.required_docs),
    }


# ─── MedicalReport (DB Notion 6: InformesMédicos) ──────────────────────────
# Properties: Identificador (title), Paciente (relation), Formato (select),
# Contenido (rich_text), ProcedimientoSolicitado (relation),
# Diagnostico (rich_text), FechaInforme (date), ArchivoPath (rich_text),
# DoctorTratante (rich_text)


def notion_to_medical_report(page: dict[str, Any]) -> MedicalReport:
    p = _props(page)
    patient_rel = read_relation(p.get("Paciente"))
    fmt_raw = (read_select(p.get("Formato")) or ReportFormat.TEXT.value).lower()
    try:
        fmt = ReportFormat(fmt_raw)
    except ValueError as exc:
        raise NotionMappingError(f"MedicalReport invalid Formato {fmt_raw!r}.") from exc
    submitted = read_datetime(p.get("FechaInforme"))
    if submitted is None:
        raise NotionMappingError(f"MedicalReport {page.get('id')!r} missing FechaInforme.")
    diagnosis = read_rich_text(p.get("Diagnostico")) or None
    hint_rel = read_relation(p.get("ProcedimientoSolicitado"))
    doctor = read_rich_text(p.get("DoctorTratante")) or None
    return MedicalReport(
        id=str(page.get("id", "")),
        patient_id=patient_rel[0] if patient_rel else "",
        format=fmt,
        content=read_rich_text(p.get("Contenido")),
        submitted_at=submitted,
        procedure_solicited_hint=hint_rel[0] if hint_rel else None,
        diagnosis=diagnosis,
        attending_doctor=doctor,
    )


def medical_report_to_notion_props(
    report: MedicalReport,
    *,
    patient_page_id: str | None = None,
    procedure_page_id: str | None = None,
) -> dict[str, Any]:
    return {
        "Identificador": make_title(report.id),
        "Paciente": make_relation([patient_page_id] if patient_page_id else []),
        "Formato": make_select(report.format.value),
        "Contenido": make_rich_text(report.content),
        "ProcedimientoSolicitado": make_relation(
            [procedure_page_id] if procedure_page_id else []
        ),
        "Diagnostico": make_rich_text(report.diagnosis or ""),
        "FechaInforme": make_datetime(report.submitted_at),
        "DoctorTratante": make_rich_text(report.attending_doctor or ""),
    }


# ─── AuthorizationCase (DB Notion 7: CasosAutorización) ────────────────────
# Properties: Identificador (title), Informe (relation), Poliza (relation),
# Estado (select), Outcome (select), Rationale (rich_text),
# Confidence (number), Evidence (rich_text JSON), MissingDocs (multi_select),
# MotivoEscalamiento (select), DecidedBy (select), ModelUsed (rich_text),
# Auditor (people), TrazaAgente (rich_text JSON), CreatedAt (date),
# DecidedAt (date), ReportId (rich_text), PolicyNumber (rich_text)


def serialize_evidence(evidence: tuple[Evidence, ...]) -> str:
    """Serializa una tupla de `Evidence` como JSON string para guardar en rich_text."""
    return json.dumps(
        [
            {"source": e.source.value, "field": e.field, "quote": e.quote}
            for e in evidence
        ],
        ensure_ascii=False,
    )


def deserialize_evidence(raw: str) -> tuple[Evidence, ...]:
    if not raw:
        return ()
    try:
        items = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise NotionMappingError(f"Evidence JSON invalid: {exc}") from exc
    if not isinstance(items, list):
        return ()
    out: list[Evidence] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            out.append(
                Evidence(
                    source=EvidenceSource(item["source"]),
                    field=str(item.get("field", "")),
                    quote=str(item.get("quote", "")),
                )
            )
        except (KeyError, ValueError) as exc:
            raise NotionMappingError(f"Evidence entry invalid: {exc}") from exc
    return tuple(out)


def serialize_trace(trace: tuple[TraceStep, ...]) -> str:
    """Serializa una tupla de `TraceStep` como JSON string para guardar en rich_text."""
    return json.dumps(
        [
            {
                "node": s.node,
                "timestamp": s.timestamp.isoformat(),
                "state": s.state.value,
                "duration_ms": s.duration_ms,
                "model_used": s.model_used,
                "tokens_in": s.tokens_in,
                "tokens_out": s.tokens_out,
                "detail": s.detail,
                "error": s.error,
            }
            for s in trace
        ],
        ensure_ascii=False,
    )


def deserialize_trace(raw: str) -> tuple[TraceStep, ...]:
    if not raw:
        return ()
    try:
        items = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise NotionMappingError(f"Trace JSON invalid: {exc}") from exc
    if not isinstance(items, list):
        return ()
    out: list[TraceStep] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            ts_raw = str(item["timestamp"])
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            out.append(
                TraceStep(
                    node=str(item["node"]),
                    timestamp=ts,
                    state=TraceStepState(item["state"]),
                    duration_ms=item.get("duration_ms"),
                    model_used=item.get("model_used"),
                    tokens_in=item.get("tokens_in"),
                    tokens_out=item.get("tokens_out"),
                    detail=item.get("detail"),
                    error=item.get("error"),
                )
            )
        except (KeyError, ValueError) as exc:
            raise NotionMappingError(f"TraceStep entry invalid: {exc}") from exc
    return tuple(out)


def _decision_from_props(p: dict[str, Any]) -> AgentDecision | None:
    """Reconstruye `AgentDecision` desde las propiedades de la page CASE.

    Devuelve `None` si el caso aún no tiene decisión (Outcome vacío).
    """
    outcome_raw = read_select(p.get("Outcome"))
    if outcome_raw is None:
        return None
    try:
        outcome = Outcome(outcome_raw)
    except ValueError as exc:
        raise NotionMappingError(f"Case invalid Outcome {outcome_raw!r}.") from exc
    decided_by_raw = read_select(p.get("DecidedBy")) or DecidedBy.AGENT.value
    try:
        decided_by = DecidedBy(decided_by_raw)
    except ValueError as exc:
        raise NotionMappingError(f"Case invalid DecidedBy {decided_by_raw!r}.") from exc
    escalation: EscalationReason | None = None
    escalation_raw = read_select(p.get("MotivoEscalamiento"))
    if escalation_raw:
        try:
            escalation = EscalationReason(escalation_raw)
        except ValueError as exc:
            raise NotionMappingError(
                f"Case invalid MotivoEscalamiento {escalation_raw!r}.",
            ) from exc
    confidence = read_number(p.get("Confidence")) or 0.0
    return AgentDecision(
        outcome=outcome,
        rationale=read_rich_text(p.get("Rationale")),
        confidence=float(confidence),
        decided_by=decided_by,
        evidence=deserialize_evidence(read_rich_text(p.get("Evidence"))),
        missing_docs=read_multi_select(p.get("MissingDocs")),
        escalation_reason=escalation,
        model_used=read_rich_text(p.get("ModelUsed")) or None,
    )


def notion_to_authorization_case(page: dict[str, Any]) -> AuthorizationCase:
    p = _props(page)
    status_raw = read_select(p.get("Estado")) or CaseStatus.PENDIENTE.value
    try:
        status = CaseStatus(status_raw)
    except ValueError as exc:
        raise NotionMappingError(f"Case invalid Estado {status_raw!r}.") from exc
    created_at = read_datetime(p.get("CreatedAt"))
    if created_at is None:
        raise NotionMappingError(f"Case {page.get('id')!r} missing CreatedAt.")
    return AuthorizationCase(
        id=read_rich_text(p.get("CaseId")) or read_title(p.get("Identificador")),
        report_id=read_rich_text(p.get("ReportId")),
        policy_number=read_rich_text(p.get("PolicyNumber")),
        status=status,
        created_at=created_at,
        decision=_decision_from_props(p),
        agent_trace=deserialize_trace(read_rich_text(p.get("TrazaAgente"))),
        decided_at=read_datetime(p.get("DecidedAt")),
    )


def authorization_case_to_notion_props(
    case: AuthorizationCase,
    *,
    report_page_id: str | None = None,
    policy_page_id: str | None = None,
    auditor_user_ids: tuple[str, ...] = (),
) -> dict[str, Any]:
    """Construye properties para crear/actualizar un AuthorizationCase.

    `report_page_id` y `policy_page_id` son los page_ids reales en Notion
    para las relations. Si no se pasan, las relations quedan vacías y el
    caso queda "huérfano" en términos de UI Notion (los rich_text con los
    ids siguen siendo la fuente de verdad para el back).
    """
    decision = case.decision
    props: dict[str, Any] = {
        "Identificador": make_title(case.id),
        "CaseId": make_rich_text(case.id),
        "ReportId": make_rich_text(case.report_id),
        "PolicyNumber": make_rich_text(case.policy_number),
        "Informe": make_relation([report_page_id] if report_page_id else []),
        "Poliza": make_relation([policy_page_id] if policy_page_id else []),
        "Estado": make_select(case.status.value),
        "TrazaAgente": make_rich_text(serialize_trace(case.agent_trace)),
        "CreatedAt": make_datetime(case.created_at),
        "DecidedAt": make_datetime(case.decided_at),
    }
    if decision is not None:
        props["Outcome"] = make_select(decision.outcome.value)
        props["Rationale"] = make_rich_text(decision.rationale)
        props["Confidence"] = make_number(decision.confidence)
        props["Evidence"] = make_rich_text(serialize_evidence(decision.evidence))
        props["MissingDocs"] = make_multi_select(decision.missing_docs)
        props["MotivoEscalamiento"] = make_select(
            decision.escalation_reason.value if decision.escalation_reason else None,
        )
        props["DecidedBy"] = make_select(decision.decided_by.value)
        props["ModelUsed"] = make_rich_text(decision.model_used or "")
    else:
        # Limpieza explícita por si actualizamos un caso que perdió la decisión.
        props["Outcome"] = make_select(None)
        props["Rationale"] = make_rich_text("")
        props["Confidence"] = make_number(None)
        props["Evidence"] = make_rich_text("")
        props["MissingDocs"] = make_multi_select(())
        props["MotivoEscalamiento"] = make_select(None)
        props["DecidedBy"] = make_select(None)
        props["ModelUsed"] = make_rich_text("")
    if auditor_user_ids:
        props["Auditor"] = {"people": [{"id": uid} for uid in auditor_user_ids]}
    return props


__all__ = [
    "authorization_case_to_notion_props",
    "coverage_to_notion_props",
    "deserialize_evidence",
    "deserialize_trace",
    "insurer_to_notion_props",
    "medical_report_to_notion_props",
    "notion_to_authorization_case",
    "notion_to_coverage",
    "notion_to_insurer",
    "notion_to_medical_report",
    "notion_to_patient",
    "notion_to_policy",
    "notion_to_procedure",
    "patient_to_notion_props",
    "policy_to_notion_props",
    "procedure_to_notion_props",
    "serialize_evidence",
    "serialize_trace",
]
