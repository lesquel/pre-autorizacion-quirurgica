"""AuthorizationDecisionMaker — port high-level que produce la `AgentDecision` final.

PRD §3.1.3 — nodo `make_decision` del grafo. Recibe TODO el contexto agregado
por los nodos previos (informe, póliza, cobertura, extracción, outcome
preliminar del rule engine, docs faltantes) y devuelve un `AgentDecision`
con `outcome`, `rationale`, `confidence` y `evidence`.

Gate determinístico post-LLM (`confidence < 0.80` → ESCALATED) NO vive acá:
vive en el rule engine, fuera del LLM, para garantizar que el modelo no pueda
saltárselo.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (
    ExtractedMedicalReport,
)
from pre_autorizacion.features.policies.domain.entities import Coverage, Policy

if TYPE_CHECKING:
    # Forward references — value objects y entidades de authorization_cases
    # los crea otro subagente en paralelo.
    from pre_autorizacion.features.authorization_cases.domain.entities import (
        MedicalReport,
    )
    from pre_autorizacion.features.authorization_cases.domain.value_objects import (
        AgentDecision,
        Outcome,
    )


@dataclass(frozen=True, slots=True)
class DecisionContext:
    """Contexto agregado que el agente le pasa al `AuthorizationDecisionMaker`.

    Inmutable, sin lógica — pura agregación de los outputs de los nodos previos
    del grafo (PRD §3.1.3):
    - `report`              : informe original (DB Notion 6).
    - `policy`              : póliza vigente (DB Notion 4).
    - `coverage`            : cobertura aplicable (DB Notion 5).
    - `extraction`          : output del `MedicalReportExtractor`.
    - `preliminary_outcome` : outcome sugerido por el rule engine determinístico
                              (carencia + docs). El LLM puede confirmarlo o pedir
                              escalamiento si encuentra ambigüedad.
    - `missing_docs`        : docs faltantes detectados por `check_required_docs`.
    """

    report: MedicalReport
    policy: Policy
    coverage: Coverage
    extraction: ExtractedMedicalReport
    preliminary_outcome: Outcome
    missing_docs: tuple[str, ...]


class AuthorizationDecisionMaker(ABC):
    """Port high-level que produce la `AgentDecision` validada.

    Implementaciones concretas viven en `infrastructure/decision/`. Usan
    `LLMProvider.complete_structured` con un schema Pydantic para garantizar
    que el output respete el contrato de `AgentDecision`.
    """

    @abstractmethod
    async def decide(self, context: DecisionContext) -> AgentDecision:
        """Llama al LLM con todo el contexto y devuelve un `AgentDecision`.

        El adapter es responsable de:
        - Construir el system prompt y el prompt principal.
        - Invocar al LLM con structured output (schema Pydantic).
        - Validar y mapear la respuesta al value object `AgentDecision`.
        - NO aplicar el gate de confianza — eso es responsabilidad del rule engine
          que envuelve esta llamada.

        Args:
            context: agregación de informe, póliza, cobertura, extracción y
                outcome preliminar.

        Returns:
            `AgentDecision` válido (outcome + rationale + confidence + evidence).

        Raises:
            LLMProviderError: si la llamada falla o el output no respeta el schema.
        """
