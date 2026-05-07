import type { TraceStep } from '../../domain/value-objects/trace-step';

import type { BuildContext } from './decision';
import { daysBetween, decisionFor } from './decision';

/**
 * Plan de un paso ANTES de ejecutarse — el adapter lo usa para emitir
 * primero un `running` (sin `durationMs`) y luego, tras esperar `durationMs`,
 * un `done`/`error` con la traza completa.
 *
 * Este tipo es interno a la infraestructura del agente (no parte del dominio).
 */
export interface PlannedStep {
  readonly node: string;
  readonly durationMs: number;
  readonly state: 'done' | 'error';
  readonly detail: string;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly modelUsed?: string;
  readonly error?: string;
}

const DEEPSEEK = 'deepseek-chat';
const VISION = 'gemini-2.5-flash';

/** Split aprox. 70/30 input/output que usa el prototipo. */
function splitTokens(total: number): { tokensIn: number; tokensOut: number } {
  const tokensIn = Math.round(total * 0.7);
  return { tokensIn, tokensOut: total - tokensIn };
}

/**
 * Construye el plan de pasos del agente para el escenario indicado.
 * Porteo de `buildScenario` en `preatuomatizacion/agent.js`.
 *
 * NOTA sobre estados:
 * - El prototipo usaba `warn`/`pending` además de `done`/`err`. El dominio
 *   sólo conserva `running | done | error`. Acá colapsamos:
 *     - `warn`    → `done` (con `detail` que conserva la nota — la UI puede pintarla).
 *     - `pending` → se OMITE (no emitimos pasos saltados; el detalle "omitido" no aporta).
 *     - `err`     → `error` con `error` poblado.
 */
