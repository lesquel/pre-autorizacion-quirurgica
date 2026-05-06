/* global React, SEED, buildScenario, decisionFor, terminalStatusFor, fmtMs, daysBetween, DEEPSEEK_USD_PER_1K_TOKENS */
const { useState, useEffect, useRef } = React;

// ============= Hospital — Submit + Live Run =============

const SCENARIO_DESCRIPTIONS = {
  APPROVED_AUTO:     'Cobertura cumplida y documentación completa — el agente pre-aprueba en segundos.',
  DOCS_REQUESTED:    'Cobertura OK pero faltan documentos del set requerido por la póliza.',
  ESCALATED_WAITING: 'La carencia no se cumple. Por política, el agente nunca rechaza: escala a auditor.',
  ESCALATED_LOW_CONF:'Informe ambiguo: ningún procedimiento supera el umbral de match. Escala a auditor.',
  ESCALATED_PDF_FAIL:'PDF escaneado no extraíble con calidad mínima. Escala a auditor.',
};

function ReportField({ value, onChange, format }) {
  if (format === 'PDF') {
    return (
      <div className="panel" style={{padding: 16}}>
        <div className="row" style={{gap:14}}>
          <div style={{
            width: 56, height: 72, background:'var(--bg-3)', border:'1px solid var(--line-2)',
            display:'grid', placeItems:'center', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)'
          }}>PDF</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--font-mono)', fontSize:13}}>informe-vascular-escaneado.pdf</div>
            <div style={{fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-4)', marginTop:3}}>
              4.2 MB · 6 páginas · escaneado en blanco y negro
            </div>
            <div style={{marginTop:8}}>
              <Pill tone="warn">VISION REQUERIDO</Pill>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      <textarea rows="14" value={value} onChange={e => onChange(e.target.value)} placeholder="Pegue o escriba el informe médico aquí…"></textarea>
    </div>
  );
}

