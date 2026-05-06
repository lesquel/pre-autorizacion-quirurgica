/* global React, SEED, AGENT_NODES, buildScenario, decisionFor, daysBetween, fmtMs */
const { useState, useMemo } = React;

// ============= Auditor — Tray =============
window.AuditorTray = function AuditorTray({ cases, openCase, mode = 'escalated' }) {
  const list = useMemo(() => {
    const filtered = mode === 'escalated'
      ? cases.filter(c => c.outcome === 'ESCALATED' && c.status === 'ESCALADO')
      : cases.filter(c => c.status === 'DECIDIDO' && c.resolvedBy);
    return filtered;
  }, [cases, mode]);

  const reasonsCount = useMemo(() => {
    const counts = {};
    cases.filter(c => c.escalationReason).forEach(c => { counts[c.escalationReason] = (counts[c.escalationReason]||0)+1; });
    return counts;
  }, [cases]);

  return (
    <div className="col-pad" style={{display:'grid', gap:20}}>
      {mode === 'escalated' && (
        <div className="metric-grid">
          <div className="metric"><div className="label">En bandeja</div><div className="val">{list.length}</div><div className="delta">esperando revisión</div></div>
          <div className="metric"><div className="label">Carencia</div><div className="val">{reasonsCount['WAITING_PERIOD_NOT_MET']||0}</div><div className="delta">WAITING_PERIOD_NOT_MET</div></div>
          <div className="metric"><div className="label">Baja confianza</div><div className="val">{reasonsCount['LOW_CONFIDENCE_PROCEDURE_MATCH']||0}</div><div className="delta">match &lt; 0.85</div></div>
          <div className="metric"><div className="label">Falla extracción</div><div className="val">{reasonsCount['PDF_EXTRACTION_FAILURE']||0}</div><div className="delta">PDF / vision</div></div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h3>{mode === 'escalated' ? 'Casos escalados a auditoría' : 'Casos resueltos'}</h3>
          <div className="row" style={{gap:6}}>
            <div className="seg">
              <button data-on="true">Todos</button>
              <button data-on="false">Carencia</button>
              <button data-on="false">Baja conf.</button>
              <button data-on="false">PDF</button>
            </div>
          </div>
        </div>
        {list.length === 0 ? (
          <div className="empty">Sin casos en esta bandeja</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Recibido</th>
                <th>Paciente</th>
                <th>Procedimiento</th>
                <th>Motivo</th>
                <th>Confianza</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map(c => {
                const p = findPatient(c.patientId);
                const pr = findProc(c.procedureCode);
                return (
                  <tr key={c.id} data-clickable onClick={() => openCase(c)}>
                    <td className="mono">{c.id}</td>
                    <td className="mono" style={{color:'var(--ink-3)'}}>{timeAgo(c.createdAt)}</td>
                    <td>{p?.name}</td>
                    <td>
                      <div className="mono" style={{fontSize:11, color:'var(--ink-4)'}}>{c.procedureCode}</div>
                      <div>{pr ? pr.name : '— sin match'}</div>
                    </td>
                    <td><Pill tone="err" noDot>{c.escalationReason || '—'}</Pill></td>
                    <td><Confidence value={c.confidence}/></td>
                    <td><OutcomePill outcome={c.outcome} status={c.status}/></td>
                    <td><button className="btn btn-sm btn-primary">Revisar →</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ============= Auditor — Case detail + resolve =============
window.AuditorCaseDetail = function AuditorCaseDetail({ caseRec, onBack, onResolve }) {
  const [tab, setTab] = useState('decision');
  const [resolution, setResolution] = useState('APPROVED');
  const [reasoning, setReasoning] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);

  const patient = findPatient(caseRec.patientId);
  const policy = findPolicy(caseRec.policyNumber);
  const proc = findProc(caseRec.procedureCode);
  const coverage = findCoverage(caseRec.policyNumber, caseRec.procedureCode);
  const seedCase = Object.values(SEED.demoCases).find(d => d.policyNumber === caseRec.policyNumber && d.procedureCode === caseRec.procedureCode);

  // reconstruct trace from scenario
  const scenarioKey = useMemo(() => {
    if (caseRec.escalationReason === 'WAITING_PERIOD_NOT_MET') return 'ESCALATED_WAITING';
    if (caseRec.escalationReason === 'LOW_CONFIDENCE_PROCEDURE_MATCH') return 'ESCALATED_LOW_CONF';
    if (caseRec.escalationReason === 'PDF_EXTRACTION_FAILURE') return 'ESCALATED_PDF_FAIL';
    return null;
  }, [caseRec]);
  const ctx = useMemo(() => ({
    patient, policy, procedure: proc || { code: '?', name: '— sin match' },
    coverage: coverage || { covered:true, waitingDays:0, copay:0, required:[] },
    attachedDocs: seedCase?.attachedDocs || [],
    format: seedCase?.format || 'TEXT',
    caseId: caseRec.id,
  }), [caseRec.id, scenarioKey]);
  const trace = useMemo(() => {
    if (!scenarioKey) return [];
    return buildScenario(scenarioKey, ctx);
  }, [caseRec.id, scenarioKey]);
  const decision = useMemo(() => {
    if (!scenarioKey) return null;
    return decisionFor(scenarioKey, ctx);
  }, [caseRec.id, scenarioKey]);

  function submit() {
    onResolve(caseRec.id, { outcome: resolution, reasoning, resolvedBy: 'Dra. C. Reinoso · MP 9182' });
  }

  return (
    <div className="col-pad" style={{display:'grid', gap:16}}>
      <div className="row-between">
        <div>
          <div className="breadcrumbs" style={{fontFamily:'var(--font-mono)', fontSize:10.5, letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--ink-4)'}}>
            <span>Bandeja</span> <span style={{margin:'0 8px', color:'var(--ink-5)'}}>/</span> <span>{caseRec.id}</span>
          </div>
          <h1 style={{fontFamily:'var(--font-serif)', fontWeight:400, margin:'4px 0 0', fontSize:22}}>
            {patient?.name} · {proc ? proc.name : 'procedimiento sin match'}
          </h1>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn" onClick={onBack}>← Volver a bandeja</button>
          <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>Resolver caso</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1.3fr) minmax(0, 0.7fr)', gap:20}}>
        <div className="stack">
          <div className="panel">
            <div className="panel-header" style={{padding:0}}>
              <div className="seg" style={{margin:6, border:0}}>
                <button data-on={tab==='decision'} onClick={() => setTab('decision')}>Decisión del agente</button>
                <button data-on={tab==='trace'} onClick={() => setTab('trace')}>Trace</button>
                <button data-on={tab==='report'} onClick={() => setTab('report')}>Informe</button>
                <button data-on={tab==='policy'} onClick={() => setTab('policy')}>Póliza & cobertura</button>
              </div>
              <span className="mono-label" style={{padding:'0 16px'}}>trace_id 01HZ-{caseRec.id.slice(-6)}</span>
            </div>
            <div className="panel-body">
              {tab === 'decision' && decision && (
                <div style={{display:'grid', gap:16}}>
                  <div className="rationale-block" style={{margin:0}}>
                    <div className="row-between" style={{marginBottom:8}}>
                      <div className="mono-label">Razonamiento del agente</div>
                      <Pill tone="ink" noDot>{decision.outcome}</Pill>
                    </div>
                    <div className="rationale">{decision.rationale}</div>
                    <div className="row" style={{gap:14, marginTop:12, alignItems:'center'}}>
                      <div style={{minWidth:140}}>
                        <Confidence value={decision.confidence} />
                      </div>
                      <div className="mono-label" style={{color:'var(--ink-3)'}}>
                        umbral 80% · {decision.confidence >= 0.80 ? 'cumplido' : 'no cumplido → ESCALADO'}
                      </div>
                    </div>
                  </div>

                  {decision.evidence && decision.evidence.length > 0 && (
                    <div>
                      <div className="mono-label" style={{marginBottom:6}}>Evidencia citada · {decision.evidence.length}</div>
                      <div className="evidence-list">
                        {decision.evidence.map((e, i) => (
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

                  {decision.missing_docs && decision.missing_docs.length > 0 && (
                    <div>
                      <div className="mono-label" style={{marginBottom:6}}>Documentos faltantes</div>
                      <div className="doc-list">
                        {decision.missing_docs.map(d => (
                          <div className="doc-item" data-missing="true" key={d}>
                            <span className="check">✕</span>
                            <span>{d}</span>
                            <span className="mono-label">FALTA</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'trace' && (
                <div className="timeline">
                  {AGENT_NODES.map((node, i) => {
                    const t = trace[i];
                    const state = t?.state || 'pending';
                    return (
                      <div key={node.id} className="timeline-step" data-state={state}>
                        <div className="tl-mark">
                          <div className="tl-node"><span className="num">{i+1}</span></div>
                          <div className="tl-line"></div>
                        </div>
                        <div className="tl-body">
                          <div className="tl-head">
                            <div>
                              <div className="tl-name">{node.name}</div>
                              <div style={{fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--ink-4)', marginTop:2}}>{node.label}</div>
                            </div>
                            <div className="tl-meta">
                              {state === 'done' && <span>✓ {fmtMs(t.duration)} · {t.tokens||0} tok</span>}
                              {state === 'warn' && <span style={{color:'var(--warn)'}}>⚠ {fmtMs(t.duration)}</span>}
                              {state === 'err' && <span style={{color:'var(--err)'}}>✕ {fmtMs(t.duration)}</span>}
                              {state === 'pending' && <span>—</span>}
                            </div>
                          </div>
                          {t?.detail && state !== 'pending' && <pre className="tl-detail">{t.detail}</pre>}
                          {state === 'pending' && <pre className="tl-detail" style={{opacity:0.6}}>// nodo omitido</pre>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {tab === 'report' && (
                <pre style={{
                  fontFamily:'var(--font-mono)', fontSize:12, lineHeight:1.65, margin:0,
                  background:'var(--bg-2)', padding:14, border:'1px solid var(--line)', whiteSpace:'pre-wrap'
                }}>{seedCase?.report || 'Informe no disponible'}</pre>
              )}
              {tab === 'policy' && (
                <div style={{display:'grid', gap:16}}>
                  <div className="kv">
                    <div className="kv-row"><span className="k">Póliza</span><span className="v mono">{policy?.number}</span></div>
                    <div className="kv-row"><span className="k">Plan</span><span className="v">{policy?.plan}</span></div>
                    <div className="kv-row"><span className="k">Vigencia</span><span className="v mono">{policy?.startDate} → {policy?.endDate}</span></div>
                    <div className="kv-row"><span className="k">Días desde inicio</span><span className="v mono">{policy && daysBetween(policy.startDate, '2026-05-06')}d</span></div>
                  </div>
                  {coverage && (
                    <div className="kv">
                      <div className="kv-row"><span className="k">Cobertura</span><span className="v">{coverage.covered ? <Pill tone="ok" noDot>CUBIERTO</Pill> : <Pill tone="err" noDot>NO CUBIERTO</Pill>}</span></div>
                      <div className="kv-row"><span className="k">Días carencia</span><span className="v mono">{coverage.waitingDays}d</span></div>
                      <div className="kv-row"><span className="k">Copago</span><span className="v mono">${coverage.copay}</span></div>
                      <div className="kv-row"><span className="k">Docs requeridos</span><span className="v">
                        <div className="badge-group">
                          {coverage.required.map(d => <span key={d} className="pill no-dot" style={{fontSize:10}}>{d}</span>)}
                        </div>
                      </span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel" style={{borderColor:'var(--err)'}}>
            <div className="panel-header" style={{background:'var(--err-bg)'}}>
              <h3 style={{color:'var(--err)'}}>Motivo de escalamiento</h3>
              <Pill tone="err" noDot>{caseRec.escalationReason}</Pill>
            </div>
            <div className="panel-body">
              <div style={{fontSize:13, color:'var(--ink-2)'}}>
                {caseRec.escalationReason === 'WAITING_PERIOD_NOT_MET' && 'La carencia de la cobertura no se cumple en la fecha de solicitud. El agente no rechaza de oficio: requiere juicio del auditor sobre si aplica excepción clínica.'}
                {caseRec.escalationReason === 'LOW_CONFIDENCE_PROCEDURE_MATCH' && 'El informe describe un cuadro ambiguo y ningún candidato del catálogo CIE-10 supera el umbral de match (0.85). Requiere clasificación clínica humana.'}
                {caseRec.escalationReason === 'PDF_EXTRACTION_FAILURE' && 'La calidad de extracción del PDF escaneado quedó por debajo del umbral mínimo (0.70). Requiere lectura humana del documento original.'}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>Identificación</h3></div>
            <div className="panel-body">
              <div className="kv">
                <div className="kv-row"><span className="k">Case ID</span><span className="v mono">{caseRec.id}</span></div>
                <div className="kv-row"><span className="k">Creado</span><span className="v mono">{formatTs(caseRec.createdAt)}</span></div>
                <div className="kv-row"><span className="k">Paciente</span><span className="v">{patient?.name}</span></div>
                <div className="kv-row"><span className="k">DNI</span><span className="v mono">{patient?.dni}</span></div>
                <div className="kv-row"><span className="k">Confianza</span><span className="v"><Confidence value={caseRec.confidence}/></span></div>
                <div className="kv-row"><span className="k">Latencia</span><span className="v mono">{(caseRec.durationMs/1000).toFixed(2)}s</span></div>
                <div className="kv-row"><span className="k">Tokens</span><span className="v mono">{caseRec.tokens.toLocaleString()}</span></div>
                <div className="kv-row"><span className="k">Costo</span><span className="v mono">${caseRec.costUsd.toFixed(3)}</span></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>Trazabilidad</h3></div>
            <div className="panel-body" style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.65}}>
              <div>• Caso persistido en Notion: <code>CasosAutorización / {caseRec.id}</code></div>
              <div>• Logs estructurados con <code>trace_id</code> correlacionable</div>
              <div>• La resolución del auditor queda en el record permanente del caso</div>
            </div>
          </div>
        </div>
      </div>

      {showSubmit && (
        <div className="modal-bg" onClick={() => setShowSubmit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header>
              <h2>Resolver caso {caseRec.id}</h2>
              <button className="btn btn-ghost" onClick={() => setShowSubmit(false)}>Cerrar</button>
            </header>
            <div className="body" style={{display:'grid', gap:14}}>
              <div className="field">
                <label>Decisión</label>
                <div className="seg" style={{alignSelf:'start'}}>
                  <button data-on={resolution==='APPROVED'} onClick={() => setResolution('APPROVED')}>Aprobar</button>
                  <button data-on={resolution==='REJECTED'} onClick={() => setResolution('REJECTED')}>Rechazar</button>
                </div>
              </div>
              <div className="field">
                <label>Justificación clínica</label>
                <textarea rows="6" value={reasoning} onChange={e => setReasoning(e.target.value)}
                          placeholder="Detalle clínico-administrativo de la decisión. Esto queda en el record permanente y será visible para Hospital y Aseguradora."></textarea>
              </div>
              <div className="note">
                Auditor: <b>Dra. C. Reinoso</b> · MP 9182 · {new Date().toLocaleString('es')}
              </div>
              <div className="row-between">
                <button className="btn" onClick={() => setShowSubmit(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={submit} disabled={!reasoning.trim()}>
                  Confirmar {resolution === 'APPROVED' ? 'aprobación' : 'rechazo'} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
