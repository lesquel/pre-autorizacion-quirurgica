/* global React */
// Agent simulation — mimics the LangGraph 7-node run.
// Each scenario produces a deterministic trace with realistic timings.
//
// Stack alineado a PRD v1.1:
//   - Texto (extracción + decisión): DeepSeek `deepseek-chat` (single-model en v1)
//   - Vision (PDFs):                 Gemini `gemini-2.5-flash` vía VisionExtractor
//   - Cost-per-case objetivo:        ≤ $0.02 USD (KPI 5)
//   - Threshold de confidence:       0.80 (gate determinístico post-LLM)

const NODES = [
  { id: 'extract_report',       name: 'extract_report',       label: 'Extracción del informe',                      model: 'deepseek-chat / gemini-2.5-flash' },
  { id: 'match_procedure',      name: 'match_procedure',      label: 'Matching de procedimiento CIE-10',            model: 'rule + embeddings' },
  { id: 'load_policy_coverage', name: 'load_policy_coverage', label: 'Lectura de cobertura desde Notion',           model: 'notion_api' },
  { id: 'check_waiting_period', name: 'check_waiting_period', label: 'Validación de carencia',                      model: 'deterministic' },
  { id: 'check_required_docs',  name: 'check_required_docs',  label: 'Verificación de documentos requeridos',       model: 'deterministic' },
  { id: 'make_decision',        name: 'make_decision',        label: 'Decisión final (structured output)',          model: 'deepseek-chat' },
  { id: 'persist_case',         name: 'persist_case',         label: 'Persistencia del caso',                       model: 'notion_api + filesystem' },
];
window.AGENT_NODES = NODES;

// DeepSeek pricing (aprox.): $0.27 / 1M input + $1.10 / 1M output.
// Mezcla simulada: ~70% input + 30% output → ~$0.52 / 1M tokens efectivos.
const DEEPSEEK_USD_PER_1K_TOKENS = 0.00052;
window.DEEPSEEK_USD_PER_1K_TOKENS = DEEPSEEK_USD_PER_1K_TOKENS;

function fmtMs(ms) { return `${ms.toLocaleString('es')} ms`; }

