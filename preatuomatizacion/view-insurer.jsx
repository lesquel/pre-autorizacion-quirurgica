/* global React, SEED, INITIAL_CASES */
const { useState, useMemo } = React;

// ============= Hospital — Cases list =============
window.HospitalCases = function HospitalCases({ cases, openCase }) {
  return (
    <div className="col-pad">
      <div className="metric-grid" style={{marginBottom:20}}>
        <div className="metric"><div className="label">Total hoy</div><div className="val">{cases.length}</div></div>
        <div className="metric"><div className="label">Aprobados auto</div><div className="val">{cases.filter(c => c.outcome==='APPROVED_AUTO').length}</div></div>
        <div className="metric"><div className="label">Pendientes docs</div><div className="val">{cases.filter(c => c.outcome==='DOCS_REQUESTED').length}</div></div>
        <div className="metric"><div className="label">Escalados</div><div className="val">{cases.filter(c => c.outcome==='ESCALATED').length}</div></div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h3>Mis casos</h3>
          <span className="mono-label">orden: más recientes primero</span>
        </div>
        <CasesTable cases={cases} openCase={openCase} />
      </div>
    </div>
  );
};

window.CasesTable = function CasesTable({ cases, openCase, hideStatus }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Case ID</th>
          <th>Creado</th>
          <th>Paciente</th>
          <th>Procedimiento</th>
          <th>Póliza</th>
          <th>Outcome</th>
          <th>Confianza</th>
          <th className="num">Latencia</th>
          <th className="num">Costo</th>
        </tr>
      </thead>
      <tbody>
        {cases.map(c => {
          const p = findPatient(c.patientId);
          const pr = findProc(c.procedureCode);
          return (
            <tr key={c.id} data-clickable onClick={() => openCase && openCase(c)}>
              <td className="mono">{c.id}</td>
              <td className="mono" style={{color:'var(--ink-3)'}}>{formatTs(c.createdAt)}</td>
              <td>{p ? p.name : '—'}</td>
              <td>
                <div className="mono" style={{fontSize:11, color:'var(--ink-4)'}}>{c.procedureCode}</div>
                <div>{pr ? pr.name : 'sin match'}</div>
              </td>
              <td className="mono">{c.policyNumber}</td>
              <td><OutcomePill outcome={c.outcome} status={c.status}/></td>
              <td><Confidence value={c.confidence} /></td>
              <td className="num">{(c.durationMs/1000).toFixed(1)}s</td>
              <td className="num">${c.costUsd.toFixed(3)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ============= Hospital — Procedures catalog =============
window.HospitalProcedures = function HospitalProcedures() {
  return (
    <div className="col-pad">
      <div className="panel">
        <div className="panel-header">
          <h3>Catálogo de procedimientos</h3>
          <span className="mono-label">CIE-10 · {SEED.procedures.length} ítems</span>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Código</th><th>Procedimiento</th><th>Categoría</th><th className="num">Carencia típica</th></tr>
          </thead>
          <tbody>
            {SEED.procedures.map(p => (
              <tr key={p.code}>
                <td className="mono">{p.code}</td>
                <td>{p.name}</td>
                <td><Pill noDot>{p.category}</Pill></td>
                <td className="num">{p.waitingDaysTypical}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============= Insurer — Dashboard =============
window.InsurerDashboard = function InsurerDashboard({ cases }) {
  const total = cases.length;
  const auto = cases.filter(c => c.outcome === 'APPROVED_AUTO').length;
  const docs = cases.filter(c => c.outcome === 'DOCS_REQUESTED').length;
  const esc = cases.filter(c => c.outcome === 'ESCALATED').length;
  const autoRate = ((auto / total) * 100).toFixed(0);
  const totalCost = cases.reduce((a, c) => a + c.costUsd, 0);
  const avgLat = cases.reduce((a, c) => a + c.durationMs, 0) / total / 1000;

  // confidence distribution (20 bins)
  const bins = new Array(20).fill(0);
  cases.forEach(c => { const i = Math.min(19, Math.floor(c.confidence * 20)); bins[i]++; });
  const maxBin = Math.max(...bins, 1);

  return (
    <div className="col-pad" style={{display:'grid', gap:20}}>
      <div className="metric-grid">
        <div className="metric">
          <div className="label">Tasa auto-resolución</div>
          <div className="val">{autoRate}<span className="unit">%</span></div>
          <div className="delta up">▲ 4 pts vs ayer · objetivo ≥60%</div>
        </div>
        <div className="metric">
          <div className="label">Latencia promedio</div>
          <div className="val">{avgLat.toFixed(1)}<span className="unit">s</span></div>
          <div className="delta">p95 8.2s · obj ≤10s</div>
        </div>
        <div className="metric">
          <div className="label">Costo por caso</div>
          <div className="val">${(totalCost/total).toFixed(4)}</div>
          <div className="delta up">obj ≤$0.02 · DeepSeek</div>
        </div>
        <div className="metric">
          <div className="label">Casos hoy</div>
          <div className="val">{total}</div>
          <div className="delta">{esc} en bandeja del auditor</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20}}>
        <div className="panel">
          <div className="panel-header"><h3>Distribución de outcomes</h3><span className="mono-label">últimos 7 días</span></div>
          <div className="panel-body">
            <div className="bars">
              <div className="bar-row" data-tone="ok">
                <span className="lbl">APPROVED_AUTO</span>
                <div className="bar"><i style={{width: (auto/total*100) + '%'}}></i></div>
                <span className="num">{auto}</span>
              </div>
              <div className="bar-row" data-tone="warn">
                <span className="lbl">DOCS_REQUESTED</span>
                <div className="bar"><i style={{width: (docs/total*100) + '%'}}></i></div>
                <span className="num">{docs}</span>
              </div>
              <div className="bar-row" data-tone="err">
                <span className="lbl">ESCALATED</span>
                <div className="bar"><i style={{width: (esc/total*100) + '%'}}></i></div>
                <span className="num">{esc}</span>
              </div>
            </div>

            <div className="divider"><div className="line"></div><div className="cap">Motivos de escalamiento</div><div className="line"></div></div>
            <div className="bars">
              {['WAITING_PERIOD_NOT_MET','LOW_CONFIDENCE_PROCEDURE_MATCH','PDF_EXTRACTION_FAILURE'].map(r => {
                const n = cases.filter(c => c.escalationReason === r).length;
                return (
                  <div className="bar-row" key={r}>
                    <span className="lbl" style={{fontSize:10.5}}>{r}</span>
                    <div className="bar"><i style={{width: (n/Math.max(esc,1)*100) + '%', background:'var(--ink-2)'}}></i></div>
                    <span className="num">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h3>Distribución de confianza</h3><span className="mono-label">20 bins · 0–100%</span></div>
          <div className="panel-body">
            <div className="spark">
              {bins.map((n, i) => {
                // 20 bins · umbral 80% = bin 16 (PRD §3.1.3)
                const cls = i < 13 ? 'lo' : i < 16 ? 'mid' : 'hi';
                return <i key={i} className={cls} style={{height: ((n/maxBin)*100) + '%' }}></i>;
              })}
            </div>
            <div className="row-between" style={{marginTop:8}}>
              <span className="mono-label">0%</span>
              <span className="mono-label">umbral 80%</span>
              <span className="mono-label">100%</span>
            </div>
            <div className="note" style={{marginTop:14}}>
              Casos con confianza &lt; 80% se escalan automáticamente. Distribución estable en últimas 7 corridas — sin drift.
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><h3>Casos recientes</h3><span className="mono-label">tiempo real · SSE</span></div>
        <CasesTable cases={cases.slice(0, 8)} openCase={null} />
      </div>
    </div>
  );
};

// ============= Insurer — Policies CRUD =============
window.InsurerPolicies = function InsurerPolicies() {
  const [selected, setSelected] = useState(SEED.policies[0].number);
  const policy = findPolicy(selected);
  const patient = findPatient(policy.patientId);
  const coverages = SEED.coverages.filter(c => c.policy === selected);

  return (
    <div className="col-pad" style={{display:'grid', gridTemplateColumns:'320px 1fr', gap:20, alignItems:'start'}}>
      <div className="panel">
        <div className="panel-header">
          <h3>Pólizas</h3>
          <button className="btn btn-sm">+ Nueva</button>
        </div>
        <div style={{maxHeight:560, overflow:'auto'}}>
          {SEED.policies.map(p => {
            const pat = findPatient(p.patientId);
            return (
              <div key={p.number}
                   onClick={() => setSelected(p.number)}
                   style={{
                     padding:'12px 14px', borderBottom:'1px solid var(--line)', cursor:'pointer',
                     background: selected === p.number ? 'var(--bg-2)' : 'transparent',
                     borderLeft: selected === p.number ? '2px solid var(--accent)' : '2px solid transparent',
                   }}>
                <div className="row-between">
                  <span className="mono" style={{fontSize:12}}>{p.number}</span>
                  <Pill tone="ok" noDot>{p.status}</Pill>
                </div>
                <div style={{fontSize:12.5, marginTop:4}}>{pat?.name}</div>
                <div className="mono-label" style={{marginTop:3}}>{p.plan}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stack">
        <div className="panel">
          <div className="panel-header">
            <h3>Detalle de la póliza</h3>
            <div className="row" style={{gap:6}}>
              <button className="btn btn-sm">Editar</button>
              <button className="btn btn-sm">Cancelar póliza</button>
            </div>
          </div>
          <div className="panel-body" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div className="kv">
              <div className="kv-row"><span className="k">Número</span><span className="v mono">{policy.number}</span></div>
              <div className="kv-row"><span className="k">Plan</span><span className="v">{policy.plan}</span></div>
              <div className="kv-row"><span className="k">Aseguradora</span><span className="v">{policy.insurer}</span></div>
              <div className="kv-row"><span className="k">Estado</span><span className="v"><Pill tone="ok" noDot>{policy.status}</Pill></span></div>
            </div>
            <div className="kv">
              <div className="kv-row"><span className="k">Paciente</span><span className="v">{patient.name}</span></div>
              <div className="kv-row"><span className="k">DNI</span><span className="v mono">{patient.dni}</span></div>
              <div className="kv-row"><span className="k">Inicio</span><span className="v mono">{policy.startDate}</span></div>
              <div className="kv-row"><span className="k">Vencimiento</span><span className="v mono">{policy.endDate}</span></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Coberturas</h3>
            <div className="row" style={{gap:6}}>
              <span className="mono-label">{coverages.length} procedimiento(s)</span>
              <button className="btn btn-sm">+ Agregar</button>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>CIE-10</th>
                <th>Procedimiento</th>
                <th>Cubierto</th>
                <th className="num">Carencia</th>
                <th className="num">Copago</th>
                <th>Docs requeridos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coverages.map(c => {
                const pr = findProc(c.procedure);
                return (
                  <tr key={c.procedure}>
                    <td className="mono">{c.procedure}</td>
                    <td>{pr.name}</td>
                    <td>{c.covered ? <Pill tone="ok" noDot>SÍ</Pill> : <Pill tone="err" noDot>NO</Pill>}</td>
                    <td className="num mono">{c.waitingDays}d</td>
                    <td className="num mono">${c.copay}</td>
                    <td>
                      <div className="badge-group">
                        {c.required.map(d => <span key={d} className="pill no-dot" style={{fontSize:9.5, padding:'2px 6px'}}>{d}</span>)}
                      </div>
                    </td>
                    <td><button className="btn btn-sm btn-ghost">Editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============= Insurer — Coverages overview =============
window.InsurerCoverages = function InsurerCoverages() {
  return (
    <div className="col-pad">
      <div className="panel">
        <div className="panel-header"><h3>Matriz de coberturas</h3><span className="mono-label">{SEED.coverages.length} filas</span></div>
        <table className="tbl">
          <thead><tr>
            <th>Póliza</th><th>Procedimiento</th><th>CIE-10</th>
            <th className="num">Carencia</th><th className="num">Copago</th><th className="num">Docs</th>
          </tr></thead>
          <tbody>
            {SEED.coverages.map((c, i) => {
              const pr = findProc(c.procedure);
              return (
                <tr key={i}>
                  <td className="mono">{c.policy}</td>
                  <td>{pr.name}</td>
                  <td className="mono">{c.procedure}</td>
                  <td className="num mono">{c.waitingDays}d</td>
                  <td className="num mono">${c.copay}</td>
                  <td className="num mono">{c.required.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============= Insurer — Cases =============
window.InsurerCases = function InsurerCases({ cases, openCase }) {
  return (
    <div className="col-pad">
      <div className="panel">
        <div className="panel-header"><h3>Todos los casos</h3><span className="mono-label">{cases.length} totales</span></div>
        <CasesTable cases={cases} openCase={openCase} />
      </div>
    </div>
  );
};
