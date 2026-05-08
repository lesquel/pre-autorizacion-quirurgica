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

from typing import TYPE_CHECKING, Final, Self, final

import structlog
from langchain_core.exceptions import OutputParserException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

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
from pre_autorizacion.shared.logging import hash_pii

if TYPE_CHECKING:
    from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider


_logger = structlog.get_logger("decision.llm")


# Heurísticas de confidence coherentes con los extractores.
_MIN_CONFIDENCE_DEFAULT: Final[float] = 0.50
_DEFAULT_CONFIDENCE_WHEN_DECIDED: Final[float] = 0.65
_SUSPICIOUS_CONFIDENCE_THRESHOLD: Final[float] = 0.50


SYSTEM_PROMPT: Final[str] = (
    "Sos un agente de pre-autorización médica del sistema de salud. Reglas DURAS:\n"
    "1. NUNCA auto-rechazás un caso. Si dudás, devolvé outcome=ESCALATED.\n"
    "2. Si la cobertura NO incluye el procedimiento → ESCALATED (NO REJECTED).\n"
    "3. Si la carencia no se cumplió → ESCALATED con WAITING_PERIOD_NOT_MET.\n"
    "4. Si faltan documentos requeridos → DOCS_REQUESTED + lista en missing_docs.\n"
    "5. Tu rationale es para un auditor humano: técnico, conciso, en español.\n"
    "6. Cada ítem en evidence debe tener source \"report\" o \"policy\" (minúsculas), "
    "field (campo del dato, ej. procedure, coverage), quote (texto literal citado).\n"
    "7. `confidence` (0.0–1.0) es OBLIGATORIO en CADA respuesta. Es tu confianza "
    "GLOBAL en la decisión. Reglas de asignación:\n"
    "   • 0.90–1.00 → caso textbook: cobertura clara, datos completos, sin ambigüedad.\n"
    "   • 0.75–0.89 → decisión sólida con mínima inferencia (default razonable).\n"
    "   • 0.60–0.74 → decisión defendible pero con algún punto a revisar.\n"
    "   • 0.50–0.59 → ambigüedad real: típicamente acompañado de outcome=ESCALATED.\n"
    "   • <0.50 → SOLO si la información es contradictoria o casi inutilizable.\n"
    "   REGLA DURA: NUNCA devuelvas confidence=0 si emitiste un outcome y un "
    "rationale coherentes. Mínimo 0.50. Si dudás, usá 0.70.\n"
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


class _UnknownEvidenceSourceError(ValueError):
    """Marker para evidence items que no resuelven a 'report' o 'policy' exactos.

    Lo levantamos desde el `model_validator(mode='before')` para que el caller
    pueda filtrarlos antes del list-validation y evitar fabricar evidencia con
    un source inventado. Mantener un error específico (en vez de `ValueError`
    genérico) facilita el filtrado preciso en `_DecisionSchema`.
    """


class _EvidenceItemSchema(BaseModel):
    """Item de evidencia que el LLM emite (acepta alias sueltos del modelo).

    `source` se exige EXACTO (case-insensitive) — `report` o `policy`. Antes
    cualquier string desconocido caía silenciosamente a `REPORT`, lo que
    fabricaba evidencia falsa (un policy quote etiquetado como report).
    """

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
            if low == "report":
                out["source"] = EvidenceSource.REPORT.value
            elif low == "policy":
                out["source"] = EvidenceSource.POLICY.value
            else:
                # Source desconocido — NO fabricamos un valor por defecto
                # para evitar mentir al auditor sobre el origen de la cita.
                _logger.warning(
                    "evidence.source.unknown",
                    raw_source=raw_src,
                    field=out.get("field"),
                    # `quote` puede contener texto literal del informe médico (PHI).
                    # Hasheamos para defense-in-depth + longitud como señal numérica.
                    quote_hash=hash_pii(q),
                    quote_len=len(q),
                )
                raise _UnknownEvidenceSourceError(
                    f"unknown evidence source: {raw_src!r}"
                )
        else:
            _logger.warning(
                "evidence.source.unknown",
                raw_source=repr(raw_src),
                field=out.get("field"),
                quote_hash=hash_pii(q),
                quote_len=len(q),
            )
            raise _UnknownEvidenceSourceError(
                f"non-string evidence source: {raw_src!r}"
            )
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
    """Schema interno con el shape de `AgentDecision` (sin decided_by/model_used).

    `confidence` es **required** (sin default) para forzar al LLM a emitirlo
    explícitamente. Un default silencioso (0.82) era PEOR que 0.0: pasaba el
    `confidence_gate` del rule engine sin que el modelo hubiera realmente
    evaluado el caso. Si DeepSeek lo omite ahora, Pydantic falla el parseo y
    el use case escala con `escalation_reason='UNEXPECTED_ERROR'` o similar.
    Un `model_validator` adicional sigue blindando el caso patológico de
    confidence muy baja con rationale coherente.
    """

    model_config = ConfigDict(extra="ignore")

    outcome: Outcome = Field(description="Resultado: APPROVED_AUTO, DOCS_REQUESTED o ESCALATED.")
    rationale: str = Field(description="Razonamiento técnico-clínico para auditor.")
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Confianza global de la decisión [0.0, 1.0]. OBLIGATORIO. "
            "NUNCA 0 si emitiste outcome y rationale coherentes. Mínimo 0.50."
        ),
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
        # Filtramos evidence items con `source` desconocido ANTES de la list-validation:
        # `_EvidenceItemSchema` levanta `_UnknownEvidenceSourceError` para sources que
        # no son exactamente 'report' / 'policy', y queremos descartarlos en vez de
        # hacer fallar el parseo entero (la decisión sigue siendo válida sin esa cita).
        raw_evidence = out.get("evidence")
        if isinstance(raw_evidence, list):
            kept: list[object] = []
            for item in raw_evidence:
                try:
                    kept.append(_EvidenceItemSchema.model_validate(item))
                except _UnknownEvidenceSourceError:
                    # Ya quedó logueado dentro del validator del item; sólo descartamos.
                    continue
                except Exception:  # noqa: BLE001 — otros errores reales suben en el segundo pase.
                    # Dejamos el ítem crudo para que la list-validation principal lo
                    # reporte si es realmente inválido por otra razón.
                    kept.append(item)
            out["evidence"] = kept
        return out

    @model_validator(mode="after")
    def _enforce_min_confidence_when_decided(self) -> Self:
        """Blinda contra LLMs que devuelven confidence muy baja con decisión coherente.

        El campo `confidence` es **required** en el schema (sin default): si
        DeepSeek lo omite, Pydantic levanta `ValidationError` que
        `LlmAuthorizationDecisionMaker.decide()` atrapa y traduce a un
        `AgentDecision` ESCALATED sintético. Este validator NO ataca la omisión
        — ataca el caso patológico distinto en que el LLM **sí emite** confidence
        pero con valor demasiado bajo (típicamente 0.0–0.30) pese a un rationale
        coherente. En ese caso elevamos a `_DEFAULT_CONFIDENCE_WHEN_DECIDED` y
        logueamos para diagnóstico.
        """
        rationale_substantial = len((self.rationale or "").strip()) >= 8
        if rationale_substantial and self.confidence < _MIN_CONFIDENCE_DEFAULT:
            _logger.warning(
                "llm.confidence_suspicious",
                source="llm_decision_maker",
                original_confidence=self.confidence,
                clamped_to=_DEFAULT_CONFIDENCE_WHEN_DECIDED,
                outcome=self.outcome.value,
                escalation_reason=(
                    self.escalation_reason.value if self.escalation_reason else None
                ),
                # `rationale` clínico → hasheado, evitamos PHI en plano.
                rationale_hash=hash_pii(self.rationale),
                reason="LLM devolvió confidence muy baja pese a rationale coherente",
            )
            # Usamos `object.__setattr__` deliberadamente (NO `self.confidence = X`):
            # ambos evaden la re-validación cuando `validate_assignment=False`
            # (default, nuestro caso), pero si en el futuro alguien activa
            # `validate_assignment=True` para hardening, `self.x =` causa
            # recursión infinita (el setter re-dispara el validator). El
            # __setattr__ directo es robusto a ese cambio. Ver R3-5 del judgment day.
            object.__setattr__(self, "confidence", _DEFAULT_CONFIDENCE_WHEN_DECIDED)
        return self


