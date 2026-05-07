import type { Coverage, Policy } from '../../../policies/domain/entities';
import type { MedicalReport } from '../../domain/entities/medical-report';
import type { AgentDecision } from '../../domain/value-objects/agent-decision';
import type { Evidence } from '../../domain/value-objects/evidence';

/**
 * Contexto que recibe el constructor del escenario / decisión.
 * Lleva sólo lo necesario para sintetizar la `AgentDecision` y los pasos.
 */
export interface BuildContext {
  readonly report: MedicalReport;
  readonly policy: Policy;
  readonly coverage: Coverage;
  readonly attachedDocs: readonly string[];
  /** Nombre legible del procedimiento (cuando se conoce). */
  readonly procedureName: string;
  /** Código CIE-10 del procedimiento (puede ser '?' si es ambiguo). */
  readonly procedureCode: string;
  /** Fecha de evaluación (ISO yyyy-mm-dd). Default: 2026-05-06 (alineado al prototipo). */
  readonly evaluationDate: string;
}

/** Días entre dos fechas ISO (yyyy-mm-dd o ISO timestamp). */
export function daysBetween(a: string, b: string): number {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Genera la `AgentDecision` final para un escenario dado.
 * Porteo directo de `decisionFor` en `preatuomatizacion/agent.js` adaptado
 * al contrato del dominio (campos camelCase + `decidedBy` + `modelUsed`).
 */
export function decisionFor(
  scenarioKey: string,
  ctx: BuildContext,
): AgentDecision {
  const { policy, coverage, procedureName, procedureCode, attachedDocs, evaluationDate } = ctx;

  if (scenarioKey === 'APPROVED_AUTO') {
    const elapsed = daysBetween(policy.startDate, evaluationDate);
    const evidence: readonly Evidence[] = [
      {
        source: 'report',
        field: 'diagnóstico',
        quote:
          'Colelitiasis sintomática con cólico biliar recurrente — CIE-10 K80.20.',
      },
      {
        source: 'policy',
        field: 'cobertura.cubierto',
        quote: `${procedureCode} cubierto por plan ${policy.plan}.`,
      },
      {
        source: 'policy',
        field: 'cobertura.diasCarencia',
        quote: `Carencia ${coverage.waitingDays}d; transcurridos ${elapsed}d.`,
      },
    ];
    return {
      outcome: 'APPROVED_AUTO',
      rationale: `Cobertura confirmada para ${procedureName}. Carencia cumplida (${elapsed}d transcurridos ≥ ${coverage.waitingDays}d requeridos). Documentación completa (${coverage.requiredDocs.length}/${coverage.requiredDocs.length}). Procede pre-aprobación con copago $${coverage.copay}.`,
      confidence: 0.94,
      evidence,
      missingDocs: [],
      escalationReason: null,
      decidedBy: 'agent',
      modelUsed: 'deepseek-chat',
    };
  }

  if (scenarioKey === 'DOCS_REQUESTED') {
    const missing = coverage.requiredDocs.filter((d) => !attachedDocs.includes(d));
    const evidence: readonly Evidence[] = [
      {
        source: 'report',
        field: 'documentos_adjuntos',
        quote: `${attachedDocs.length} documento(s) adjuntos: ${attachedDocs.join(', ')}.`,
      },
      {
        source: 'policy',
        field: 'cobertura.docsRequeridos',
        quote: `${coverage.requiredDocs.length} requeridos: ${coverage.requiredDocs.join(', ')}.`,
      },
    ];
    return {
      outcome: 'DOCS_REQUESTED',
      rationale: `Cobertura y carencia OK para ${procedureName}. Faltan ${missing.length} documento(s) del set requerido por la póliza: ${missing.join(', ')}. Solicitar al hospital antes de emitir pre-aprobación.`,
      confidence: 0.88,
      evidence,
      missingDocs: missing,
      escalationReason: null,
      decidedBy: 'agent',
      modelUsed: 'deepseek-chat',
    };
  }

  if (scenarioKey === 'ESCALATED_WAITING') {
    const elapsed = daysBetween(policy.startDate, evaluationDate);
    const evidence: readonly Evidence[] = [
      {
        source: 'policy',
        field: 'fechaInicio',
        quote: `Póliza vigente desde ${policy.startDate}.`,
      },
      {
        source: 'policy',
        field: 'cobertura.diasCarencia',
        quote: `Carencia configurada: ${coverage.waitingDays}d.`,
      },
      {
        source: 'report',
        field: 'fecha_solicitud',
        quote: `Solicitud emitida el ${evaluationDate} — ${elapsed}d transcurridos.`,
      },
    ];
    return {
      outcome: 'ESCALATED',
      rationale: `Carencia incumplida: ${procedureName} requiere ${coverage.waitingDays}d desde inicio de póliza, han transcurrido ${elapsed}d (faltan ${coverage.waitingDays - elapsed}d). POLÍTICA: nunca rechazar de oficio — escalar a auditor médico para evaluar excepción clínica.`,
      confidence: 0.71,
      evidence,
      missingDocs: [],
      escalationReason: 'WAITING_PERIOD_NOT_MET',
      decidedBy: 'agent',
      modelUsed: 'deepseek-chat',
    };
  }

  if (scenarioKey === 'ESCALATED_LOW_CONF') {
    const evidence: readonly Evidence[] = [
      {
        source: 'report',
        field: 'procedimiento_propuesto',
        quote: 'Considerar laparoscopía exploratoria y eventual apendicectomía.',
      },
      {
        source: 'report',
        field: 'diagnóstico',
        quote: 'Probable apendicitis aguda complicada vs. patología anexial.',
      },
    ];
    return {
      outcome: 'ESCALATED',
      rationale:
        'Informe ambiguo entre laparoscopía exploratoria y apendicectomía. Score máximo de match 0.62 contra el catálogo CIE-10 (umbral 0.85). El gate de confidence (≥0.80) tampoco se cumple. Requiere clasificación clínica humana.',
      confidence: 0.42,
      evidence,
      missingDocs: [],
      escalationReason: 'LOW_CONFIDENCE_PROCEDURE_MATCH',
      decidedBy: 'agent',
      modelUsed: 'deepseek-chat',
    };
  }

  // ESCALATED_PDF_FAIL (default defensivo).
  const evidence: readonly Evidence[] = [
    {
      source: 'report',
      field: 'archivo',
      quote: 'informe-vascular-escaneado.pdf · 4.2 MB · 6 páginas, escaneado B/N.',
    },
    {
      source: 'report',
      field: 'extraction_quality',
      quote: 'Calidad 0.41 — bajo umbral 0.70.',
    },
  ];
  return {
    outcome: 'ESCALATED',
    rationale:
      'Vision API no logró extracción confiable del PDF escaneado (calidad 0.41 vs umbral 0.70). NO se intenta OCR creativo por política. Se escala el caso para revisión humana del documento original.',
    confidence: 0.38,
    evidence,
    missingDocs: [],
    escalationReason: 'PDF_EXTRACTION_FAILURE',
    decidedBy: 'agent',
    modelUsed: 'deepseek-chat',
  };
}
