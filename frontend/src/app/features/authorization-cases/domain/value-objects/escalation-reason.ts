/**
 * EscalationReason — razones por las que el agente escala el caso a un auditor humano.
 *
 * Tomadas de:
 * - `agent.js` (`decisionFor`): WAITING_PERIOD_NOT_MET, LOW_CONFIDENCE_PROCEDURE_MATCH,
 *   PDF_EXTRACTION_FAILURE.
 * - PRD (gate determinístico post-LLM, §3.1.3): `low_confidence` cuando confidence < 0.80.
 * - Casos defensivos comunes: PROCEDURE_NOT_COVERED, POLICY_INACTIVE, EXTRACTION_FAILED,
 *   LOW_CONFIDENCE, PROCEDURE_NOT_MATCHED, UNEXPECTED_ERROR.
 *
 * NOTA: El sistema NUNCA auto-rechaza (PRD §3.1.3). Si algo no encaja → escalar.
 */
export type EscalationReason =
  | 'WAITING_PERIOD_NOT_MET'
  | 'LOW_CONFIDENCE_PROCEDURE_MATCH'
  | 'PDF_EXTRACTION_FAILURE'
  | 'PROCEDURE_NOT_COVERED'
  | 'POLICY_INACTIVE'
  | 'PROCEDURE_NOT_MATCHED'
  | 'EXTRACTION_FAILED'
  | 'LOW_CONFIDENCE'
  | 'UNEXPECTED_ERROR';