@final
class LlmAuthorizationDecisionMaker(AuthorizationDecisionMaker):
    """Decisión final del agente vía `LLMProvider.complete_structured`."""

    def __init__(self, llm: LLMProvider, *, model_name: str) -> None:
        self._llm = llm
        self._model_name = model_name

    async def decide(self, context: DecisionContext) -> AgentDecision:
        prompt = self._build_prompt(context)
        try:
            result = await self._llm.complete_structured(
                prompt,
                schema=_DecisionSchema,
                system=SYSTEM_PROMPT,
                temperature=0.0,
            )
        except (ValidationError, OutputParserException) as exc:
            # Dos modos de fallo del LLM provider que tenemos que atrapar
            # acá para no romper el flow:
            # - ValidationError: DeepSeek omitió `confidence` (campo required) o
            #   devolvió un payload que no cumple el schema (causa raíz original
            #   del bug del 0.00 que arreglamos en R1).
            # - OutputParserException: el LLM devolvió texto no-JSON ("I cannot
            #   help with that"), típico cuando refusa o cuando json_mode falla.
            # Política PRD §3.1.3: NUNCA auto-rechazar; ante duda, ESCALAR.
            #
            # NO logueamos `str(exc)` porque pydantic incluye los input values
            # en el mensaje, y un payload malformado del LLM puede contener PHI
            # textual del informe (ver R3-3 del judgment day).
            error_types: list[str] = (
                [e.get("type", "unknown") for e in exc.errors()]
                if isinstance(exc, ValidationError)
                else ["output_parser"]
            )
            _logger.error(
                "llm.structured_output_failed",
                error_class=type(exc).__name__,
                error_count=(
                    exc.error_count() if isinstance(exc, ValidationError) else 1
                ),
                error_types=error_types,
                model=self._model_name,
            )
            return AgentDecision(
                outcome=Outcome.ESCALATED,
                rationale=(
                    "El LLM no devolvió un structured output válido. Escalado "
                    "por seguridad. (Posible mal-comportamiento del LLM provider.)"
                ),
                confidence=0.0,
                decided_by=DecidedBy.AGENT,
                evidence=(),
                missing_docs=(),
                escalation_reason=EscalationReason.UNEXPECTED_ERROR,
                model_used=self._model_name,
            )

        evidence = tuple(
            Evidence(source=item.source, field=item.field, quote=item.quote)
            for item in result.evidence
        )

        # Logueo defensivo: confidence sospechosa post-validator.
        if (
            result.confidence < _SUSPICIOUS_CONFIDENCE_THRESHOLD
            and (result.rationale or "").strip()
        ):
            _logger.info(
                "llm.confidence_suspicious",
                source="llm_decision_maker.post_validate",
                confidence=result.confidence,
                outcome=result.outcome.value,
                # `rationale` clínico hasheado para no filtrar PHI a logs.
                rationale_hash=hash_pii(result.rationale),
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
            "── ANÁLISIS DETERMINÍSTICO PREVIO (rule engine, NO clínico) ──\n"
            "Esto es UNA señal de los chequeos formales (carencia, cobertura,\n"
            "docs presentes). NO incluye juicio sobre la calidad del informe\n"
            "ni razonamiento clínico — eso es TU trabajo.\n"
            f"señal preliminar: {context.preliminary_outcome.value}\n"
            f"docs faltantes detectadas: {missing}\n\n"
            "── INSTRUCCIONES ──\n"
            "Tu trabajo NO es confirmar la señal preliminar mecánicamente.\n"
            "Evaluá INDEPENDIENTEMENTE la calidad del informe contra la cobertura.\n"
            "Reglas duras (aplican antes de mirar la señal preliminar):\n"
            "  · extraction.confidence < 0.50 → ESCALATED (no podés decidir sin entender el informe).\n"
            "  · informe ambiguo, contradictorio, genérico o de baja calidad → ESCALATED.\n"
            "  · informe NO menciona el procedimiento o diagnóstico de forma sustancial → ESCALATED.\n"
            "Reglas blandas (después de pasar las anteriores):\n"
            "  · señal=APPROVED_AUTO + informe coherente y completo → podés confirmar APPROVED_AUTO.\n"
            "    Tu confidence debe reflejar la calidad del INFORME (no la del rule engine).\n"
            "  · señal=DOCS_REQUESTED / ESCALATED → normalmente confirmá (rule engine ya detectó problema duro).\n"
            "Política PRD §3.1.3: NUNCA auto-rechaces. En la duda → ESCALATED.\n"
            "Justificá con citas literales del informe. Devolvé sólo JSON."
        )


__all__ = ["LlmAuthorizationDecisionMaker"]
