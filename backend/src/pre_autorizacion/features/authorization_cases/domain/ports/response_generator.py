"""ResponseGenerator — port que genera el mensaje final al hospital en español.

Port opcional que separa la generación del mensaje user-facing del razonamiento
estructurado del `AuthorizationDecisionMaker`.

Por qué existe (y NO se absorbe en el decision maker):
- El `AgentDecision` lleva un `rationale` técnico-clínico orientado a auditor.
- El hospital necesita además un mensaje natural, corto y accionable
  ("Pre-aprobado para colecistectomía. Copago: USD 200. Programación libre.").
- Separar la responsabilidad permite cachear el mensaje, traducirlo más adelante,
  y testear los dos paths de manera independiente.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Forward reference — el value object `AgentDecision` lo crea otro subagente.
    from pre_autorizacion.features.authorization_cases.domain.value_objects import (
        AgentDecision,
    )


class ResponseGenerator(ABC):
    """Port que produce el mensaje final hacia el hospital en lenguaje natural."""

    @abstractmethod
    async def generate(self, decision: AgentDecision, *, locale: str = "es-AR") -> str:
        """Genera el mensaje user-facing a partir de la decisión del agente.

        Args:
            decision: la decisión final ya validada (incluye outcome, rationale,
                confidence, evidence, missing_docs, escalation_reason).
            locale: locale destino. v1 sólo soporta `"es-AR"`; existe el parámetro
                para no romper el contrato cuando llegue i18n post-v1.

        Returns:
            Texto en español natural, corto, listo para mostrar en la UI del hospital.
        """
