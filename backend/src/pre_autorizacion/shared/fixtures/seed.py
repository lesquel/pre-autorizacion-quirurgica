"""SEED — datos sintéticos del prototipo, ports directos del frontend.

Origen: `frontend/src/app/shared/fixtures/seed.ts`. Mantenemos los **mismos
valores** y los **mismos ids** para que el back y el front sean ejercitables
con casos coherentes (ver `INITIAL_CASES` y `DemoCase`).

Mapeos aplicados:
- Fechas ISO `'YYYY-MM-DD'` → `datetime.date` (parseo `date.fromisoformat`).
- `Coverage.copay` (`number` USD en TS) → `Decimal` para precisión monetaria.
- `Policy.status: 'ACTIVE'` → `PolicyStatus.ACTIVE`.
- `Insurer.email` no existe en el TS de v1 → se omite (default `None`).

Estos seeds son inmutables (`tuple`) y se inyectan en los repos in-memory
fallback (cuando no hay credenciales de Notion). El flujo demo end-to-end
debe correr tanto contra Notion como contra estos fixtures sin diferencias
observables al consumidor.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pre_autorizacion.features.policies.domain.entities.coverage import Coverage
from pre_autorizacion.features.policies.domain.entities.insurer import Insurer
from pre_autorizacion.features.policies.domain.entities.policy import Policy, PolicyStatus
from pre_autorizacion.shared.domain.entities.patient import Patient, Sex
from pre_autorizacion.shared.domain.entities.procedure import Procedure

# ─── Aseguradoras ──────────────────────────────────────────────────────────

SEED_INSURERS: tuple[Insurer, ...] = (
    Insurer(
        id="INS-ANDINA",
        name="Aseguradora Andina S.A.",
    ),
)

# ─── Pacientes ─────────────────────────────────────────────────────────────

SEED_PATIENTS: tuple[Patient, ...] = (
    Patient(
        id="PAC-00481",
        dni="1714592083",
        name="María Elena Vásquez Romero",
        dob=date.fromisoformat("1971-08-12"),
        sex=Sex.F,
    ),
    Patient(
        id="PAC-00622",
        dni="0923847156",
        name="Jorge Andrés Cabrera Salas",
        dob=date.fromisoformat("1958-03-04"),
        sex=Sex.M,
    ),
    Patient(
        id="PAC-00733",
        dni="1759302841",
        name="Sofía Camila Pérez Tobar",
        dob=date.fromisoformat("1989-11-22"),
        sex=Sex.F,
    ),
    Patient(
        id="PAC-00819",
        dni="1804923765",
        name="Luis Fernando Mora Velasco",
        dob=date.fromisoformat("1965-01-30"),
        sex=Sex.M,
    ),
    Patient(
        id="PAC-00901",
        dni="1722984310",
        name="Ana Paula Espinoza Cárdenas",
        dob=date.fromisoformat("1978-06-15"),
        sex=Sex.F,
    ),
)

# ─── Procedimientos ────────────────────────────────────────────────────────

SEED_PROCEDURES: tuple[Procedure, ...] = (
    Procedure(
        code="K80.20",
        name="Colecistectomía laparoscópica",
        category="Cirugía general",
        waiting_days_typical=90,
    ),
    Procedure(
        code="M17.11",
        name="Artroplastia total de rodilla unilateral",
        category="Traumatología",
        waiting_days_typical=365,
    ),
    Procedure(
        code="H25.13",
        name="Facoemulsificación con LIO (catarata)",
        category="Oftalmología",
        waiting_days_typical=180,
    ),
    Procedure(
        code="N40.1",
        name="Resección transuretral de próstata (RTUP)",
        category="Urología",
        waiting_days_typical=180,
    ),
    Procedure(
        code="K35.80",
        name="Apendicectomía laparoscópica de urgencia",
        category="Cirugía general",
        waiting_days_typical=0,
    ),
    Procedure(
        code="I83.90",
        name="Safenectomía bilateral",
        category="Cirugía vascular",
        waiting_days_typical=365,
    ),
)

# ─── Pólizas ───────────────────────────────────────────────────────────────

SEED_POLICIES: tuple[Policy, ...] = (
    Policy(
        number="POL-2024-04812",
        patient_id="PAC-00481",
        plan="Salud Premium 360",
        insurer_id="INS-ANDINA",
        start_date=date.fromisoformat("2023-02-01"),
        end_date=date.fromisoformat("2026-02-01"),
        status=PolicyStatus.ACTIVE,
    ),
    Policy(
        number="POL-2025-01193",
        patient_id="PAC-00622",
        plan="Plan Esencial",
        insurer_id="INS-ANDINA",
        start_date=date.fromisoformat("2025-11-15"),
        end_date=date.fromisoformat("2026-11-15"),
        status=PolicyStatus.ACTIVE,
    ),
    Policy(
        number="POL-2024-09872",
        patient_id="PAC-00733",
        plan="Salud Premium 360",
        insurer_id="INS-ANDINA",
        start_date=date.fromisoformat("2022-09-10"),
        end_date=date.fromisoformat("2026-09-10"),
        status=PolicyStatus.ACTIVE,
    ),
    Policy(
        number="POL-2023-07331",
        patient_id="PAC-00819",
        plan="Plan Familiar",
        insurer_id="INS-ANDINA",
        start_date=date.fromisoformat("2021-04-22"),
        end_date=date.fromisoformat("2026-04-22"),
        status=PolicyStatus.ACTIVE,
    ),
    Policy(
        number="POL-2025-02240",
        patient_id="PAC-00901",
        plan="Plan Esencial",
        insurer_id="INS-ANDINA",
        start_date=date.fromisoformat("2024-08-01"),
        end_date=date.fromisoformat("2026-08-01"),
        status=PolicyStatus.ACTIVE,
    ),
)

# ─── Coberturas ────────────────────────────────────────────────────────────

SEED_COVERAGES: tuple[Coverage, ...] = (
    Coverage(
        policy_number="POL-2024-04812",
        procedure_code="K80.20",
        covered=True,
        waiting_days=90,
        copay=Decimal("80"),
        required_docs=(
            "Informe médico",
            "Ecografía abdominal",
            "Laboratorio prequirúrgico",
            "Riesgo cardiológico",
        ),
    ),
    Coverage(
        policy_number="POL-2024-04812",
        procedure_code="H25.13",
        covered=True,
        waiting_days=180,
        copay=Decimal("120"),
        required_docs=(
            "Informe oftalmológico",
            "Biometría ocular",
            "Riesgo cardiológico",
        ),
    ),
    Coverage(
        policy_number="POL-2025-01193",
        procedure_code="M17.11",
        covered=True,
        waiting_days=365,
        copay=Decimal("0"),
        required_docs=(
            "Informe traumatológico",
            "Resonancia magnética",
            "Radiografía bilateral",
            "Riesgo cardiológico",
            "Riesgo anestésico",
        ),
    ),
    Coverage(
        policy_number="POL-2024-09872",
        procedure_code="K35.80",
        covered=True,
        waiting_days=0,
        copay=Decimal("0"),
        required_docs=(
            "Informe de urgencia",
            "Laboratorio prequirúrgico",
        ),
    ),
    Coverage(
        policy_number="POL-2023-07331",
        procedure_code="N40.1",
        covered=True,
        waiting_days=180,
        copay=Decimal("60"),
        required_docs=(
            "Informe urológico",
            "PSA",
            "Ecografía prostática",
            "Riesgo cardiológico",
        ),
    ),
    Coverage(
        policy_number="POL-2025-02240",
        procedure_code="I83.90",
        covered=True,
        waiting_days=365,
        copay=Decimal("100"),
        required_docs=(
            "Informe vascular",
            "Eco-doppler venoso",
            "Riesgo cardiológico",
        ),
    ),
)


__all__ = [
    "SEED_COVERAGES",
    "SEED_INSURERS",
    "SEED_PATIENTS",
    "SEED_POLICIES",
    "SEED_PROCEDURES",
]
