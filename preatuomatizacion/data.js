// Synthetic seed data — surgical pre-authorization domain
// All data is fictional. CIE-10 codes are real, patient/policy data is fabricated.

window.SEED = {
  procedures: [
    { code: "K80.20", name: "Colecistectomía laparoscópica", category: "Cirugía general", waitingDaysTypical: 90 },
    { code: "M17.11", name: "Artroplastia total de rodilla unilateral", category: "Traumatología", waitingDaysTypical: 365 },
    { code: "H25.13", name: "Facoemulsificación con LIO (catarata)", category: "Oftalmología", waitingDaysTypical: 180 },
    { code: "N40.1",  name: "Resección transuretral de próstata (RTUP)", category: "Urología", waitingDaysTypical: 180 },
    { code: "K35.80", name: "Apendicectomía laparoscópica de urgencia", category: "Cirugía general", waitingDaysTypical: 0 },
    { code: "I83.90", name: "Safenectomía bilateral", category: "Cirugía vascular", waitingDaysTypical: 365 },
  ],
  patients: [
    { id: "PAC-00481", name: "María Elena Vásquez Romero",  dni: "1714592083", dob: "1971-08-12", sex: "F" },
    { id: "PAC-00622", name: "Jorge Andrés Cabrera Salas",  dni: "0923847156", dob: "1958-03-04", sex: "M" },
    { id: "PAC-00733", name: "Sofía Camila Pérez Tobar",    dni: "1759302841", dob: "1989-11-22", sex: "F" },
    { id: "PAC-00819", name: "Luis Fernando Mora Velasco",  dni: "1804923765", dob: "1965-01-30", sex: "M" },
    { id: "PAC-00901", name: "Ana Paula Espinoza Cárdenas", dni: "1722984310", dob: "1978-06-15", sex: "F" },
  ],
  policies: [
    { number: "POL-2024-04812", patientId: "PAC-00481", plan: "Salud Premium 360", insurer: "Aseguradora Andina S.A.", startDate: "2023-02-01", endDate: "2026-02-01", status: "ACTIVA" },
    { number: "POL-2025-01193", patientId: "PAC-00622", plan: "Plan Esencial",      insurer: "Aseguradora Andina S.A.", startDate: "2025-11-15", endDate: "2026-11-15", status: "ACTIVA" },
    { number: "POL-2024-09872", patientId: "PAC-00733", plan: "Salud Premium 360", insurer: "Aseguradora Andina S.A.", startDate: "2022-09-10", endDate: "2026-09-10", status: "ACTIVA" },
    { number: "POL-2023-07331", patientId: "PAC-00819", plan: "Plan Familiar",      insurer: "Aseguradora Andina S.A.", startDate: "2021-04-22", endDate: "2026-04-22", status: "ACTIVA" },
    { number: "POL-2025-02240", patientId: "PAC-00901", plan: "Plan Esencial",      insurer: "Aseguradora Andina S.A.", startDate: "2024-08-01", endDate: "2026-08-01", status: "ACTIVA" },
  ],
  // coverage rows (policy × procedure)
  coverages: [
    { policy: "POL-2024-04812", procedure: "K80.20", covered: true, waitingDays: 90,  copay: 80,  required: ["Informe médico", "Ecografía abdominal", "Laboratorio prequirúrgico", "Riesgo cardiológico"] },
    { policy: "POL-2024-04812", procedure: "H25.13", covered: true, waitingDays: 180, copay: 120, required: ["Informe oftalmológico", "Biometría ocular", "Riesgo cardiológico"] },
    { policy: "POL-2025-01193", procedure: "M17.11", covered: true, waitingDays: 365, copay: 0,   required: ["Informe traumatológico", "Resonancia magnética", "Radiografía bilateral", "Riesgo cardiológico", "Riesgo anestésico"] },
    { policy: "POL-2024-09872", procedure: "K35.80", covered: true, waitingDays: 0,   copay: 0,   required: ["Informe de urgencia", "Laboratorio prequirúrgico"] },
    { policy: "POL-2023-07331", procedure: "N40.1",  covered: true, waitingDays: 180, copay: 60,  required: ["Informe urológico", "PSA", "Ecografía prostática", "Riesgo cardiológico"] },
    { policy: "POL-2025-02240", procedure: "I83.90", covered: true, waitingDays: 365, copay: 100, required: ["Informe vascular", "Eco-doppler venoso", "Riesgo cardiológico"] },
  ],

  // Pre-baked demo cases — choose an outcome and the right inputs are loaded
  demoCases: {
    APPROVED_AUTO: {
      label: "Aprobación automática",
      patientId: "PAC-00481",
      policyNumber: "POL-2024-04812",
      procedureCode: "K80.20",
      report: `INFORME MÉDICO PREQUIRÚRGICO
Hospital Metropolitano — Servicio de Cirugía General
Fecha: 06/05/2026

Paciente: VÁSQUEZ ROMERO, María Elena · DNI 1714592083 · F · 54 a
Póliza presentada: POL-2024-04812 (Salud Premium 360)

DIAGNÓSTICO
Colelitiasis sintomática con episodios recurrentes de cólico biliar.
Ecografía 28/04/2026: vesícula con litiasis múltiple, paredes 4mm, sin dilatación de vía biliar.
CIE-10: K80.20

PROCEDIMIENTO PROPUESTO
Colecistectomía laparoscópica electiva.

DOCUMENTACIÓN ADJUNTA
- Ecografía abdominal (28/04/2026)
- Laboratorio prequirúrgico completo (02/05/2026)
- Riesgo cardiológico ASA II (30/04/2026)

Dr. R. Salgado · Cirugía General · MP 18472`,
      attachedDocs: ["Informe médico", "Ecografía abdominal", "Laboratorio prequirúrgico", "Riesgo cardiológico"],
      format: "TEXT",
    },
    DOCS_REQUESTED: {
      label: "Documentos faltantes",
      patientId: "PAC-00819",
      policyNumber: "POL-2023-07331",
      procedureCode: "N40.1",
      report: `INFORME UROLÓGICO PREQUIRÚRGICO
Centro Urológico San Lucas
Fecha: 05/05/2026

Paciente: MORA VELASCO, Luis Fernando · DNI 1804923765 · M · 61 a
Póliza: POL-2023-07331 (Plan Familiar)

DIAGNÓSTICO
Hiperplasia prostática benigna grado III, sintomática (IPSS 22).
Flujometría: Qmáx 6 ml/s, residuo postmiccional 180 ml.
CIE-10: N40.1

PROCEDIMIENTO PROPUESTO
Resección transuretral de próstata (RTUP).

DOCUMENTACIÓN ADJUNTA
- Informe urológico
- PSA 4.2 ng/ml (15/04/2026)
- Riesgo cardiológico ASA II (28/04/2026)

Dr. M. Andrade · Urología · MP 9821`,
      attachedDocs: ["Informe urológico", "PSA", "Riesgo cardiológico"], // missing Ecografía prostática
      format: "TEXT",
    },
    ESCALATED_WAITING: {
      label: "Escalado — carencia incumplida",
      patientId: "PAC-00622",
      policyNumber: "POL-2025-01193",
      procedureCode: "M17.11",
      report: `INFORME TRAUMATOLÓGICO
Hospital Metropolitano — Servicio de Traumatología
Fecha: 06/05/2026

Paciente: CABRERA SALAS, Jorge Andrés · DNI 0923847156 · M · 68 a
Póliza: POL-2025-01193 (Plan Esencial · vigente desde 15/11/2025)

DIAGNÓSTICO
Gonartrosis tricompartimental severa rodilla derecha.
Kellgren-Lawrence IV. Dolor incapacitante. RM 20/04/2026: pérdida total de cartílago.
CIE-10: M17.11

PROCEDIMIENTO PROPUESTO
Artroplastia total de rodilla derecha.

DOCUMENTACIÓN ADJUNTA
- Informe traumatológico
- Resonancia magnética
- Radiografía bilateral
- Riesgo cardiológico ASA III
- Riesgo anestésico

Dr. P. Chávez · Traumatología · MP 14211`,
      attachedDocs: ["Informe traumatológico", "Resonancia magnética", "Radiografía bilateral", "Riesgo cardiológico", "Riesgo anestésico"],
      format: "TEXT",
    },
    ESCALATED_LOW_CONF: {
      label: "Escalado — baja confianza en match",
      patientId: "PAC-00733",
      policyNumber: "POL-2024-09872",
      procedureCode: "?",
      report: `NOTA DE EVOLUCIÓN — INGRESO POR EMERGENCIA
Hospital Metropolitano · Sala de Emergencia
Fecha: 06/05/2026 02:14

Paciente: PÉREZ TOBAR, Sofía Camila · 36 a · F
Cuadro de 14h de evolución: dolor abdominal en FID, defensa,
Blumberg (+), náuseas, fiebre 38.4°C. Leucos 14.8k. Eco
no concluyente, posible plastrón. Se solicita evaluación
quirúrgica urgente. Probable apendicitis aguda complicada
vs. patología anexial. Considerar laparoscopía exploratoria
y eventual apendicectomía.

Dra. L. Toro · Emergencia · MP 22094`,
      attachedDocs: ["Informe de urgencia", "Laboratorio prequirúrgico"],
      format: "TEXT",
    },
    ESCALATED_PDF_FAIL: {
      label: "Escalado — falla de extracción PDF",
      patientId: "PAC-00901",
      policyNumber: "POL-2025-02240",
      procedureCode: "I83.90",
      report: "[informe-vascular-escaneado.pdf · 4.2 MB · 6 páginas]",
      attachedDocs: ["Informe vascular", "Eco-doppler venoso", "Riesgo cardiológico"],
      format: "PDF",
    },
  },
};

