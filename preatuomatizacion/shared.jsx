/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// ============= Shared atoms =============

window.Pill = function Pill({ tone = 'default', children, noDot }) {
  return (
    <span className={"pill" + (noDot ? " no-dot" : "")} data-tone={tone}>{children}</span>
  );
};

window.OutcomePill = function OutcomePill({ outcome, status }) {
  if (outcome === 'APPROVED_AUTO') return <Pill tone="ok">APROBADO_AUTO</Pill>;
  if (outcome === 'DOCS_REQUESTED') return <Pill tone="warn">DOCS_PEDIDOS</Pill>;
  if (outcome === 'ESCALATED' && status === 'DECIDIDO') return <Pill tone="info">RESUELTO_AUDITOR</Pill>;
  if (outcome === 'ESCALATED') return <Pill tone="err">ESCALADO</Pill>;
  return <Pill>PENDIENTE</Pill>;
};

window.formatTs = function formatTs(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
};

window.timeAgo = function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

// Threshold alineado al PRD §3.1.3: confidence < 0.80 fuerza ESCALATED.
window.confidenceTone = function confidenceTone(c) {
  if (c >= 0.80) return 'ok';
  if (c >= 0.65) return 'warn';
  return 'err';
};

// Find helpers
window.findPatient = (id) => SEED.patients.find(p => p.id === id);
window.findPolicy = (n) => SEED.policies.find(p => p.number === n);
window.findProc = (c) => SEED.procedures.find(p => p.code === c);
window.findCoverage = (polNum, procCode) => SEED.coverages.find(c => c.policy === polNum && c.procedure === procCode);

// ============= Topbar =============
window.TopBar = function TopBar({ role, setRole, caseCount }) {
  const roles = [
    { id: 'hospital', label: 'Hospital', user: 'dr.salgado@hosp-met.ec' },
    { id: 'insurer',  label: 'Aseguradora', user: 'ops@andina.ec' },
    { id: 'auditor',  label: 'Auditor', user: 'auditoria@andina.ec' },
  ];
  const current = roles.find(r => r.id === role);
  return (
    <header className="appbar">
      <div className="brand">
        <div className="brand-mark"></div>
        <div>
          PRE-AUTORIZACIÓN QUIRÚRGICA
          <div className="b-meta" style={{display:'inline-block', marginTop:0}}>v1.1 · MVP demo</div>
        </div>
      </div>

      <div style={{display:'flex', justifyContent:'center'}}>
        <div className="role-switcher" role="tablist">
          {roles.map(r => (
            <button key={r.id} data-active={role === r.id} onClick={() => setRole(r.id)}>
              <span className="role-dot"></span>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="session">
        <span className="live">SSE conectado</span>
        <span className="sep"></span>
        <span>{caseCount} casos hoy</span>
        <span className="sep"></span>
        <span>{current.user}</span>
      </div>
    </header>
  );
};

// ============= Page header =============
window.PageHeader = function PageHeader({ crumbs = [], title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <div className="breadcrumbs">{crumbs.map((c, i) => <span key={i}>{c}</span>)}</div>
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {children && <div className="header-actions">{children}</div>}
    </div>
  );
};

// ============= Sidebar =============
window.SideNav = function SideNav({ role, view, setView, counts }) {
  const config = {
    hospital: {
      'Casos': [
        { id: 'submit', label: 'Nueva solicitud', count: null },
        { id: 'cases',  label: 'Mis casos',       count: counts.hospital.total },
      ],
      'Catálogo': [
        { id: 'procedures', label: 'Procedimientos', count: SEED.procedures.length },
      ],
    },
    insurer: {
      'Operación': [
        { id: 'dashboard', label: 'Dashboard',     count: null },
        { id: 'cases',     label: 'Casos',         count: counts.insurer.total },
      ],
      'Configuración': [
        { id: 'policies',   label: 'Pólizas',      count: SEED.policies.length },
        { id: 'coverages',  label: 'Coberturas',   count: SEED.coverages.length },
      ],
    },
    auditor: {
      'Bandeja': [
        { id: 'tray',     label: 'Casos escalados', count: counts.auditor.escalated },
        { id: 'resolved', label: 'Resueltos',       count: counts.auditor.resolved },
      ],
    },
  };
  const groups = config[role];
  return (
    <aside className="sidebar">
      {Object.entries(groups).map(([groupName, items]) => (
        <div className="group" key={groupName}>
          <div className="group-label">{groupName}</div>
          {items.map(it => (
            <div
              key={it.id}
              className="nav-item"
              data-active={view === it.id}
              onClick={() => setView(it.id)}
            >
              <span>{it.label}</span>
              {it.count != null && <span className="count">{it.count}</span>}
            </div>
          ))}
        </div>
      ))}

      <div className="group">
        <div className="group-label">Sistema</div>
        <div className="nav-item" style={{cursor:'default'}}>
          <span style={{color:'var(--ink-3)'}}>Notion API</span>
          <span className="count" style={{color:'var(--ok)'}}>● online</span>
        </div>
        <div className="nav-item" style={{cursor:'default'}}>
          <span style={{color:'var(--ink-3)'}}>DeepSeek API</span>
          <span className="count" style={{color:'var(--ok)'}}>● online</span>
        </div>
        <div className="nav-item" style={{cursor:'default'}}>
          <span style={{color:'var(--ink-3)'}}>Vision (Gemini)</span>
          <span className="count" style={{color:'var(--ok)'}}>● online</span>
        </div>
        <div className="nav-item" style={{cursor:'default'}}>
          <span style={{color:'var(--ink-3)'}}>p95 latencia</span>
          <span className="count">8.2s</span>
        </div>
      </div>
    </aside>
  );
};

// ============= Confidence meter =============
window.Confidence = function Confidence({ value }) {
  const tone = confidenceTone(value);
  return (
    <div style={{display:'flex', flexDirection:'column', gap:4, minWidth: 100}}>
      <div className="meter" data-tone={tone}>
        <div className="meter-fill" style={{width: `${value*100}%`}}></div>
      </div>
      <div style={{fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)'}}>
        {(value*100).toFixed(0)}% confianza
      </div>
    </div>
  );
};

Object.assign(window, { NODES: window.AGENT_NODES });
