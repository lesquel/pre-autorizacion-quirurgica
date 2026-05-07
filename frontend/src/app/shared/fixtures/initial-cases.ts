import type { AuthorizationCase } from '../../features/authorization-cases/domain/entities';
import type {
  AgentDecision,
  TraceStep,
} from '../../features/authorization-cases/domain/value-objects';

/**
 * INITIAL_CASES — casos pre-cargados para el dashboard de Aseguradora y la
 * bandeja del Auditor en el primer arranque.
 *
 * Origen: `window.INITIAL_CASES` en `preatuomatizacion/data.js`.
 *
 * Campos inferidos / inventados (no estaban en el prototipo):
 * - `reportId`         : derivado del id del caso ('RPT-' + sufijo).
 * - `decision`         : reconstruido a partir de outcome/confidence/escalationReason/missingDocs.
 *                        El `rationale` se sintetiza con texto plausible alineado al PRD.
 * - `agentTrace`       : se persiste un único TraceStep agregado ('agent_run') con el
 *                        durationMs y tokens del prototipo. La traza nodo-por-nodo se
 *                        produce en runtime al re-ejecutar (ver agent.js / buildScenario).
 * - `decidedAt`        : se reusa `createdAt` (caso terminal en el seed).
 * - `decidedBy`        : siempre 'agent' en estos casos sembrados.
 *
 * Mapping de status:
 * - APPROVED_AUTO   → APROBADO_AUTO
 * - DOCS_REQUESTED  → DOCS_PEDIDOS  (en data.js viene como 'PENDIENTE_DOCS' — alias)
 * - ESCALATED       → ESCALADO
 */

interface SeededCaseRaw {
  readonly id: string;
  readonly createdAt: string;
  readonly policyNumber: string;
  readonly outcome:
    | 'APPROVED_AUTO'
    | 'DOCS_REQUESTED'
    | 'ESCALATED';
  readonly confidence: number;
  readonly durationMs: number;
  readonly tokens: number;
  readonly procedureCode: string;
  readonly escalationReason?:
    | 'WAITING_PERIOD_NOT_MET'
    | 'LOW_CONFIDENCE_PROCEDURE_MATCH'
    | 'PDF_EXTRACTION_FAILURE';
  readonly missingDocs?: readonly string[];
}

const RAW: readonly SeededCaseRaw[] = [
  {
    id: 'CASE-01H7K2',
    createdAt: '2026-05-06T08:14:22Z',
    policyNumber: 'POL-2024-04812',
    procedureCode: 'K80.20',
    outcome: 'APPROVED_AUTO',
    confidence: 0.94,
    durationMs: 7820,
    tokens: 4820,
  },
  {
    id: 'CASE-01H7J9',
    createdAt: '2026-05-06T07:51:09Z',
    policyNumber: 'POL-2023-07331',
    procedureCode: 'N40.1',
    outcome: 'DOCS_REQUESTED',
    confidence: 0.88,
    durationMs: 6210,
    tokens: 3990,
    missingDocs: ['Ecografía prostática'],
  },
  {
    id: 'CASE-01H7G3',
    createdAt: '2026-05-06T06:12:44Z',
    policyNumber: 'POL-2025-01193',
    procedureCode: 'M17.11',
    outcome: 'ESCALATED',
    confidence: 0.71,
    escalationReason: 'WAITING_PERIOD_NOT_MET',
    durationMs: 8930,
    tokens: 5210,
  },
  {
    id: 'CASE-01H7F1',
    createdAt: '2026-05-05T22:03:18Z',
    policyNumber: 'POL-2024-09872',
    procedureCode: '?',
    outcome: 'ESCALATED',
    confidence: 0.42,
    escalationReason: 'LOW_CONFIDENCE_PROCEDURE_MATCH',
    durationMs: 9430,
    tokens: 4980,
  },
  {
    id: 'CASE-01H7E8',
    createdAt: '2026-05-05T19:22:55Z',
    policyNumber: 'POL-2025-02240',
    procedureCode: 'I83.90',
    outcome: 'ESCALATED',
    confidence: 0.38,
    escalationReason: 'PDF_EXTRACTION_FAILURE',
    durationMs: 11210,
    tokens: 6420,
  },
  {
    id: 'CASE-01H7C4',
    createdAt: '2026-05-05T15:48:11Z',
    policyNumber: 'POL-2024-04812',
    procedureCode: 'H25.13',
    outcome: 'APPROVED_AUTO',
    confidence: 0.96,
    durationMs: 6440,
    tokens: 4120,
  },
  {
    id: 'CASE-01H7B0',
    createdAt: '2026-05-05T11:09:33Z',
    policyNumber: 'POL-2024-09872',
    procedureCode: 'K35.80',
    outcome: 'APPROVED_AUTO',
    confidence: 0.91,
    durationMs: 5810,
    tokens: 3680,
  },
];