// Sample existing cases (for Aseguradora dashboard + Auditor tray on first load)
// Costos calculados con DeepSeek (~$0.00052 / 1K tokens efectivos) → todos ≤ $0.02 (PRD KPI 5)
window.INITIAL_CASES = [
  {
    id: "CASE-01H7K2",
    createdAt: "2026-05-06T08:14:22Z",
    patientId: "PAC-00481", procedureCode: "K80.20", policyNumber: "POL-2024-04812",
    outcome: "APPROVED_AUTO", status: "DECIDIDO", confidence: 0.94,
    durationMs: 7820, tokens: 4820, costUsd: 0.0025,
    submittedBy: "hospital",
  },
  {
    id: "CASE-01H7J9",
    createdAt: "2026-05-06T07:51:09Z",
    patientId: "PAC-00819", procedureCode: "N40.1", policyNumber: "POL-2023-07331",
    outcome: "DOCS_REQUESTED", status: "PENDIENTE_DOCS", confidence: 0.88,
    durationMs: 6210, tokens: 3990, costUsd: 0.0021,
    missingDocs: ["Ecografía prostática"],
    submittedBy: "hospital",
  },
  {
    id: "CASE-01H7G3",
    createdAt: "2026-05-06T06:12:44Z",
    patientId: "PAC-00622", procedureCode: "M17.11", policyNumber: "POL-2025-01193",
    outcome: "ESCALATED", status: "ESCALADO", confidence: 0.71,
    escalationReason: "WAITING_PERIOD_NOT_MET",
    durationMs: 8930, tokens: 5210, costUsd: 0.0027,
    submittedBy: "hospital",
  },
  {
    id: "CASE-01H7F1",
    createdAt: "2026-05-05T22:03:18Z",
    patientId: "PAC-00733", procedureCode: "?", policyNumber: "POL-2024-09872",
    outcome: "ESCALATED", status: "ESCALADO", confidence: 0.42,
    escalationReason: "LOW_CONFIDENCE_PROCEDURE_MATCH",
    durationMs: 9430, tokens: 4980, costUsd: 0.0026,
    submittedBy: "hospital",
  },
  {
    id: "CASE-01H7E8",
    createdAt: "2026-05-05T19:22:55Z",
    patientId: "PAC-00901", procedureCode: "I83.90", policyNumber: "POL-2025-02240",
    outcome: "ESCALATED", status: "ESCALADO", confidence: 0.38,
    escalationReason: "PDF_EXTRACTION_FAILURE",
    durationMs: 11210, tokens: 6420, costUsd: 0.0033,
    submittedBy: "hospital",
  },
  {
    id: "CASE-01H7C4",
    createdAt: "2026-05-05T15:48:11Z",
    patientId: "PAC-00481", procedureCode: "H25.13", policyNumber: "POL-2024-04812",
    outcome: "APPROVED_AUTO", status: "DECIDIDO", confidence: 0.96,
    durationMs: 6440, tokens: 4120, costUsd: 0.0021,
    submittedBy: "hospital",
  },
  {
    id: "CASE-01H7B0",
    createdAt: "2026-05-05T11:09:33Z",
    patientId: "PAC-00733", procedureCode: "K35.80", policyNumber: "POL-2024-09872",
    outcome: "APPROVED_AUTO", status: "DECIDIDO", confidence: 0.91,
    durationMs: 5810, tokens: 3680, costUsd: 0.0019,
    submittedBy: "hospital",
  },
];