window.HospitalSubmit = function HospitalSubmit({ submit, busy }) {
  const [scenario, setScenario] = useState('APPROVED_AUTO');
  const seed = SEED.demoCases[scenario];
  const [report, setReport] = useState(seed.report);
  const [policyNum, setPolicyNum] = useState(seed.policyNumber);
  const [patientId, setPatientId] = useState(seed.patientId);

  // when scenario changes, reload its inputs
  useEffect(() => {
    setReport(seed.report);
    setPolicyNum(seed.policyNumber);
    setPatientId(seed.patientId);
  }, [scenario]);

  const patient = findPatient(patientId);
  const policy = findPolicy(policyNum);

  function onSubmit() {
    submit({ scenario, patientId, policyNumber: policyNum, report, format: seed.format, attachedDocs: seed.attachedDocs });
  }

  return (
    <div className="col-pad" style={{display:'grid', gap:18, maxWidth: 980}}>
      <div className="panel">
        <div className="panel-header">
          <h3>1 · Elegir un escenario de demo</h3>
          <span className="mono-label">5 casos coherentes</span>
        </div>
        <div className="panel-body">
          <div className="case-picker">
            {Object.entries(SEED.demoCases).map(([key, c]) => (
              <button
                key={key}
                className="case-chip"
                data-selected={scenario === key}
                onClick={() => setScenario(key)}
                type="button"
              >
                <span className="case-name">{c.label}</span>
                <span className="case-key">{key.replace(/_/g, ' · ')}</span>
              </button>
            ))}
          </div>
          <div className="note" style={{marginTop:12}}>
            {SCENARIO_DESCRIPTIONS[scenario]}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>2 · Datos del caso</h3>
          <span className="mono-label">paciente · póliza · informe</span>
        </div>
        <div className="panel-body" style={{display:'grid', gap:14}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <div className="field">
              <label>Paciente</label>
              <select value={patientId} onChange={e => setPatientId(e.target.value)}>
                {SEED.patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.dni}</option>)}
              </select>
              {patient && (
                <div className="hint">
                  {patient.id} · {patient.sex} · nac. {patient.dob}
                </div>
              )}
            </div>
            <div className="field">
              <label>Nº de Póliza</label>
              <select value={policyNum} onChange={e => setPolicyNum(e.target.value)}>
                {SEED.policies.map(p => <option key={p.number} value={p.number}>{p.number} · {p.plan}</option>)}
              </select>
              {policy && (
                <div className="hint">
                  vigente {policy.startDate} → {policy.endDate} · {policy.status}
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <div className="row-between" style={{marginBottom:6}}>
              <label style={{margin:0}}>Informe médico</label>
              <div className="seg">
                <button data-on={seed.format === 'TEXT'}>TEXTO</button>
                <button data-on={seed.format === 'PDF'}>PDF</button>
              </div>
            </div>
            <ReportField value={report} onChange={setReport} format={seed.format} />
          </div>
        </div>
      </div>

      <div className="row-between" style={{padding:'4px 2px'}}>
        <div className="mono-label">
          Respuesta en ≤ 20s · trazabilidad completa · cero auto-rechazo
        </div>
        <button className="btn btn-primary" onClick={onSubmit} disabled={busy} style={{minWidth: 240}}>
          {busy ? 'Procesando…' : 'Solicitar pre-autorización →'}
        </button>
      </div>
    </div>
  );
};

// ============= Hospital — Live Agent Run =============
window.HospitalLiveRun = function HospitalLiveRun({ run, onDone, onClose, stepDelay = 1.0 }) {
  const [steps, setSteps] = useState(() => AGENT_NODES.map(n => ({ node: n.id, state: 'pending', detail: '', duration: 0, tokens: 0 })));
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const traceRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    const ctx = run.ctx;
    const trace = buildScenario(run.scenario, ctx);
    traceRef.current = trace;

    async function play() {
      for (let i = 0; i < trace.length; i++) {
        if (cancelled) return;
        const t = trace[i];
        const nodeIdx = AGENT_NODES.findIndex(n => n.id === t.node);
        if (t.state === 'pending') {
          // skipped node, just mark and continue quickly
          setSteps(prev => prev.map((s, idx) => idx === nodeIdx ? { ...s, ...t, state: 'pending' } : s));
          await sleep(120);
          continue;
        }
        // running animation
        setSteps(prev => prev.map((s, idx) => idx === nodeIdx ? { ...s, state: 'running' } : s));
        // realistic-feeling delay (compressed)
        const showFor = Math.max(380, Math.min(1600, t.duration * 0.45)) * stepDelay;
        await sleep(showFor);
        if (cancelled) return;
        setSteps(prev => prev.map((s, idx) => idx === nodeIdx ? { ...s, ...t } : s));
        setProgress(((i + 1) / trace.length) * 100);
      }
      // assemble outcome
      const result = assembleOutcome(run.scenario, run.ctx, trace);
      setOutcome(result);
      setDone(true);
      onDone(result, trace);
    }
    play();
    return () => { cancelled = true; };
  }, []);

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return (
    <div className="split-2">
      <div className="stack">
        <div className="panel">
          <div className="panel-header">
            <h3>Ejecución del agente · {run.caseId}</h3>
            <span className="mono-label">trace_id {run.traceId}</span>
          </div>
          <div className="progress"><i style={{width: progress + '%'}}></i></div>
          <div className="panel-body" style={{padding:'4px 16px'}}>
            <div className="timeline">
              {steps.map((s, i) => {
                const node = AGENT_NODES[i];
                return (
                  <div key={node.id} className="timeline-step" data-state={s.state}>
                    <div className="tl-mark">
                      <div className="tl-node"><span className="num">{i+1}</span></div>
                      <div className="tl-line"></div>
                    </div>
                    <div className="tl-body">
                      <div className="tl-head">
                        <div>
                          <div className="tl-name">{node.name}</div>
                          <div style={{fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--ink-4)', marginTop:2}}>
                            {node.label}
                          </div>
                        </div>
                        <div className="tl-meta">
                          {s.state === 'running' && <span style={{color:'var(--accent-ink)'}}>● ejecutando</span>}
                          {s.state === 'done' && <span>✓ {fmtMs(s.duration)} · {s.tokens || 0} tok</span>}
                          {s.state === 'warn' && <span style={{color:'var(--warn)'}}>⚠ {fmtMs(s.duration)}</span>}
                          {s.state === 'err' && <span style={{color:'var(--err)'}}>✕ {fmtMs(s.duration)}</span>}
                          {s.state === 'pending' && <span>—</span>}
                        </div>
                      </div>
                      {(s.state === 'done' || s.state === 'warn' || s.state === 'err') && s.detail && (
                        <pre className="tl-detail">{s.detail}</pre>
                      )}
                      {s.state === 'pending' && i > 0 && steps.slice(0, i).some(x => x.state === 'err' || x.state === 'warn') && (
                        <pre className="tl-detail" style={{opacity:0.6}}>// nodo omitido — escalamiento temprano</pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {outcome && <OutcomeCard outcome={outcome} />}

        {done && (
          <div className="row-between" style={{marginTop:8}}>
            <div className="mono-label">Caso persistido en Notion · estado {terminalStatusFor(run.scenario)}</div>
            <div className="row" style={{gap:8}}>
              <button className="btn" onClick={onClose}>Volver a casos</button>
              <button className="btn btn-primary" onClick={() => location.reload()}>Nueva solicitud</button>
            </div>
          </div>
        )}
      </div>

      <div className="stack">
        <div className="panel">
          <div className="panel-header"><h3>Caso</h3></div>
          <div className="panel-body">
            <div className="kv">
              <div className="kv-row"><span className="k">Case ID</span><span className="v mono">{run.caseId}</span></div>
              <div className="kv-row"><span className="k">Trace ID</span><span className="v mono">{run.traceId}</span></div>
              <div className="kv-row"><span className="k">Paciente</span><span className="v">{run.ctx.patient.name}</span></div>
              <div className="kv-row"><span className="k">Procedimiento</span><span className="v">{run.ctx.procedure.code} · {run.ctx.procedure.name}</span></div>
              <div className="kv-row"><span className="k">Póliza</span><span className="v mono">{run.ctx.policy.number}</span></div>
              <div className="kv-row"><span className="k">Formato</span><span className="v mono">{run.ctx.format}</span></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h3>Stream de eventos SSE</h3>
            <span className="mono-label">/api/v1/cases/{run.caseId}/events</span>
          </div>
          <div className="panel-body" style={{
            fontFamily:'var(--font-mono)', fontSize:11, lineHeight:1.65,
            maxHeight:300, overflow:'auto', background:'#0E0E0C', color:'#E1DFD5', padding:14,
            margin:0
          }}>
            <SseStream steps={steps} caseId={run.caseId} />
          </div>
        </div>
      </div>
    </div>
  );
};

function SseStream({ steps, caseId }) {
  const items = [`event: case.created\ndata: { "case_id": "${caseId}", "ts": "${new Date().toISOString()}" }`];
  steps.forEach((s, i) => {
    if (s.state === 'pending') return;
    const node = AGENT_NODES[i];
    if (s.state === 'running') items.push(`event: node.start\ndata: { "node": "${node.name}", "model": "${node.model}" }`);
    else if (s.state === 'done') items.push(`event: node.complete\ndata: { "node": "${node.name}", "duration_ms": ${s.duration}, "tokens": ${s.tokens||0} }`);
    else if (s.state === 'warn') items.push(`event: node.warn\ndata: { "node": "${node.name}", "duration_ms": ${s.duration} }`);
    else if (s.state === 'err') items.push(`event: node.error\ndata: { "node": "${node.name}", "reason": "extraction_quality_below_threshold" }`);
  });
  return (
    <pre style={{margin:0, whiteSpace:'pre-wrap', color:'inherit', fontFamily:'inherit'}}>
      {items.map((it, i) => (
        <span key={i} style={{display:'block', borderBottom:'1px solid #2A2925', padding:'6px 0'}}>
          {it.split('\n').map((line, j) => (
            <div key={j} style={{color: line.startsWith('event:') ? '#9C998F' : '#E1DFD5'}}>{line}</div>
          ))}
        </span>
      ))}
    </pre>
  );
}

function assembleOutcome(scenario, ctx, trace) {
  const totalDur = trace.reduce((a, t) => a + (t.duration || 0), 0);
  const totalTok = trace.reduce((a, t) => a + (t.tokens || 0), 0);
  // DeepSeek pricing (~$0.00052 / 1K tokens efectivos)
  const cost = (totalTok / 1000) * (DEEPSEEK_USD_PER_1K_TOKENS || 0.00052);
  const decision = decisionFor(scenario, ctx);

  const titleByOutcome = {
    APPROVED_AUTO: 'Pre-aprobación automática emitida',
    DOCS_REQUESTED: 'Documentación incompleta',
    ESCALATED: 'Escalado a auditor médico',
  };

  return {
    scenario,
    totalDur,
    totalTok,
    cost: cost.toFixed(4),
    ctx,
    outcome: decision.outcome,
    confidence: decision.confidence,
    rationale: decision.rationale,
    evidence: decision.evidence,
    missing: decision.missing_docs && decision.missing_docs.length ? decision.missing_docs : null,
    reason: decision.escalation_reason,
    title: titleByOutcome[decision.outcome] || 'Decisión emitida',
  };
}

window.OutcomeCard = function OutcomeCard({ outcome }) {
  const tone = outcome.outcome === 'APPROVED_AUTO' ? 'ok'
             : outcome.outcome === 'DOCS_REQUESTED' ? 'warn' : 'err';
  return (
    <div className="outcome" data-outcome={outcome.outcome}>
      <div className="outcome-bar"></div>
      <div className="outcome-body">
        <div className="row" style={{gap:10, marginBottom:6}}>
          <div className="outcome-tag">{outcome.outcome}{outcome.reason ? ` · ${outcome.reason}` : ''}</div>
          <Pill tone={tone}>
            {outcome.outcome === 'APPROVED_AUTO' ? 'AUTO'
             : outcome.outcome === 'DOCS_REQUESTED' ? 'DOCS'
             : 'HUMANO'}
          </Pill>
        </div>
        <h2>{outcome.title}</h2>

        {/* Rationale + confidence: contenido primario per PRD §3.1.3 */}
        <div className="rationale-block">
          <div className="mono-label" style={{marginBottom:6}}>Razonamiento del agente</div>
          <div className="rationale">{outcome.rationale}</div>
          <div className="row" style={{gap:14, marginTop:10, alignItems:'center'}}>
            <div style={{minWidth: 140}}>
              <Confidence value={outcome.confidence} />
            </div>
            <div className="mono-label" style={{color:'var(--ink-3)'}}>
              umbral mínimo 80% · {outcome.confidence >= 0.80 ? 'cumplido' : 'no cumplido → ESCALADO'}
            </div>
          </div>
        </div>

        {/* Evidencia citada */}
        {outcome.evidence && outcome.evidence.length > 0 && (
          <div style={{marginTop:14}}>
            <div className="mono-label" style={{marginBottom:6}}>Evidencia citada</div>
            <div className="evidence-list">
              {outcome.evidence.map((e, i) => (
                <div className="evidence-item" key={i}>
                  <Pill tone={e.source === 'report' ? 'info' : 'ink'} noDot>
                    {e.source === 'report' ? 'INFORME' : 'PÓLIZA'}
                  </Pill>
                  <div className="evidence-body">
                    <div className="evidence-field">{e.field}</div>
                    <div className="evidence-quote">"{e.quote}"</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing docs */}
        {outcome.missing && outcome.missing.length > 0 && (
          <div style={{marginTop:14}}>
            <div className="mono-label" style={{marginBottom:6}}>Documentos requeridos</div>
            <div className="doc-list">
              {outcome.ctx.coverage.required.map(doc => {
                const missing = outcome.missing.includes(doc);
                return (
                  <div className="doc-item" data-missing={missing} key={doc}>
                    <span className="check">{missing ? '✕' : '✓'}</span>
                    <span>{doc}</span>
                    <span className="mono-label">{missing ? 'FALTA' : 'OK'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Meta strip — secundario */}
        <div className="meta-strip">
          <div><span className="k">Latencia</span><span className="v">{(outcome.totalDur/1000).toFixed(1)}s</span></div>
          <div><span className="k">Tokens</span><span className="v">{outcome.totalTok.toLocaleString()}</span></div>
          <div><span className="k">Costo</span><span className="v">${outcome.cost}</span></div>
          <div><span className="k">Modelo</span><span className="v">deepseek-chat</span></div>
        </div>
      </div>
    </div>
  );
};
