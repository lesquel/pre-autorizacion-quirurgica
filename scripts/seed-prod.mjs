#!/usr/bin/env node
/*
 * seed-prod.mjs — Pueblar el demo de producción con casos reales.
 *
 * Loguea como hospital@demo.com, submitea 4 escenarios texto a
 * POST /api/v1/cases (el PDF lo skip porque necesita multipart real).
 * Después loguea como auditor@demo.com y resuelve 1 escalado para
 * que /auditor/resolved tenga al menos una fila.
 *
 * Uso:
 *   node scripts/seed-prod.mjs
 *   API_URL=http://localhost:8000 node scripts/seed-prod.mjs
 *
 * El backend tiene fixtures in-memory (SEED_PATIENTS, SEED_POLICIES,
 * etc.) ya cargados al arrancar — los casos creados acá se acumulan
 * sobre esos. En Render free el container se duerme tras ~15 min de
 * inactividad y pierde memoria: re-correr el script repuebla.
 */
const API_URL = process.env.API_URL ?? 'https://pre-autorizacion-quirurgica.onrender.com';

const SCENARIOS = [
  {
    key: 'APPROVED_AUTO',
    label: 'Aprobado auto',
    patientId: 'PAC-00481',
    policyNumber: 'POL-2024-04812',
    procedureCode: 'K80.20',
    report: `INFORME MÉDICO PREQUIRÚRGICO
Paciente: María Elena Vásquez Romero · DNI 1714592083 · 54 años · F
Diagnóstico: Colecistitis crónica calculosa (K80.20)
Procedimiento solicitado: Colecistectomía laparoscópica (CIE-10 K80.20)
Médico tratante: Dr. Carlos Andrade Bermúdez (Reg. MED-04812)
Hospital: Clínica San Lucas

Historia clínica relevante:
- Episodios recurrentes de dolor en hipocondrio derecho desde hace 8 meses.
- Ecografía abdominal del 2026-04-15: colelitiasis múltiple, pared vesicular engrosada.
- Sin antecedentes quirúrgicos previos. Sin alergias conocidas.
- ASA II.

Indicación: cirugía electiva ambulatoria laparoscópica.
Estudios prequirúrgicos: hemograma, coagulograma, ECG, riesgo cardiológico — todos normales.
Documentos adjuntos: ECG normal, evaluación cardiológica firmada, consentimiento informado.

Autorización solicitada para: 2026-05-20.`,
  },
  {
    key: 'DOCS_REQUESTED',
    label: 'Documentos faltantes',
    patientId: 'PAC-00819',
    policyNumber: 'POL-2023-07331',
    procedureCode: 'N40.1',
    report: `INFORME UROLÓGICO PREQUIRÚRGICO
Paciente: Luis Fernando Mora Velasco · DNI 1804923765 · 61 años · M
Diagnóstico: Hiperplasia prostática benigna sintomática (N40.1)
Procedimiento solicitado: Resección transuretral de próstata (RTU)
Médico tratante: Dr. Roberto Salazar Quiñonez (Reg. URO-03114)

Historia clínica:
- Síntomas obstructivos del tracto urinario inferior progresivos.
- Tratamiento médico con tamsulosina + finasterida durante 8 meses sin mejora.
- PSA: 3.8 ng/mL · próstata 65cc por ecografía.
- IPSS: 22 (severo).

Cobertura: la póliza requiere ECG, evaluación cardiológica, hemograma,
coagulograma, riesgo anestésico. En este expediente NO se adjuntan estudios
preanestésicos completos — falta evaluación cardiológica firmada.`,
  },
  {
    key: 'ESCALATED_WAITING',
    label: 'Escalado por carencia',
    patientId: 'PAC-00622',
    policyNumber: 'POL-2025-01193',
    procedureCode: 'M17.11',
    report: `INFORME TRAUMATOLÓGICO
Paciente: Jorge Andrés Cabrera Salas · DNI 0923847156 · 67 años · M
Diagnóstico: Gonartrosis primaria de rodilla derecha grado IV (M17.11)
Procedimiento solicitado: Artroplastía total de rodilla derecha
Médico tratante: Dr. Andrés Méndez Cevallos (Reg. TRA-09781)

Historia clínica:
- Dolor progresivo y limitación funcional severa de rodilla derecha desde hace 3 años.
- RX Schuss bilateral: pinzamiento femorotibial medial bilateral, geodas, osteofitos.
- IMC 31, ASA II.
- Tratamiento conservador agotado (AINEs, fisioterapia, infiltración con ácido hialurónico).

Estudios prequirúrgicos completos.

Observación: la póliza POL-2025-01193 fue dada de alta el 2025-04-15.
Carencia restante para cirugía electiva: ~45 días al momento de este informe.
El paciente solicita expresamente proceder dado el dolor invalidante.`,
  },
  {
    key: 'ESCALATED_LOW_CONF',
    label: 'Escalado por baja confianza',
    patientId: 'PAC-00733',
    policyNumber: 'POL-2024-09872',
    procedureCode: '?',
    report: `NOTA DE EVOLUCIÓN — INGRESO POR EMERGENCIA
Paciente: Sofía Camila Pérez Tobar · 36 años
Cuadro: dolor abdominal agudo en cuadrante inferior derecho, fiebre 38.6°C,
defensa abdominal, McBurney positivo, leucocitos 14,200.

Se solicita pase a quirófano de emergencia. Diagnóstico clínico presuntivo:
abdomen agudo quirúrgico. Cirujano de guardia evalúa indicación.

(No se especificó código CIE-10 en este pase — el equipo de cirugía completará
los detalles del procedimiento tras la evaluación intraoperatoria.)`,
  },
];

