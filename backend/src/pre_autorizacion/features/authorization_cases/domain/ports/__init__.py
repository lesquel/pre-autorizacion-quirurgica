"""Ports del slice `authorization_cases/domain`.

Re-exporta:
- Ports high-level del agente (`MedicalReportExtractor`, `AuthorizationDecisionMaker`,
  `ResponseGenerator`, `AgentOrchestrator`).
- Port de persistencia (`CaseRepository`).
- Tipos auxiliares públicos (`ExtractedMedicalReport`, `DecisionContext`,
  `AgentRunRequest`, `AgentEvent` y sus tres variantes).

Adapters concretos viven en `features/authorization_cases/infrastructure/`.
"""

from pre_autorizacion.features.authorization_cases.domain.ports.agent_orchestrator import (
    AgentDoneEvent,
    AgentErrorEvent,
    AgentEvent,
    AgentOrchestrator,
    AgentRunRequest,
    AgentStepEvent,
)
from pre_autorizacion.features.authorization_cases.domain.ports.authorization_decision_maker import (
    AuthorizationDecisionMaker,
    DecisionContext,
)
from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
    CaseRepository,
)
from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (
    ExtractedMedicalReport,
    MedicalReportExtractor,
)
from pre_autorizacion.features.authorization_cases.domain.ports.response_generator import (
    ResponseGenerator,
)

__all__ = [
    "AgentDoneEvent",
    "AgentErrorEvent",
    "AgentEvent",
    "AgentOrchestrator",
    "AgentRunRequest",
    "AgentStepEvent",
    "AuthorizationDecisionMaker",
    "CaseRepository",
    "DecisionContext",
    "ExtractedMedicalReport",
    "MedicalReportExtractor",
    "ResponseGenerator",
]