// Build a scenario trace — returns array of step descriptors with delays + final outcome
function buildScenario(scenario, ctx) {
  const { patient, policy, procedure, coverage, attachedDocs, format } = ctx;

  const steps = [];

  // 1. extract_report
  if (scenario === 'ESCALATED_PDF_FAIL') {
    steps.push({
      node: 'extract_report',
      duration: 2640,
      tokens: 1820,
      state: 'err',
      detail: [
        `format       PDF · 4.2 MB · 6 págs (escaneado)`,
        `vision_pass  fallido — calidad de extracción 0.41 (mín 0.70)`,
        `confidence   0.38`,
        `→ marca: PDF_EXTRACTION_FAILURE`,
      ].join('\n'),
    });
  } else if (scenario === 'ESCALATED_LOW_CONF') {
    steps.push({
      node: 'extract_report',
      duration: 1640,
      tokens: 2120,
      state: 'done',
      detail: [
        `paciente     "PÉREZ TOBAR, Sofía Camila · 36 a · F"`,
        `diagnóstico  "abdomen agudo · prob. apendicitis vs patología anexial"`,
        `procedimiento_propuesto  "laparoscopía exploratoria / apendicectomía" (ambiguo)`,
        `confidence   0.61`,
      ].join('\n'),
    });
  } else {
    steps.push({
      node: 'extract_report',
      duration: 1820 + Math.floor(Math.random() * 240),
      tokens: 1990 + Math.floor(Math.random() * 200),
      state: 'done',
      detail: [
        `paciente     "${patient.name}" · DNI ${patient.dni}`,
        `diagnóstico  ${diagnosisFor(scenario)}`,
        `procedimiento_propuesto  ${procedure.name} · ${procedure.code}`,
        `documentos_adjuntos  ${attachedDocs.length} ítem(s)`,
        `confidence   0.96`,
      ].join('\n'),
    });
  }

  // 2. match_procedure
  if (scenario === 'ESCALATED_LOW_CONF') {
    steps.push({
      node: 'match_procedure',
      duration: 940,
      tokens: 0,
      state: 'warn',
      detail: [
        `candidatos:`,
        `  K35.80  Apendicectomía laparoscópica de urgencia    score 0.62`,
        `  N83.20  Quiste anexial — laparoscopía diagnóstica   score 0.58`,
        `  K65.0   Peritonitis aguda                            score 0.41`,
        `umbral mínimo de match  ≥ 0.85`,
        `→ marca: LOW_CONFIDENCE_PROCEDURE_MATCH`,
      ].join('\n'),
    });
  } else if (scenario === 'ESCALATED_PDF_FAIL') {
    steps.push({ node: 'match_procedure', duration: 0, tokens: 0, state: 'pending', detail: 'omitido — paso anterior falló' });
  } else {
    steps.push({
      node: 'match_procedure',
      duration: 320,
      tokens: 0,
      state: 'done',
      detail: [
        `match: ${procedure.code} · ${procedure.name}`,
        `score 0.99 (rule-based exact match)`,
      ].join('\n'),
    });
  }

  // 3. load_policy_coverage
  if (scenario === 'ESCALATED_PDF_FAIL' || scenario === 'ESCALATED_LOW_CONF') {
    steps.push({ node: 'load_policy_coverage', duration: 0, tokens: 0, state: 'pending', detail: 'omitido — escalamiento temprano' });
  } else {
    steps.push({
      node: 'load_policy_coverage',
      duration: 410 + Math.floor(Math.random() * 80),
      tokens: 0,
      state: 'done',
      detail: [
        `póliza         ${policy.number} (${policy.plan})`,
        `vigencia       ${policy.startDate} → ${policy.endDate}`,
        `cobertura      cubierto=${coverage.covered}  copago=$${coverage.copay}`,
        `días_carencia  ${coverage.waitingDays}`,
        `docs_requeridos  ${coverage.required.length}`,
      ].join('\n'),
    });
  }

  // 4. check_waiting_period
  if (scenario === 'ESCALATED_WAITING') {
    const elapsed = daysBetween(policy.startDate, '2026-05-06');
    steps.push({
      node: 'check_waiting_period',
      duration: 12,
      tokens: 0,
      state: 'err',
      detail: [
        `inicio_póliza        ${policy.startDate}`,
        `fecha_solicitud      2026-05-06`,
        `días_transcurridos   ${elapsed}`,
        `días_carencia        ${coverage.waitingDays}`,
        `→ NO cumple carencia (faltan ${coverage.waitingDays - elapsed} días)`,
        `→ marca: WAITING_PERIOD_NOT_MET`,
      ].join('\n'),
    });
  } else if (scenario === 'ESCALATED_PDF_FAIL' || scenario === 'ESCALATED_LOW_CONF') {
    steps.push({ node: 'check_waiting_period', duration: 0, tokens: 0, state: 'pending', detail: 'omitido' });
  } else {
    const elapsed = daysBetween(policy.startDate, '2026-05-06');
    steps.push({
      node: 'check_waiting_period',
      duration: 8,
      tokens: 0,
      state: 'done',
      detail: [
        `inicio_póliza        ${policy.startDate}`,
        `días_transcurridos   ${elapsed}`,
        `días_carencia        ${coverage.waitingDays}`,
        `→ cumple carencia ✓`,
      ].join('\n'),
    });
  }

  // 5. check_required_docs
  if (scenario === 'DOCS_REQUESTED') {
    const missing = coverage.required.filter(d => !attachedDocs.includes(d));
    steps.push({
      node: 'check_required_docs',
      duration: 14,
      tokens: 0,
      state: 'warn',
      detail: [
        `requeridos       ${coverage.required.length}`,
        `adjuntados       ${attachedDocs.length}`,
        `faltantes        ${missing.length}`,
        `   - ${missing.join(', ')}`,
        `→ DOCS_REQUESTED`,
      ].join('\n'),
    });
  } else if (scenario === 'APPROVED_AUTO') {
    steps.push({
      node: 'check_required_docs',
      duration: 11,
      tokens: 0,
      state: 'done',
      detail: [
        `requeridos       ${coverage.required.length}`,
        `adjuntados       ${attachedDocs.length}`,
        `faltantes        0`,
        `→ documentación completa ✓`,
      ].join('\n'),
    });
  } else {
    steps.push({ node: 'check_required_docs', duration: 0, tokens: 0, state: 'pending', detail: 'omitido' });
  }

  // 6. make_decision
  const decisionDetail = decisionDetailFor(scenario, ctx);
  steps.push({
    node: 'make_decision',
    duration: scenario === 'APPROVED_AUTO' ? 2840 : scenario === 'DOCS_REQUESTED' ? 2210 : 2480,
    tokens: scenario === 'APPROVED_AUTO' ? 2120 : 1840,
    state: 'done',
    detail: decisionDetail,
  });

  // 7. persist_case
  steps.push({
    node: 'persist_case',
    duration: 480 + Math.floor(Math.random() * 80),
    tokens: 0,
    state: 'done',
    detail: [
      `notion_db   CasosAutorización`,
      `case_id     ${ctx.caseId}`,
      `estado      ${terminalStatusFor(scenario)}`,
      `traza       ${steps.length + 1} pasos persistidos`,
    ].join('\n'),
  });

  return steps;
}

