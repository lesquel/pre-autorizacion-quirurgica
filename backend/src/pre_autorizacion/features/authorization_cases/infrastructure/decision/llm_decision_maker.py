"""LlmAuthorizationDecisionMaker — produce `AgentDecision` con un LLM.

Adapter high-level de `AuthorizationDecisionMaker`. Compone un `LLMProvider`
y le pasa todo el contexto (informe + póliza + cobertura + extracción + outcome
preliminar del rule engine + missing docs) para que devuelva un JSON validado
con outcome, rationale, confidence y evidence.

Política PRD §3.1.3:
- El agente NUNCA auto-rechaza. Si duda → `ESCALATED`.
- El gate determinístico `confidence < 0.80` → ESCALATED **NO** vive acá:
  vive en el rule engine, que envuelve esta llamada y puede sobreescribir
  el outcome del LLM. Este adapter sólo asegura un schema válido.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, final

from pydantic import BaseModel, ConfigDict, Field, model_validator

from pre_autorizacion.features.authorization_cases.domain.ports.authorization_decision_maker import (
    AuthorizationDecisionMaker,
    DecisionContext,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.agent_decision import (
    AgentDecision,
    DecidedBy,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.escalation_reason import (
    EscalationReason,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.evidence import (
    Evidence,
    EvidenceSource,
)
from pre_autorizacion.features.authorization_cases.domain.value_objects.outcome import Outcome

if TYPE_CHECKING:
    from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider


SYSTEM_PROMPT: Final[str] = (
    "Sos un agente de pre-autorización médica del sistema de salud. Reglas DURAS:\n"
    "1. NUNCA auto-rechazás un caso. Si dudás, devolvé outcome=ESCALATED.\n"
    "2. Si la cobertura NO incluye el procedimiento → ESCALATED (NO REJECTED).\n"
    "3. Si la carencia no se cumplió → ESCALATED con WAITING_PERIOD_NOT_MET.\n"
    "4. Si faltan documentos requeridos → DOCS_REQUESTED + lista en missing_docs.\n"
    "5. Tu rationale es para un auditor humano: técnico, conciso, en español.\n"
    "6. Cada ítem en evidence debe tener source \"report\" o \"policy\" (minúsculas), "
    "field (campo del dato, ej. procedure, coverage), quote (texto literal citado).\n"
    "7. Incluí confidence entre 0 y 1 (ej. coherente con la extracción previa).\n"
    "8. Si outcome=ESCALATED, escalation_reason DEBE ser exactamente uno de estos "
    "strings en inglés (sin texto libre): WAITING_PERIOD_NOT_MET, "
    "LOW_CONFIDENCE_PROCEDURE_MATCH, PDF_EXTRACTION_FAILURE, PROCEDURE_NOT_COVERED, "
    "POLICY_INACTIVE, PROCEDURE_NOT_MATCHED, EXTRACTION_FAILED, LOW_CONFIDENCE, "
    "UNEXPECTED_ERROR. Si no escalás, escalation_reason=null.\n"
    "9. Devolvé ÚNICAMENTE JSON válido con esta forma exacta:\n"
    '{"outcome":"APPROVED_AUTO|DOCS_REQUESTED|ESCALATED","rationale":"...",'
    '"confidence":0.88,"evidence":[{"source":"policy","field":"coverage","quote":"..."}],'
    '"missing_docs":[],"escalation_reason":null}'
)


class _EvidenceItemSchema(BaseModel):
    """Item de evidencia que el LLM emite (acepta alias sueltos del modelo)."""

    model_config = ConfigDict(extra="ignore")

    source: EvidenceSource = Field(
        description="'report' si la cita viene del informe; 'policy' si viene de póliza/cobertura."
    )
    field: str = Field(
        default="summary",
        description="Campo al que aplica la cita (ej: 'procedure', 'waiting_period', 'docs').",
    )
    quote: str = Field(default="", description="Cita textual literal.")

    @model_validator(mode="before")
    @classmethod
    def _coerce_evidence_shape(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        quote = out.get("quote") or out.get("text") or ""
        q = str(quote).strip()
        if q.lower() in ("none", "null", "n/a", "-"):
            q = ""
        out["quote"] = q or "(sin cita literal)"
        raw_src = out.get("source", "")
        if isinstance(raw_src, EvidenceSource):
            out["source"] = raw_src.value
            if not str(out.get("field") or "").strip():
                out["field"] = "summary"
            return out
        if isinstance(raw_src, str):
            low = raw_src.strip().lower()
            if low in ("report", "policy"):
                out["source"] = low
            elif any(
                tok in low
                for tok in (
                    "cobertura",
                    "póliza",
                    "poliza",
                    "coverage",
                    "plan",
                    "carencia",
                    "copago",
                )
            ):
                out["source"] = EvidenceSource.POLICY.value
            else:
                out["source"] = EvidenceSource.REPORT.value
        else:
            out["source"] = EvidenceSource.REPORT.value
        if not str(out.get("field") or "").strip():
            out["field"] = "summary"
        return out


def _coerce_escalation_reason_value(raw: object, *, outcome_is_escalated: bool) -> str | None:
    """Mapea texto libre del LLM (o null) al enum wire `EscalationReason`."""
    if not outcome_is_escalated:
        return None
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return EscalationReason.EXTRACTION_FAILED.value
    if isinstance(raw, EscalationReason):
        return raw.value
    if not isinstance(raw, str):
        return EscalationReason.UNEXPECTED_ERROR.value
    s = raw.strip()
    upper = s.upper().replace(" ", "_")
    for m in EscalationReason:
        if s == m.value or upper == m.value:
            return m.value
    low = s.lower()
    if "carencia" in low or "waiting" in low or "espera" in low:
        return EscalationReason.WAITING_PERIOD_NOT_MET.value
    if "extracc" in low or "identificar" in low or "revisión manual" in low or "revision manual" in low:
        return EscalationReason.EXTRACTION_FAILED.value
    if "pdf" in low and ("ilegib" in low or "corrupt" in low or "no legible" in low):
        return EscalationReason.PDF_EXTRACTION_FAILURE.value
    if "confianza" in low or "low confidence" in low or "procedure match" in low:
        return EscalationReason.LOW_CONFIDENCE_PROCEDURE_MATCH.value
    if "cubierto" in low or "not covered" in low or "sin cobertura" in low:
        return EscalationReason.PROCEDURE_NOT_COVERED.value
    if "inactiv" in low or "venc" in low or "poliza" in low or "póliza" in low:
        return EscalationReason.POLICY_INACTIVE.value
    if "match" in low or "coincid" in low or "matche" in low:
        return EscalationReason.PROCEDURE_NOT_MATCHED.value
    if "confianza global" in low or "baja confianza" in low:
        return EscalationReason.LOW_CONFIDENCE.value
    return EscalationReason.UNEXPECTED_ERROR.value


class _DecisionSchema(BaseModel):
    """Schema interno con el shape de `AgentDecision` (sin decided_by/model_used)."""

    model_config = ConfigDict(extra="ignore")

    outcome: Outcome = Field(description="Resultado: APPROVED_AUTO, DOCS_REQUESTED o ESCALATED.")
    rationale: str = Field(description="Razonamiento técnico-clínico para auditor.")
    confidence: float = Field(
        default=0.82,
        ge=0.0,
        le=1.0,
        description="Confianza global de la decisión [0.0, 1.0].",
    )
    evidence: list[_EvidenceItemSchema] = Field(
        default_factory=list,
        description="Citas literales que respaldan la decisión.",
    )
    missing_docs: list[str] = Field(
        default_factory=list,
        description="Lista de documentos faltantes (sólo cuando outcome=DOCS_REQUESTED).",
    )
    escalation_reason: EscalationReason | None = Field(
        default=None,
        description="Razón del escalamiento; obligatoria cuando outcome=ESCALATED.",
    )

    @model_validator(mode="before")
    @classmethod
    def _coerce_escalation_reason(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        raw_outcome = out.get("outcome", "")
        if isinstance(raw_outcome, Outcome):
            escalated = raw_outcome is Outcome.ESCALATED
        else:
            escalated = str(raw_outcome).strip().upper() in ("ESCALATED", Outcome.ESCALATED.value)
        out["escalation_reason"] = _coerce_escalation_reason_value(
            out.get("escalation_reason"),
            outcome_is_escalated=escalated,
        )
        return out


@final
class LlmAuthorizationDecisionMaker(AuthorizationDecisionMaker):
    """Decisión final del agente vía `LLMProvider.complete_structured`."""

    def __init__(self, llm: LLMProvider, *, model_name: str) -> None:
        self._llm = llm
        self._model_name = model_name

    async def decide(self, context: DecisionContext) -> AgentDecision:
        prompt = self._build_prompt(context)
        result = await self._llm.complete_structured(
            prompt,
            schema=_DecisionSchema,
            system=SYSTEM_PROMPT,
            temperature=0.0,
        )

        evidence = tuple(
            Evidence(source=item.source, field=item.field, quote=item.quote)
            for item in result.evidence
        )

        return AgentDecision(
            outcome=result.outcome,
            rationale=result.rationale,
            confidence=result.confidence,
            decided_by=DecidedBy.AGENT,
            evidence=evidence,
            missing_docs=tuple(result.missing_docs),
            escalation_reason=result.escalation_reason,
            model_used=self._model_name,
        )

    @staticmethod
    def _build_prompt(context: DecisionContext) -> str:
        report = context.report
        policy = context.policy
        coverage = context.coverage
        extraction = context.extraction
        missing = ", ".join(context.missing_docs) if context.missing_docs else "(ninguno)"

        # Evitamos volcar el PDF crudo si fuera enorme; texto va completo.
        report_blob = (
            report.content
            if len(report.content) <= 4000
            else f"{report.content[:4000]}... [truncado a 4000 chars]"
        )

        return (
            "Tomá una decisión sobre el siguiente caso de pre-autorización quirúrgica. "
            "Devolvé JSON válido cumpliendo el schema.\n\n"
            "── INFORME MÉDICO ──\n"
            f"id: {report.id}\n"
            f"format: {report.format.value}\n"
            f"hint procedimiento: {report.procedure_solicited_hint or '(no informado)'}\n"
            f"hint diagnóstico: {report.diagnosis or '(no informado)'}\n"
            f"contenido:\n{report_blob}\n\n"
            "── EXTRACCIÓN PREVIA (LLM/Vision) ──\n"
            f"procedimiento: {extraction.extracted_procedure_name} "
            f"({extraction.extracted_procedure_code})\n"
            f"diagnóstico: {extraction.extracted_diagnosis_description} "
            f"({extraction.extracted_diagnosis_code})\n"
            f"confidence extracción: {extraction.confidence:.2f}\n"
            f"citas: {list(extraction.evidence_quotes)}\n\n"
            "── PÓLIZA ──\n"
            f"number: {policy.number}\n"
            f"plan: {policy.plan}\n"
            f"status: {policy.status.value}\n"
            f"start_date: {policy.start_date}\n"
            f"end_date: {policy.end_date}\n\n"
            "── COBERTURA APLICABLE ──\n"
            f"id: {getattr(coverage, 'id', None)}\n"
            f"cubierto: {getattr(coverage, 'covered', None)}\n"
            f"carencia (días): {getattr(coverage, 'waiting_days', None)}\n"
            f"copago: {getattr(coverage, 'copay', None)}\n"
            f"docs requeridos: {list(getattr(coverage, 'required_docs', ()))}\n\n"
            "── ANÁLISIS DETERMINÍSTICO PREVIO (rule engine) ──\n"
            f"outcome preliminar: {context.preliminary_outcome.value}\n"
            f"docs faltantes detectadas: {missing}\n\n"
            "── INSTRUCCIONES ──\n"
            "Confirmá o ajustá el outcome preliminar. Si encontrás ambigüedad, "
            "escalá. Justificá con citas literales. Devolvé sólo JSON."
        )


__all__ = ["LlmAuthorizationDecisionMaker"]