export function buildScenario(
  scenarioKey: string,
  ctx: BuildContext,
): readonly PlannedStep[] {
  const { policy, coverage, attachedDocs, procedureName, procedureCode, evaluationDate, report } = ctx;
  const steps: PlannedStep[] = [];

  // 1. extract_report
  if (scenarioKey === 'ESCALATED_PDF_FAIL') {
    steps.push({
      node: 'extract_report',
      durationMs: 2640,
      state: 'error',
      modelUsed: VISION,
      ...splitTokens(1820),
      detail: [
        'format       PDF · 4.2 MB · 6 págs (escaneado)',
        'vision_pass  fallido — calidad de extracción 0.41 (mín 0.70)',
        'confidence   0.38',
        '→ marca: PDF_EXTRACTION_FAILURE',
      ].join('\n'),
      error: 'PDF_EXTRACTION_FAILURE',
    });
    // Resto omitido — el agente corta acá. Aún así emitimos `make_decision`
    // y `persist_case` al final para mantener la simetría de la UI.
  } else if (scenarioKey === 'ESCALATED_LOW_CONF') {
    steps.push({
      node: 'extract_report',
      durationMs: 1640,
      state: 'done',
      modelUsed: DEEPSEEK,
      ...splitTokens(2120),
      detail: [
        'paciente     "PÉREZ TOBAR, Sofía Camila · 36 a · F"',
        'diagnóstico  "abdomen agudo · prob. apendicitis vs patología anexial"',
        'procedimiento_propuesto  "laparoscopía exploratoria / apendicectomía" (ambiguo)',
        'confidence   0.61',
      ].join('\n'),
    });
  } else {
    // Patient name puede no estar en `MedicalReport`. Tomamos `attendingDoctor`
    // como fallback informativo y dejamos el id si no hay más.
    const patientLine = report.attendingDoctor
      ? `médico tratante  ${report.attendingDoctor}`
      : `paciente_id  ${report.patientId}`;
    steps.push({
      node: 'extract_report',
      durationMs: 1820 + Math.floor(Math.random() * 240),
      state: 'done',
      modelUsed: DEEPSEEK,
      ...splitTokens(1990 + Math.floor(Math.random() * 200)),
      detail: [
        patientLine,
        `diagnóstico  ${diagnosisFor(scenarioKey)}`,
        `procedimiento_propuesto  ${procedureName} · ${procedureCode}`,
        `documentos_adjuntos  ${attachedDocs.length} ítem(s)`,
        'confidence   0.96',
      ].join('\n'),
    });
  }

  // 2. match_procedure
  if (scenarioKey === 'ESCALATED_LOW_CONF') {
    steps.push({
      node: 'match_procedure',
      durationMs: 940,
      state: 'done', // 'warn' → 'done' (la nota viaja en `detail`).
      detail: [
        'candidatos:',
        '  K35.80  Apendicectomía laparoscópica de urgencia    score 0.62',
        '  N83.20  Quiste anexial — laparoscopía diagnóstica   score 0.58',
        '  K65.0   Peritonitis aguda                            score 0.41',
        'umbral mínimo de match  ≥ 0.85',
        '→ marca: LOW_CONFIDENCE_PROCEDURE_MATCH',
      ].join('\n'),
    });
  } else if (scenarioKey !== 'ESCALATED_PDF_FAIL') {
    steps.push({
      node: 'match_procedure',
      durationMs: 320,
      state: 'done',
      detail: [
        `match: ${procedureCode} · ${procedureName}`,
        'score 0.99 (rule-based exact match)',
      ].join('\n'),
    });
  }
  // PDF_FAIL: omitido (pending en el prototipo).

  // 3. load_policy_coverage
  if (
    scenarioKey !== 'ESCALATED_PDF_FAIL' &&
    scenarioKey !== 'ESCALATED_LOW_CONF'
  ) {
    steps.push({
      node: 'load_policy_coverage',
      durationMs: 410 + Math.floor(Math.random() * 80),
      state: 'done',
      modelUsed: 'notion_api',
      detail: [
        `póliza         ${policy.number} (${policy.plan})`,
        `vigencia       ${policy.startDate} → ${policy.endDate}`,
        `cobertura      cubierto=${coverage.covered}  copago=$${coverage.copay}`,
        `días_carencia  ${coverage.waitingDays}`,
        `docs_requeridos  ${coverage.requiredDocs.length}`,
      ].join('\n'),
    });
  }

  // 4. check_waiting_period
  if (scenarioKey === 'ESCALATED_WAITING') {
    const elapsed = daysBetween(policy.startDate, evaluationDate);
    steps.push({
      node: 'check_waiting_period',
      durationMs: 80, // bumped vs prototipo (12ms) para que el ojo lo registre.
      state: 'error',
      detail: [
        `inicio_póliza        ${policy.startDate}`,
        `fecha_solicitud      ${evaluationDate}`,
        `días_transcurridos   ${elapsed}`,
        `días_carencia        ${coverage.waitingDays}`,
        `→ NO cumple carencia (faltan ${coverage.waitingDays - elapsed} días)`,
        '→ marca: WAITING_PERIOD_NOT_MET',
      ].join('\n'),
      error: 'WAITING_PERIOD_NOT_MET',
    });
  } else if (
    scenarioKey !== 'ESCALATED_PDF_FAIL' &&
    scenarioKey !== 'ESCALATED_LOW_CONF'
  ) {
    const elapsed = daysBetween(policy.startDate, evaluationDate);
    steps.push({
      node: 'check_waiting_period',
      durationMs: 60, // bumped vs prototipo (8ms) por el mismo motivo.
      state: 'done',
      detail: [
        `inicio_póliza        ${policy.startDate}`,
        `días_transcurridos   ${elapsed}`,
        `días_carencia        ${coverage.waitingDays}`,
        '→ cumple carencia ✓',
      ].join('\n'),
    });
  }

  // 5. check_required_docs
  if (scenarioKey === 'DOCS_REQUESTED') {
    const missing = coverage.requiredDocs.filter((d) => !attachedDocs.includes(d));
    steps.push({
      node: 'check_required_docs',
      durationMs: 90, // bumped vs prototipo (14ms).
      state: 'done', // 'warn' → 'done'; el escalado real lo decide make_decision.
      detail: [
        `requeridos       ${coverage.requiredDocs.length}`,
        `adjuntados       ${attachedDocs.length}`,
        `faltantes        ${missing.length}`,
        `   - ${missing.join(', ')}`,
        '→ DOCS_REQUESTED',
      ].join('\n'),
    });
  } else if (scenarioKey === 'APPROVED_AUTO') {
    steps.push({
      node: 'check_required_docs',
      durationMs: 80,
      state: 'done',
      detail: [
        `requeridos       ${coverage.requiredDocs.length}`,
        `adjuntados       ${attachedDocs.length}`,
        'faltantes        0',
        '→ documentación completa ✓',
      ].join('\n'),
    });
  }
  // ESCALATED_*: omitido.

  // 6. make_decision — siempre se ejecuta (incluso en PDF_FAIL: el agente
  // sintetiza la decisión final de "escalar" igual).
  const decisionDuration =
    scenarioKey === 'APPROVED_AUTO'
      ? 2840
      : scenarioKey === 'DOCS_REQUESTED'
        ? 2210
        : 2480;
  const decisionTokens = scenarioKey === 'APPROVED_AUTO' ? 2120 : 1840;
  steps.push({
    node: 'make_decision',
    durationMs: decisionDuration,
    state: 'done',
    modelUsed: DEEPSEEK,
    ...splitTokens(decisionTokens),
    detail: decisionDetailFor(scenarioKey, ctx),
  });

  // 7. persist_case
  steps.push({
    node: 'persist_case',
    durationMs: 480 + Math.floor(Math.random() * 80),
    state: 'done',
    modelUsed: 'notion_api',
    detail: [
      'notion_db   CasosAutorización',
      `case_id     ${report.id}`,
      `estado      ${terminalStatusFor(scenarioKey)}`,
      `traza       ${steps.length + 1} pasos persistidos`,
    ].join('\n'),
  });

  return steps;
}

