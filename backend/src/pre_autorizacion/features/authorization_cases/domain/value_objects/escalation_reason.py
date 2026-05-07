"""EscalationReason — razones por las que el agente escala el caso a un auditor humano.

Port directo de
`frontend/src/app/features/authorization-cases/domain/value-objects/escalation-reason.ts`.

Tomadas de:
- `agent.js` (`decisionFor`): WAITING_PERIOD_NOT_MET, LOW_CONFIDENCE_PROCEDURE_MATCH,
  PDF_EXTRACTION_FAILURE.
- PRD (gate determinístico post-LLM, §3.1.3): `LOW_CONFIDENCE` cuando confidence < 0.80.
- Casos defensivos: PROCEDURE_NOT_COVERED, POLICY_INACTIVE, EXTRACTION_FAILED,
  PROCEDURE_NOT_MATCHED, UNEXPECTED_ERROR.

NOTA: El sistema NUNCA auto-rechaza (PRD §3.1.3). Si algo no encaja → escalar.
"""

from __future__ import annotations

from enum import StrEnum


class EscalationReason(StrEnum):
    """EscalationReason — motivos de escalamiento a auditor humano."""

    WAITING_PERIOD_NOT_MET = "WAITING_PERIOD_NOT_MET"
    LOW_CONFIDENCE_PROCEDURE_MATCH = "LOW_CONFIDENCE_PROCEDURE_MATCH"
    PDF_EXTRACTION_FAILURE = "PDF_EXTRACTION_FAILURE"
    PROCEDURE_NOT_COVERED = "PROCEDURE_NOT_COVERED"
    POLICY_INACTIVE = "POLICY_INACTIVE"
    PROCEDURE_NOT_MATCHED = "PROCEDURE_NOT_MATCHED"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    UNEXPECTED_ERROR = "UNEXPECTED_ERROR"