function rationaleFor(raw: SeededCaseRaw): string {
  switch (raw.outcome) {
    case 'APPROVED_AUTO':
      return `Cobertura confirmada para ${raw.procedureCode}. Carencia cumplida y documentación completa. Procede pre-aprobación automática.`;
    case 'DOCS_REQUESTED': {
      const missing = raw.missingDocs?.join(', ') ?? '';
      return `Cobertura y carencia OK para ${raw.procedureCode}. Faltan documentos requeridos por la póliza: ${missing}. Solicitar al hospital antes de emitir pre-aprobación.`;
    }
    case 'ESCALATED':
      switch (raw.escalationReason) {
        case 'WAITING_PERIOD_NOT_MET':
          return `Carencia incumplida para ${raw.procedureCode}. POLÍTICA: nunca rechazar de oficio — escalar a auditor médico para evaluar excepción clínica.`;
        case 'LOW_CONFIDENCE_PROCEDURE_MATCH':
          return 'Match de procedimiento por debajo del umbral configurado (0.85). Confidence general < 0.80. Requiere clasificación clínica humana.';
        case 'PDF_EXTRACTION_FAILURE':
          return 'Vision API no logró extracción confiable del PDF. NO se intenta OCR creativo por política. Se escala el caso para revisión humana del documento original.';
        default:
          return 'Caso escalado por motivos no especificados.';
      }
  }
}

function buildDecision(raw: SeededCaseRaw): AgentDecision {
  return {
    outcome: raw.outcome,
    rationale: rationaleFor(raw),
    confidence: raw.confidence,
    evidence: [],
    missingDocs: raw.missingDocs ?? [],
    escalationReason: raw.escalationReason ?? null,
    decidedBy: 'agent',
    modelUsed: 'deepseek-chat',
  };
}

function buildTrace(raw: SeededCaseRaw): readonly TraceStep[] {
  // Trace agregado: el detalle nodo-por-nodo se reconstruye en runtime al
  // re-ejecutar con buildScenario (preatuomatizacion/agent.js).
  const step: TraceStep = {
    node: 'agent_run',
    timestamp: raw.createdAt,
    state: raw.outcome === 'ESCALATED' ? 'error' : 'done',
    durationMs: raw.durationMs,
    modelUsed: 'deepseek-chat',
    tokensIn: Math.round(raw.tokens * 0.7),
    tokensOut: raw.tokens - Math.round(raw.tokens * 0.7),
    detail: `${raw.outcome} · confidence=${raw.confidence}`,
  };
  return [step];
}

function statusFor(raw: SeededCaseRaw): AuthorizationCase['status'] {
  switch (raw.outcome) {
    case 'APPROVED_AUTO':
      return 'APROBADO_AUTO';
    case 'DOCS_REQUESTED':
      return 'DOCS_PEDIDOS';
    case 'ESCALATED':
      return 'ESCALADO';
  }
}

export const INITIAL_CASES: readonly AuthorizationCase[] = RAW.map((raw) => ({
  id: raw.id,
  reportId: `RPT-${raw.id.slice(5)}`,
  policyNumber: raw.policyNumber,
  status: statusFor(raw),
  decision: buildDecision(raw),
  agentTrace: buildTrace(raw),
  createdAt: raw.createdAt,
  decidedAt: raw.createdAt,
}));
