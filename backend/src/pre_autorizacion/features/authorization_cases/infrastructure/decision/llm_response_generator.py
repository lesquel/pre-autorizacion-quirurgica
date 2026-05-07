"""LlmResponseGenerator — re-redacta la decisión como mensaje user-facing.

Adapter de `ResponseGenerator`. Toma un `AgentDecision` (rationale técnico
orientado a auditor) y le pide al LLM una versión natural, corta y accionable
para mostrar al hospital en la UI.

Por qué separado del `AuthorizationDecisionMaker` (PRD, doc del port):
- El rationale es técnico-clínico para auditor; el hospital necesita algo
  natural, en español neutro, sin jerga.
- Cachear y traducir el mensaje sin reabrir la decisión.
- Testeo independiente de los dos paths.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, final

from pre_autorizacion.features.authorization_cases.domain.ports.response_generator import (
    ResponseGenerator,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.domain.value_objects import AgentDecision
    from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider


SYSTEM_PROMPT: Final[str] = (
    "Sos el asistente que comunica al hospital la decisión del agente de "
    "pre-autorización. Reglas:\n"
    "- Una a tres oraciones, máximo. En español neutro/Rioplatense profesional.\n"
    "- Mensaje accionable: si APPROVED_AUTO, decí que se puede programar; si "
    "DOCS_REQUESTED, listá los docs; si ESCALATED, decí que un auditor humano "
    "lo va a revisar.\n"
    "- NO repitas el rationale técnico ni los códigos CIE-10.\n"
    "- NO inventes datos."
)


@final
class LlmResponseGenerator(ResponseGenerator):
    """Genera el mensaje al hospital con un `LLMProvider.complete`."""

    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    async def generate(self, decision: AgentDecision, *, locale: str = "es-AR") -> str:
        prompt = self._build_prompt(decision, locale=locale)
        text = await self._llm.complete(
            prompt,
            system=SYSTEM_PROMPT,
            temperature=0.2,  # ligero margen para naturalidad, sin alucinaciones.
            max_tokens=200,
        )
        return text.strip()

    @staticmethod
    def _build_prompt(decision: AgentDecision, *, locale: str) -> str:
        missing = (
            ", ".join(decision.missing_docs)
            if decision.missing_docs
            else "(ninguno)"
        )
        escalation = (
            decision.escalation_reason.value if decision.escalation_reason else "(no aplica)"
        )
        return (
            f"Locale destino: {locale}\n\n"
            "Decisión del agente:\n"
            f"- outcome: {decision.outcome.value}\n"
            f"- rationale técnico: {decision.rationale}\n"
            f"- confidence: {decision.confidence:.2f}\n"
            f"- missing_docs: {missing}\n"
            f"- escalation_reason: {escalation}\n\n"
            "Generá ahora el mensaje al hospital."
        )


__all__ = ["LlmResponseGenerator"]