const log = (icon, msg, ...rest) => console.log(`${icon} ${msg}`, ...rest);

async function postJson(path, body, token) {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function login(email, password) {
  log('→', `login ${email}`);
  const { accessToken, user } = await postJson('/api/v1/auth/login', { email, password });
  log('✓', `  user=${user.id} role=${user.role}`);
  return accessToken;
}

async function submitScenario(token, scenario) {
  log('→', `submit ${scenario.key} (${scenario.label})`);
  const body = {
    report: {
      patientId: scenario.patientId,
      format: 'text',
      content: scenario.report,
      procedureSolicitedHint: scenario.procedureCode === '?' ? undefined : scenario.procedureCode,
    },
    policyNumber: scenario.policyNumber,
    scenarioKey: scenario.key,
  };
  try {
    const result = await postJson('/api/v1/cases', body, token);
    const outcome = result.decision?.outcome ?? result.status ?? '?';
    log('✓', `  case=${result.id} outcome=${outcome}`);
    return result;
  } catch (err) {
    log('✗', `  ${err.message}`);
    return null;
  }
}

async function listEscalated(token) {
  const res = await fetch(`${API_URL}/api/v1/cases?status=ESCALADO`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET /cases → ${res.status}`);
  }
  return res.json();
}

async function resolveCase(token, caseId, outcome, message, reasoning) {
  log('→', `resolve ${caseId} → ${outcome}`);
  // ResolveCaseIn (cases.py:64) requiere: outcome ∈ {'APPROVED','REJECTED'},
  // message (dirigido al hospital) y reasoning (rationale del auditor).
  const body = { outcome, message, reasoning };
  try {
    const result = await postJson(`/api/v1/cases/${caseId}/resolve`, body, token);
    log('✓', `  status=${result.status}`);
    return result;
  } catch (err) {
    log('✗', `  ${err.message}`);
    return null;
  }
}

async function main() {
  console.log(`\n=== Seeding ${API_URL} ===\n`);

  // 1. Hospital submitea los 4 casos texto.
  const hospitalToken = await login('hospital@demo.com', 'hospital');
  const results = [];
  for (const scenario of SCENARIOS) {
    results.push(await submitScenario(hospitalToken, scenario));
    // Pequeña pausa para que el agente no se sature — DeepSeek tiene rate limits.
    await new Promise((r) => setTimeout(r, 800));
  }
  const submitted = results.filter((r) => r !== null);
  console.log(`\n  → ${submitted.length}/${SCENARIOS.length} casos creados.\n`);

  // 2. Auditor resuelve algunos escalados para llenar /auditor/resolved.
  // Alternamos APPROVED y REJECTED para que la grilla tenga ambos outcomes.
  const auditorToken = await login('auditor@demo.com', 'auditor');
  const escalated = await listEscalated(auditorToken);
  log('ℹ', `escalados disponibles: ${escalated.length}`);

  const TO_RESOLVE = Math.min(6, escalated.length); // limitamos para no saturar Notion.
  for (let i = 0; i < TO_RESOLVE; i++) {
    const target = escalated[i];
    const outcome = i % 2 === 0 ? 'APPROVED' : 'REJECTED';
    const message =
      outcome === 'APPROVED'
        ? 'Caso aprobado tras revisión clínica del auditor. ' +
          'La indicación quirúrgica está justificada y la cobertura aplica.'
        : 'Caso rechazado tras revisión clínica del auditor. ' +
          'Se sugiere agotar el tratamiento conservador antes de considerar cirugía.';
    const reasoning =
      outcome === 'APPROVED'
        ? 'Indicación quirúrgica documentada con estudios completos y carencia cumplida. ' +
          'El paciente tiene cobertura activa para el procedimiento. Sin contraindicaciones ' +
          'identificadas en el expediente. Aprobado.'
        : 'Falta evidencia clínica suficiente para justificar el procedimiento solicitado. ' +
          'No se cumplen los criterios del manual de prácticas para indicación quirúrgica directa. ' +
          'Se recomienda manejo conservador antes de re-evaluar.';
    await resolveCase(auditorToken, target.id, outcome, message, reasoning);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n=== Done ===');
  console.log(`  Frontend: https://pre-autorizacion-quirurgica.vercel.app`);
  console.log(`  Backend:  ${API_URL}/docs\n`);
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
