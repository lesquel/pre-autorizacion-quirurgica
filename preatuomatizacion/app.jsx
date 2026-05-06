/* global React, ReactDOM, INITIAL_CASES, SEED, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakSelect */
const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2A8C7B",
  "typePair": "mono+sans"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ["#2A8C7B", "#3D6FB3", "#A0522D", "#7C5BB8", "#1A1916"];

const TYPE_PAIRS = {
  "mono+sans":   { mono: "JetBrains Mono", sans: "Inter",         serif: "Newsreader" },
  "mono+serif":  { mono: "JetBrains Mono", sans: "Newsreader",    serif: "Newsreader" },
  "ibm-style":   { mono: "JetBrains Mono", sans: "Inter Tight",   serif: "Newsreader" },
  "humanist":    { mono: "JetBrains Mono", sans: "Work Sans",     serif: "Fraunces" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = useState('hospital');
  const [view, setView] = useState('submit');
  const [cases, setCases] = useState(INITIAL_CASES);
  const [run, setRun] = useState(null); // active live run
  const [auditorCase, setAuditorCase] = useState(null);

  // Apply tweaks
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    const pair = TYPE_PAIRS[t.typePair] || TYPE_PAIRS["mono+sans"];
    r.style.setProperty('--font-mono',  `'${pair.mono}', ui-monospace, monospace`);
    r.style.setProperty('--font-sans',  `'${pair.sans}', system-ui, sans-serif`);
    r.style.setProperty('--font-serif', `'${pair.serif}', Georgia, serif`);
  }, [t]);

  // When role changes, pick a sensible default view
  useEffect(() => {
    if (role === 'hospital') setView('submit');
    if (role === 'insurer')  setView('dashboard');
    if (role === 'auditor')  setView('tray');
    setAuditorCase(null);
    setRun(null);
  }, [role]);

  const counts = useMemo(() => ({
    hospital: { total: cases.length },
    insurer:  { total: cases.length },
    auditor: {
      escalated: cases.filter(c => c.outcome === 'ESCALATED' && c.status === 'ESCALADO').length,
      resolved:  cases.filter(c => c.status === 'DECIDIDO' && c.resolvedBy).length,
    },
  }), [cases]);

  function startRun(payload) {
    const patient = findPatient(payload.patientId);
    const policy = findPolicy(payload.policyNumber);
    const procedure = findProc(SEED.demoCases[payload.scenario].procedureCode);
    const coverage = findCoverage(payload.policyNumber, SEED.demoCases[payload.scenario].procedureCode)
      || { covered:true, waitingDays:0, copay:0, required:[] };
    const caseId = 'CASE-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const traceId = '01HZ-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    setRun({
      caseId, traceId, scenario: payload.scenario,
      ctx: { patient, policy, procedure, coverage,
             attachedDocs: payload.attachedDocs, format: payload.format, caseId },
    });
    setView('run');
  }

  function finishRun(result, trace) {
    if (!run) return;
    const totalDur = trace.reduce((a, t) => a + (t.duration||0), 0);
    const totalTok = trace.reduce((a, t) => a + (t.tokens||0), 0);
    const newCase = {
      id: run.caseId,
      createdAt: new Date().toISOString(),
      patientId: run.ctx.patient.id,
      procedureCode: run.ctx.procedure?.code || '?',
      policyNumber: run.ctx.policy.number,
      outcome: result.outcome,
      status: result.outcome === 'APPROVED_AUTO' ? 'DECIDIDO'
            : result.outcome === 'DOCS_REQUESTED' ? 'PENDIENTE_DOCS'
            : 'ESCALADO',
      confidence: result.confidence,
      durationMs: totalDur,
      tokens: totalTok,
      costUsd: parseFloat(result.cost),
      escalationReason: result.reason,
      missingDocs: result.missing,
      submittedBy: 'hospital',
    };
    setCases(prev => [newCase, ...prev]);
  }

  function resolveCase(caseId, resolution) {
    setCases(prev => prev.map(c => c.id === caseId ? {
      ...c, status: 'DECIDIDO',
      resolvedBy: resolution.resolvedBy,
      resolutionOutcome: resolution.outcome,
      resolutionReasoning: resolution.reasoning,
      resolvedAt: new Date().toISOString(),
    } : c));
    setAuditorCase(null);
  }

  // Render
  return (
    <>
      <TopBar role={role} setRole={setRole} caseCount={cases.length} />
      <div className="shell">
        <SideNav role={role} view={view} setView={(v) => { setView(v); setAuditorCase(null); }} counts={counts} />
        <main className="main">
          {role === 'hospital' && view === 'submit' && (
            <>
              <PageHeader
                crumbs={["HOSPITAL METROPOLITANO", "PRE-AUTORIZACIÓN", "NUEVA SOLICITUD"]}
                title="Solicitar pre-autorización quirúrgica"
                subtitle="Cargue el informe médico (texto o PDF). El agente analizará cobertura, carencia y documentación. Respuesta en menos de 20 segundos."
              />
              <HospitalSubmit submit={startRun} busy={false} />
            </>
          )}
          {role === 'hospital' && view === 'run' && run && (
            <>
              <PageHeader
                crumbs={["HOSPITAL METROPOLITANO", "PRE-AUTORIZACIÓN", "EJECUCIÓN EN VIVO"]}
                title={"Procesando " + run.caseId}
                subtitle="El agente ejecuta los nodos secuencialmente y emite eventos SSE en tiempo real."
              >
                <button className="btn" onClick={() => setView('submit')}>Cancelar</button>
              </PageHeader>
              <HospitalLiveRun run={run} onDone={finishRun} onClose={() => setView('cases')} />
            </>
          )}
          {role === 'hospital' && view === 'cases' && (
            <>
              <PageHeader
                crumbs={["HOSPITAL METROPOLITANO", "MIS CASOS"]}
                title="Casos del hospital"
                subtitle="Casos enviados por el hospital, con outcome del agente y métricas de ejecución."
              >
                <button className="btn btn-primary" onClick={() => setView('submit')}>+ Nueva solicitud</button>
              </PageHeader>
              <HospitalCases cases={cases} openCase={() => {}} />
            </>
          )}
          {role === 'hospital' && view === 'procedures' && (
            <>
              <PageHeader
                crumbs={["HOSPITAL METROPOLITANO", "CATÁLOGO"]}
                title="Procedimientos disponibles"
                subtitle="Catálogo CIE-10 sembrado en Notion y consumido por el agente para el matching de procedimientos."
              />
              <HospitalProcedures />
            </>
          )}

          {role === 'insurer' && view === 'dashboard' && (
            <>
              <PageHeader
                crumbs={["ASEGURADORA ANDINA", "OPERACIÓN", "DASHBOARD"]}
                title="Operación del agente"
                subtitle="Métricas agregadas en tiempo real: tasa de auto-resolución, latencia, costo por caso y distribución de outcomes."
              >
                <div className="seg"><button data-on="true">7d</button><button data-on="false">30d</button><button data-on="false">90d</button></div>
              </PageHeader>
              <InsurerDashboard cases={cases} />
            </>
          )}
          {role === 'insurer' && view === 'cases' && (
            <>
              <PageHeader
                crumbs={["ASEGURADORA ANDINA", "OPERACIÓN", "CASOS"]}
                title="Casos procesados"
                subtitle="Vista agregada de todos los casos. La aseguradora ve volúmenes y outcomes; los detalles clínicos quedan en manos del auditor."
              />
              <InsurerCases cases={cases} openCase={() => {}} />
            </>
          )}
          {role === 'insurer' && view === 'policies' && (
            <>
              <PageHeader
                crumbs={["ASEGURADORA ANDINA", "CONFIGURACIÓN", "PÓLIZAS"]}
                title="Gestión de pólizas"
                subtitle="CRUD de pólizas y coberturas. El agente lee estos datos para validar carencia y documentos requeridos."
              />
              <InsurerPolicies />
            </>
          )}
          {role === 'insurer' && view === 'coverages' && (
            <>
              <PageHeader
                crumbs={["ASEGURADORA ANDINA", "CONFIGURACIÓN", "COBERTURAS"]}
                title="Matriz de coberturas"
                subtitle="Combinaciones póliza × procedimiento — la fuente de verdad que usa el agente para la decisión."
              />
              <InsurerCoverages />
            </>
          )}

          {role === 'auditor' && view === 'tray' && !auditorCase && (
            <>
              <PageHeader
                crumbs={["AUDITORÍA MÉDICA", "BANDEJA"]}
                title="Casos escalados a revisión"
                subtitle="Casos donde el agente prefirió no decidir. Por política, ningún rechazo es automático: cada negativa pasa por juicio clínico humano."
              />
              <AuditorTray cases={cases} openCase={setAuditorCase} mode="escalated" />
            </>
          )}
          {role === 'auditor' && view === 'resolved' && !auditorCase && (
            <>
              <PageHeader
                crumbs={["AUDITORÍA MÉDICA", "RESUELTOS"]}
                title="Casos resueltos por auditoría"
                subtitle="Histórico de resoluciones humanas con justificación clínica adjunta al record permanente."
              />
              <AuditorTray cases={cases} openCase={setAuditorCase} mode="resolved" />
            </>
          )}
          {role === 'auditor' && auditorCase && (
            <AuditorCaseDetail
              caseRec={auditorCase}
              onBack={() => setAuditorCase(null)}
              onResolve={resolveCase}
            />
          )}
        </main>
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Color">
          <TweakColor
            label="Accent"
            value={t.accent}
            options={ACCENT_OPTIONS}
            onChange={v => setTweak('accent', v)}
          />
        </TweakSection>
        <TweakSection title="Tipografía">
          <TweakSelect
            label="Pareja tipográfica"
            value={t.typePair}
            options={[
              { value: 'mono+sans',  label: 'Mono + Inter (default)' },
              { value: 'mono+serif', label: 'Mono + Newsreader' },
              { value: 'ibm-style',  label: 'Mono + Inter Tight' },
              { value: 'humanist',   label: 'Mono + Work Sans/Fraunces' },
            ]}
            onChange={v => setTweak('typePair', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