function diagnosisFor(scenario) {
  switch (scenario) {
    case 'APPROVED_AUTO': return '"colelitiasis sintomática"';
    case 'DOCS_REQUESTED': return '"hiperplasia prostática benigna grado III"';
    case 'ESCALATED_WAITING': return '"gonartrosis tricompartimental severa"';
    case 'ESCALATED_PDF_FAIL': return '— (extracción fallida)';
    default: return '"abdomen agudo"';
  }
}

function decisionDetailFor(scenario, ctx) {
  const dec = decisionFor(scenario, ctx);
  const lines = [
    `outcome      ${dec.outcome}`,
    `confidence   ${dec.confidence.toFixed(2)}`,
    `model        deepseek-chat`,
    `rationale    ${JSON.stringify(dec.rationale)}`,
  ];
  if (dec.escalation_reason) lines.push(`motivo       ${dec.escalation_reason}`);
  if (dec.evidence && dec.evidence.length) {
    lines.push(`evidence     ${dec.evidence.length} cita(s)`);
    dec.evidence.forEach((e, i) => {
      lines.push(`  [${i+1}] ${e.source}.${e.field}  "${truncate(e.quote, 60)}"`);
    });
  }
  if (dec.missing_docs && dec.missing_docs.length) {
    lines.push(`missing_docs ${dec.missing_docs.join(', ')}`);
  }
  return lines.join('\n');
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// AgentDecision builder — contrato auditable del PRD §3.1.3.
// Devuelve: { outcome, rationale, confidence, evidence[], missing_docs[], escalation_reason }
function decisionFor(scenario, ctx) {
  if (scenario === 'APPROVED_AUTO') {
    const elapsed = daysBetween(ctx.policy.startDate, '2026-05-06');
    return {
      outcome: 'APPROVED_AUTO',
      confidence: 0.94,
      rationale: `Cobertura confirmada para ${ctx.procedure.name}. Carencia cumplida (${elapsed}d transcurridos ≥ ${ctx.coverage.waitingDays}d requeridos). Documentación completa (${ctx.coverage.required.length}/${ctx.coverage.required.length}). Procede pre-aprobación con copago $${ctx.coverage.copay}.`,
      evidence: [
        { source: 'report',  field: 'diagnóstico',           quote: 'Colelitiasis sintomática con cólico biliar recurrente — CIE-10 K80.20.' },
        { source: 'policy',  field: 'cobertura.cubierto',    quote: `${ctx.procedure.code} cubierto por plan ${ctx.policy.plan}.` },
        { source: 'policy',  field: 'cobertura.diasCarencia',quote: `Carencia ${ctx.coverage.waitingDays}d; transcurridos ${elapsed}d.` },
      ],
      missing_docs: [],
      escalation_reason: null,
    };
  }
  if (scenario === 'DOCS_REQUESTED') {
    const missing = ctx.coverage.required.filter(d => !ctx.attachedDocs.includes(d));
    return {
      outcome: 'DOCS_REQUESTED',
      confidence: 0.88,
      rationale: `Cobertura y carencia OK para ${ctx.procedure.name}. Faltan ${missing.length} documento(s) del set requerido por la póliza: ${missing.join(', ')}. Solicitar al hospital antes de emitir pre-aprobación.`,
      evidence: [
        { source: 'report',  field: 'documentos_adjuntos',     quote: `${ctx.attachedDocs.length} documento(s) adjuntos: ${ctx.attachedDocs.join(', ')}.` },
        { source: 'policy',  field: 'cobertura.docsRequeridos',quote: `${ctx.coverage.required.length} requeridos: ${ctx.coverage.required.join(', ')}.` },
      ],
      missing_docs: missing,
      escalation_reason: null,
    };
  }
  if (scenario === 'ESCALATED_WAITING') {
    const elapsed = daysBetween(ctx.policy.startDate, '2026-05-06');
    return {
      outcome: 'ESCALATED',
      confidence: 0.71,
      rationale: `Carencia incumplida: ${ctx.procedure.name} requiere ${ctx.coverage.waitingDays}d desde inicio de póliza, han transcurrido ${elapsed}d (faltan ${ctx.coverage.waitingDays - elapsed}d). POLÍTICA: nunca rechazar de oficio — escalar a auditor médico para evaluar excepción clínica.`,
      evidence: [
        { source: 'policy',  field: 'fechaInicio',             quote: `Póliza vigente desde ${ctx.policy.startDate}.` },
        { source: 'policy',  field: 'cobertura.diasCarencia',  quote: `Carencia configurada: ${ctx.coverage.waitingDays}d.` },
        { source: 'report',  field: 'fecha_solicitud',         quote: `Solicitud emitida el 2026-05-06 — ${elapsed}d transcurridos.` },
      ],
      missing_docs: [],
      escalation_reason: 'WAITING_PERIOD_NOT_MET',
    };
  }
  if (scenario === 'ESCALATED_LOW_CONF') {
    return {
      outcome: 'ESCALATED',
      confidence: 0.42,
      rationale: 'Informe ambiguo entre laparoscopía exploratoria y apendicectomía. Score máximo de match 0.62 contra el catálogo CIE-10 (umbral 0.85). El gate de confidence (≥0.80) tampoco se cumple. Requiere clasificación clínica humana.',
      evidence: [
        { source: 'report',  field: 'procedimiento_propuesto', quote: 'Considerar laparoscopía exploratoria y eventual apendicectomía.' },
        { source: 'report',  field: 'diagnóstico',             quote: 'Probable apendicitis aguda complicada vs. patología anexial.' },
      ],
      missing_docs: [],
      escalation_reason: 'LOW_CONFIDENCE_PROCEDURE_MATCH',
    };
  }
  return {
    outcome: 'ESCALATED',
    confidence: 0.38,
    rationale: 'Vision API no logró extracción confiable del PDF escaneado (calidad 0.41 vs umbral 0.70). NO se intenta OCR creativo por política. Se escala el caso para revisión humana del documento original.',
    evidence: [
      { source: 'report',  field: 'archivo',           quote: 'informe-vascular-escaneado.pdf · 4.2 MB · 6 páginas, escaneado B/N.' },
      { source: 'report',  field: 'extraction_quality',quote: 'Calidad 0.41 — bajo umbral 0.70.' },
    ],
    missing_docs: [],
    escalation_reason: 'PDF_EXTRACTION_FAILURE',
  };
}

function terminalStatusFor(scenario) {
  if (scenario === 'APPROVED_AUTO') return 'APROBADO_AUTO';
  if (scenario === 'DOCS_REQUESTED') return 'PENDIENTE_DOCS';
  return 'ESCALADO';
}

function daysBetween(a, b) {
  const t1 = new Date(a).getTime(), t2 = new Date(b).getTime();
  return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
}

window.buildScenario = buildScenario;
window.decisionFor = decisionFor;
window.terminalStatusFor = terminalStatusFor;
window.daysBetween = daysBetween;
window.fmtMs = fmtMs;