function diagnosisFor(scenarioKey: string): string {
  switch (scenarioKey) {
    case 'APPROVED_AUTO':
      return '"colelitiasis sintomática"';
    case 'DOCS_REQUESTED':
      return '"hiperplasia prostática benigna grado III"';
    case 'ESCALATED_WAITING':
      return '"gonartrosis tricompartimental severa"';
    case 'ESCALATED_PDF_FAIL':
      return '— (extracción fallida)';
    default:
      return '"abdomen agudo"';
  }
}

function decisionDetailFor(scenarioKey: string, ctx: BuildContext): string {
  const dec = decisionFor(scenarioKey, ctx);
  const lines = [
    `outcome      ${dec.outcome}`,
    `confidence   ${dec.confidence.toFixed(2)}`,
    `model        ${dec.modelUsed ?? 'deepseek-chat'}`,
    `rationale    ${JSON.stringify(dec.rationale)}`,
  ];
  if (dec.escalationReason) lines.push(`motivo       ${dec.escalationReason}`);
  if (dec.evidence.length) {
    lines.push(`evidence     ${dec.evidence.length} cita(s)`);
    dec.evidence.forEach((e, i) => {
      lines.push(`  [${i + 1}] ${e.source}.${e.field}  "${truncate(e.quote, 60)}"`);
    });
  }
  if (dec.missingDocs.length) {
    lines.push(`missing_docs ${dec.missingDocs.join(', ')}`);
  }
  return lines.join('\n');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function terminalStatusFor(scenarioKey: string): string {
  if (scenarioKey === 'APPROVED_AUTO') return 'APROBADO_AUTO';
  if (scenarioKey === 'DOCS_REQUESTED') return 'PENDIENTE_DOCS';
  return 'ESCALADO';
}
