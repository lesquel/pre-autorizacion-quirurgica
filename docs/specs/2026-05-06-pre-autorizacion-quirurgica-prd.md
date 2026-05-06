# PRD — Agente de Pre-Autorización Quirúrgica en Tiempo Real

| Campo | Valor |
|---|---|
| **Versión** | 1.0 |
| **Fecha** | 2026-05-06 |
| **Estado** | Aprobado — listo para implementación |
| **Owner** | lesquel |
| **Repositorio** | https://github.com/lesquel/pre-autorizacion-quirurgica |

---

## 1. Executive Summary

### 1.1 Problem Statement

Los pacientes deben esperar **horas o días** para que su seguro autorice una cirugía. El proceso manual implica revisión humana de informes médicos contra pólizas, validación de carencias y verificación de documentos — todo en serie, todo lento, todo bloqueando atención médica que muchas veces es tiempo-crítica.

### 1.2 Proposed Solution

Un agente IA que recibe el informe médico digital (Hospital) y la póliza del paciente (Aseguradora) desde una base de datos en Notion, analiza cobertura, carencia y documentación de forma instantánea, y emite uno de tres desenlaces: pre-aprobación automática, solicitud de documentos faltantes, o escalamiento a auditor médico humano.

**El sistema NUNCA auto-rechaza** — todo rechazo escala a juicio humano por responsabilidad legal y clínica.

### 1.3 Success Criteria (KPIs)

| # | KPI | Threshold |
|---|---|---|
| 1 | Latencia de respuesta | ≤ 10s (texto) / ≤ 20s (PDF). Reducción ≥ 95% vs flujo manual. |
| 2 | Tasa de auto-resolución | ≥ 60% de casos resueltos sin intervención humana. |
| 3 | Auditabilidad | 100% de las decisiones con trace completo, justificación y confidence score. |
| 4 | Seguridad clínica | **0% de rechazos automáticos**. Todo rechazo pasa por humano. |
| 5 | Cost-per-case | ≤ $0.10 USD por caso procesado. |

---

## 2. User Experience & Functionality

### 2.1 User Personas

#### 2.1.1 Personal del Hospital (médico/admin)
- Necesita pre-autorización rápida para programar cirugía.
- Carga el informe médico (texto libre o PDF) y datos del paciente.
- Espera respuesta en segundos, no días.
- Necesita feedback claro si faltan documentos.

#### 2.1.2 Operador de la Aseguradora
- Configura pólizas, coberturas, carencias y documentos requeridos por procedimiento.
- Necesita panel CRUD de pólizas y coberturas.
- Revisa estadísticas agregadas (volumen, distribución de outcomes).

#### 2.1.3 Auditor Médico
- Profesional de la salud que revisa casos escalados.
- Necesita ver el trace completo del agente (qué hizo, por qué llegó a su mesa).
- Resuelve casos manualmente (aprobar/rechazar) con justificación clínica.
- Necesita filtros por urgencia, fecha, motivo de escalamiento.

### 2.2 User Stories

#### Hospital
- **US-H1**: Como personal del hospital, quiero subir un informe médico (texto o PDF) y recibir pre-autorización en menos de 20 segundos, para no demorar la programación quirúrgica.
- **US-H2**: Como personal del hospital, quiero ver en vivo qué pasos ejecuta el agente, para saber cuánto falta y qué está validando.
- **US-H3**: Como personal del hospital, quiero recibir una lista clara de documentos faltantes cuando aplica, sin tener que adivinar qué pide la aseguradora.

#### Aseguradora
- **US-A1**: Como operador de la aseguradora, quiero crear y editar pólizas con sus coberturas, carencias y docs requeridos por procedimiento, para que el agente tenga las reglas correctas.
- **US-A2**: Como operador de la aseguradora, quiero ver un dashboard con la distribución de outcomes y casos por hospital, para detectar anomalías.

#### Auditor
- **US-AU1**: Como auditor médico, quiero ver una bandeja con todos los casos escalados ordenados por urgencia clínica.
- **US-AU2**: Como auditor médico, quiero leer el razonamiento del agente y la traza paso a paso, para saber dónde dudó y por qué.
- **US-AU3**: Como auditor médico, quiero resolver el caso (aprobar/rechazar) con mi justificación textual, que queda en el record permanente.

### 2.3 Acceptance Criteria (MVP)

#### 2.3.1 Hospital — submission
- [ ] Puede subir informe en texto libre o PDF (≤ 10 MB).
- [ ] Recibe ID del caso inmediatamente (HTTP 202 Accepted).
- [ ] Ve actualizaciones del agente en vivo vía Server-Sent Events (al menos: extracción → matching → validación → decisión).
- [ ] Recibe el resultado final con: outcome, mensaje en español natural, justificación, confidence score, lista de docs faltantes (si aplica), o motivo de escalamiento.

#### 2.3.2 Aseguradora — gestión de pólizas
- [ ] CRUD completo de pólizas (número, paciente, plan, fechas, estado).
- [ ] Reemplazo masivo de coberturas por póliza (procedimiento + cubierto + carencia + docs requeridos).
- [ ] Lista paginada con filtros (estado, fecha, paciente).

#### 2.3.3 Auditor — bandeja y resolución
- [ ] Bandeja con casos escalados, ordenados por fecha o motivo de escalamiento.
- [ ] Vista de detalle del caso con: informe original, póliza relevante, trace completo del agente, motivo de escalamiento.
- [ ] Acción de resolver: outcome (APPROVED/REJECTED) + mensaje + razonamiento + adjuntos opcionales.
- [ ] Estado del caso pasa a `DECIDIDO` y el hospital lo ve vía SSE.

#### 2.3.4 Calidad del sistema
- [ ] Latencia p95 ≤ 10s (texto) / ≤ 20s (PDF).
- [ ] Coverage de tests ≥ 80% en `domain/` y `application/`.
- [ ] Cada respuesta (éxito o error) incluye `trace_id` correlacionable con logs estructurados.
- [ ] Errores siguen formato RFC 7807 (Problem Details).
- [ ] Demo de 3 minutos con los 3 desenlaces ensayada y reproducible.

### 2.4 Non-Goals (NO en MVP)

- ❌ Vista del paciente (v1.1).
- ❌ Integración HL7/FHIR. Recepción solo texto/PDF.
- ❌ Soporte multi-hospital ni multi-aseguradora. UN hospital, UNA aseguradora.
- ❌ **Rechazo automático bajo ninguna circunstancia.** Todo rechazo escala a auditor.
- ❌ OCR avanzado para PDFs manuscritos. Si Vision API no extrae con calidad, escala.
- ❌ Integración con sistemas hospitalarios reales (HIS/EHR).
- ❌ Notificaciones push/email/SMS. La UI muestra estado en vivo vía SSE.
- ❌ Internacionalización. Spanish-only.
- ❌ Procesamiento batch / asíncrono pesado. Un caso a la vez.

---

## 3. AI System Requirements

### 3.1 Tool Requirements

#### 3.1.1 Modelos LLM (estrategia híbrida)

| Modelo | Uso | Razón |
|---|---|---|
| **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | Extracción de entidades clínicas (texto + vision) | Cheap + fast |
| **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | Decisión final + justificación clínica | Mejor razonamiento |

Híbrido reduce ~60% el costo vs Sonnet puro sin sacrificar calidad de la decisión, que es el output más sensible.

#### 3.1.2 Frameworks IA

- **LangChain** (`langchain-core`, `langchain-anthropic`): clientes LLM, tools, memoria.
- **LangGraph**: orquestación del agente como máquina de estados explícita. Auditable y testeable, requisito para dominio médico-legal.

#### 3.1.3 Nodos del grafo (agente)

| # | Nodo | Tipo | Modelo |
|---|---|---|---|
| 1 | `extract_report` | LLM | Haiku 4.5 (vision si PDF) |
| 2 | `match_procedure` | Rule + embeddings (fallback) | — |
| 3 | `load_policy_coverage` | Notion API | — |
| 4 | `check_waiting_period` | Determinístico (date math) | — |
| 5 | `check_required_docs` | Determinístico (set diff) | — |
| 6 | `make_decision` | LLM | Sonnet 4.6 |
| 7 | `persist_case` | Notion API (sumidero único) | — |

**El agente NUNCA auto-rechaza por diseño**: el grafo no tiene rama `REJECTED_AUTO`. Todos los caminos negativos van a `ESCALATED`.

#### 3.1.4 Patrón de desacople LLM

Dos niveles de abstracción:
- **Bajo nivel** — `LLMProvider` (port): abstrae modelo/proveedor concreto. Adapters: `AnthropicLLMAdapter`, `OpenAILLMAdapter`, `GeminiLLMAdapter`.
- **Alto nivel** — `MedicalReportExtractor`, `AuthorizationDecisionMaker`, `ResponseGenerator` (ports): abstraen estrategia. Cada adapter compone un `LLMProvider`.

Strategy via Pydantic Settings + Dependency Injection en FastAPI:
```python
class AISettings(BaseSettings):
    extraction_provider: Literal["anthropic", "openai", "gemini"] = "anthropic"
    extraction_model: str = "claude-haiku-4-5-20251001"
    decision_provider: Literal["anthropic", "openai", "gemini"] = "anthropic"
    decision_model: str = "claude-sonnet-4-6"
```

### 3.2 Evaluation Strategy

#### 3.2.1 Benchmark de dataset sintético (150 casos)

- 50 casos con respuesta esperada `APPROVED_AUTO` (cobertura clara, carencia cumplida, docs completos).
- 50 casos con respuesta esperada `DOCS_REQUESTED` (falta exactamente un documento conocido).
- 50 casos con respuesta esperada `ESCALATED` (con motivo enum específico).

#### 3.2.2 Métricas de aceptación

| Métrica | Threshold MVP |
|---|---|
| Accuracy de outcome | ≥ 90% |
| Recall de `ESCALATED` | ≥ 95% (preferimos sobre-escalar a sub-escalar) |
| Precision de docs faltantes | ≥ 85% |
| Falsos positivos en `APPROVED_AUTO` | ≤ 2% (un AUTO indebido es grave) |
| Calibration | Casos con confidence < 0.80 deben tener accuracy < 0.70 (señal honesta) |

#### 3.2.3 Tests de propiedad

- `check_waiting_period`: Hypothesis-based, miles de combinaciones de fechas.
- `check_required_docs`: comparaciones de set, casos límite.

#### 3.2.4 Replay grabado

- Tests de integración usan `FakeLLMProvider` con respuestas grabadas (record-replay).
- Tests e2e nightly opcionales contra LLM real.

#### 3.2.5 Drift monitoring (post-MVP)

- Tracking de confidence distribution semanal.
- Si la distribución se desplaza >10%, alerta para re-evaluar.

---

## 4. Technical Specifications

### 4.1 Architecture Overview

**Estilo**: Clean Architecture / Hexagonal en backend Y frontend. Capa de dominio sin dependencias externas. Adapters intercambiables.

#### 4.1.1 Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular (standalone components, signals), Tailwind CSS v4 |
| Backend | Python 3.12+, FastAPI, uv (dep manager), Pydantic v2 |
| IA | LangChain + LangGraph + Anthropic SDK |
| Persistencia (L1) | Notion (vía notion-client) |
| Cache (L2) | Redis local (cachetools en MVP) |
| Object storage (L3) | MinIO local / Cloudflare R2 prod |
| Observabilidad | structlog + Prometheus + Grafana |
| Testing | pytest, hypothesis, Playwright, @testing-library/angular |
| CI/CD | GitHub Actions |
| Deploy | Fly.io (backend), Vercel (frontend) |

#### 4.1.2 Diagrama de bloques

```
[Hospital UI]   [Aseguradora UI]   [Auditor UI]
       └─────────────┬──────────────┘
                     │ HTTPS + JWT
                     ▼
               [FastAPI Gateway]
                     │
        ┌────────────┼─────────────────┐
        ▼            ▼                 ▼
   [LangGraph    [Notion           [LLM Adapters
    Orchestrator] Adapters]         (Anthropic)]
        │            │                 │
        ▼            ▼                 ▼
   [Rule        [7 DBs Notion]    [Anthropic API
    Engine]                        Haiku + Sonnet]
        │
        └─── [Object Storage (PDFs, traces)]
```

#### 4.1.3 Flujo end-to-end

1. Hospital → `POST /api/v1/cases` (informe texto o PDF).
2. Backend crea `AuthorizationCase` en Notion como `PENDIENTE`.
3. LangGraph ejecuta nodos secuenciales con conditional edges.
4. Cada nodo escribe `TraceStep` al estado.
5. Decisión final → caso pasa a `APROBADO_AUTO` / `DOCS_PEDIDOS` / `ESCALADO`.
6. SSE emite eventos en vivo al Hospital UI.
7. Si `ESCALADO`, el caso aparece en bandeja del Auditor.

#### 4.1.4 Estructura de capas (backend)

```
src/pre_autorizacion/
├── domain/               # ZERO deps externas
│   ├── entities/
│   ├── value_objects/
│   ├── ports/
│   └── exceptions.py
├── application/
│   ├── use_cases/
│   └── agent/            # LangGraph state machine
├── infrastructure/
│   ├── persistence/notion/
│   ├── llm/              # adapters de LLMProvider
│   ├── extractors/       # adapters de MedicalReportExtractor
│   ├── decision/         # rule_engine + llm_decision_maker
│   └── storage/
├── interfaces/
│   └── api/v1/           # routers + schemas
└── config/
    ├── settings.py
    └── di.py             # composition root
```

#### 4.1.5 Estructura de capas (frontend)

Cada feature es Clean Architecture en miniatura:
```
features/<feature>/
├── domain/         (entities, value objects, ports)
├── application/    (use cases, facades signal-based)
├── infrastructure/ (HTTP repos, DTOs, mappers, SSE streams)
└── presentation/
    ├── pages/      (smart / containers)
    └── components/ (dumb / presentational)
```

Estado vía **Signals** + **Facade pattern**, no NgRx en MVP. Standalone components, lazy loading por feature.

### 4.2 Modelo de datos

#### 4.2.1 Entidades de dominio

`Patient`, `Insurer`, `Procedure`, `Policy`, `Coverage`, `MedicalReport`, `AuthorizationCase`.

#### 4.2.2 DBs Notion (7)

1. **Pacientes** — Nombre, DNI, FechaNacimiento, Sexo
2. **Aseguradoras** — Nombre, Email
3. **Procedimientos** — CódigoCIE10, Nombre, Categoría, Descripción
4. **Pólizas** — NumeroPoliza, Paciente (rel), Aseguradora (rel), Plan, FechaInicio, FechaFin, Estado
5. **Coberturas** — Póliza (rel), Procedimiento (rel), Cubierto, DíasCarencia, Copago, DocsRequeridos
6. **InformesMédicos** — Paciente (rel), Formato, Contenido, ProcedimientoSolicitado (rel), Diagnóstico, FechaInforme
7. **CasosAutorización** *(agregado central)* — Informe (rel), Póliza (rel), Estado, DecisiónJSON, MotivoEscalamiento, Auditor (person), TrazaAgente, CreatedAt, DecidedAt

PDFs **NO** viven en Notion: van a object storage. Notion solo guarda el link.

### 4.3 Integration Points

#### 4.3.1 APIs externas

- **Notion API** (read/write): 7 DBs.
- **Anthropic API**: Haiku 4.5 (extracción) + Sonnet 4.6 (decisión).
- **Object storage** (S3 protocol): PDFs y traces grandes.

#### 4.3.2 APIs internas (REST v1)

| Path | Quién |
|---|---|
| `/api/v1/auth/*` | login, refresh, me, logout |
| `/api/v1/cases` (POST/GET) | Hospital crea, todos listan filtrado por rol |
| `/api/v1/cases/{id}` | Detalle |
| `/api/v1/cases/{id}/trace` | Trace completo |
| `/api/v1/cases/{id}/resolve` | Auditor decide |
| `/api/v1/cases/{id}/events` | **SSE stream** |
| `/api/v1/policies/*` | CRUD pólizas |
| `/api/v1/procedures` | Búsqueda catálogo |
| `/health`, `/ready` | Probes |

#### 4.3.3 Sincronización de schemas

FastAPI genera `/openapi.json`. Frontend genera TS types con `openapi-typescript`. **Una sola fuente de verdad** — cero drift.

### 4.4 Security & Privacy

#### 4.4.1 Autenticación

- JWT: `access_token` (15 min) + `refresh_token` (7 días, httpOnly cookie).
- Claim `role`: `hospital | insurer | auditor`.
- 3 usuarios sembrados en MVP. Producción → Auth0 / Keycloak.

#### 4.4.2 Autorización

- RBAC con `Depends(require_role(...))` en cada router FastAPI.
- Casos visibles solo para hospital creador, aseguradora dueña, y auditores.

#### 4.4.3 Privacidad

- **MVP**: datos sintéticos exclusivamente. **NUNCA** datos reales de pacientes en repo, demos, ni Notion.
- **Producción real (v2.0)**: requiere HIPAA / Habeas Data compliance. Notion **NO** es BAA-compliant. Migración obligatoria a almacenamiento conforme antes de procesar PHI real. La arquitectura Port-Adapter permite el cambio **sin reescritura del dominio**.
- Logs: redacción automática de DNI/nombres en non-debug.
- TLS obligatorio en todas las comunicaciones.
- Secrets en `.env` (dev), Doppler / 1Password (producción). **Nunca** commiteados.

#### 4.4.4 Auditoría

- 100% de las decisiones tienen `TrazaAgente` persistente con: inputs, outputs, modelo usado, tokens, duración, errores, confidence.
- `trace_id` correlacionable backend ↔ frontend para soporte/debugging.
- Logs estructurados con structlog.

### 4.5 Observabilidad

#### 4.5.1 Logging
- structlog en formato JSON.
- `trace_id` (ULID time-orderable) propagado vía middleware.
- Redaction automática de PII en non-debug.

#### 4.5.2 Métricas (Prometheus)
- Latencia p50/p95/p99 por endpoint y por nodo del grafo.
- Distribución de outcomes (% AUTO/DOCS/ESCALATED).
- Distribución de confidence score.
- Tokens y costo por caso.
- Llamadas a Notion + latencia + tasa de error.

#### 4.5.3 Tracing
- MVP: `trace_id` correlacionado en logs.
- Producción: OpenTelemetry (se enchufa después sin reescritura).

### 4.6 Testing

Pirámide:
- **Unit** (cientos): `domain/`, `value_objects/`, `rule_engine/`. Sin I/O. Run en cada save (TDD strict).
- **Integration** (~50): adapters contra mocks (`respx`, `FakeLLMProvider`). Run en cada PR.
- **e2e** (~10): Playwright + Notion-test-DB + LLM real. Run nightly o pre-release.

Coverage gate:
- `domain/` + `application/`: **≥ 90%**
- `infrastructure/`: ≥ 70%
- `interfaces/`: ≥ 60%

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout

| Fase | Duración | Outcome |
|---|---|---|
| **0 — Setup** | 1-2 días | Repo, uv, Angular, docker-compose, 7 DBs Notion creadas, CI básico. |
| **1 — Domain core** | 3-4 días | Entidades, ports, rule engine. TDD estricto. ≥100 unit tests verdes. |
| **2 — Backend skeleton** | 2-3 días | FastAPI con auth, Notion adapters (read), DI, endpoint POST `/cases` sin agente. |
| **3 — Agente LangGraph** | 4-5 días | Grafo completo, LLM adapters, FakeLLMProvider, extractores texto/PDF, persistencia de traces. |
| **4 — Frontend MVP** | 4-5 días | 3 layouts, feature `authorization-cases` completa, SSE consumer, agent-trace-viewer, login. |
| **5 — Demo data + e2e** | 2 días | Seed scripts, 3 fixtures coherentes (texto + PDF), Playwright tests, demo script ensayado. |
| **MVP total** | **~3 semanas** | **Demo lista** |
| **6 — v1.0 hardening** | 1-2 sem | Prometheus + Grafana + OTel + tests de propiedad + multi-procedimiento (3×3=9 casos). |
| **7 — v1.1 piloto** | 3-4 sem | Auth real, migración Notion → Postgres detrás del mismo port, vista del paciente, audit log persistente. |
| **8 — v2.0 producto real** | meses | HIPAA compliance, BAA con vendors, multi-tenant, integración HL7/FHIR, drift monitoring del modelo. |

### 5.2 Technical Risks

| Riesgo | Severidad | Probabilidad | Mitigación |
|---|---|---|---|
| Latencia de Notion API (200-500ms × 4-7 calls) | Alta | Alta | L2 cache (Redis) + warm-up del catálogo + rate-limit-aware client |
| Vision API mala extracción de PDFs escaneados | Media | Alta | Falla → ESCALATE con razón clara. No intentar OCR creativo. |
| Costo del LLM crece linealmente con volumen | Media | Media | Modelo híbrido (~60% reducción). Métrica cost-per-case visible. |
| Drift del modelo entre versiones de Claude | Alta | Baja-Media | Pin de versión en Settings. Re-evaluación benchmark antes de upgrade. |
| Confidence score mal calibrado | Alta | Media | Threshold conservador (0.80). Human-in-the-loop por diseño. Calibration tests. |
| Notion downtime | Media | Baja | Circuit breaker. Health check en `/ready`. |
| **Notion no es BAA-compliant** | **Crítica (prod)** | **Certeza** | NO procesar PHI hasta migrar a almacenamiento HIPAA-compliant en v2.0. |
| Auto-aprobación errónea (falso positivo) | Crítica | Baja | Threshold alto + rule engine determinístico. Solo aprobar cuando todo es claro. |
| Auto-rechazo accidental | Crítica | **Cero por diseño** | El grafo NO tiene rama de auto-rechazo. |
| Filtración de PHI en logs | Crítica | Media | Redaction automática. Tests de redaction. Logs review en CI. |

### 5.3 Open Questions

- Modelo de embeddings para fallback de matching (`voyage-3-lite` vs `text-embedding-3-small`). Decisión de implementación.
- Estrategia de retry del LLM (intentos, exponential backoff). Definir en Phase 3.
- TTL del cache L2 de pólizas (5 min vs lifetime-de-caso). A medir en MVP.

---

## Apéndice A — Glosario

| Término | Definición |
|---|---|
| **Carencia** | Período mínimo desde el inicio de la póliza durante el cual ciertos procedimientos no están cubiertos. Modelado como `Coverage.diasCarencia`. |
| **CIE-10** | Clasificación Internacional de Enfermedades, 10ª revisión. |
| **HIPAA** | Health Insurance Portability and Accountability Act (regulación US para datos médicos). |
| **PHI** | Protected Health Information. Datos médicos identificables. |
| **BAA** | Business Associate Agreement (contrato requerido para procesar PHI con un vendor). |
| **SSE** | Server-Sent Events. Stream HTTP unidireccional servidor → cliente. |
| **LangGraph** | Framework de orquestación basado en máquinas de estados, ecosistema LangChain. |
| **Port-Adapter** | Patrón Hexagonal donde el dominio define interfaces (ports) y la infraestructura provee implementaciones (adapters). |

## Apéndice B — Referencias

- Repo: https://github.com/lesquel/pre-autorizacion-quirurgica
- LangGraph: https://langchain-ai.github.io/langgraph/
- FastAPI: https://fastapi.tiangolo.com/
- Clean Architecture (Robert C. Martin)
- Hexagonal Architecture (Alistair Cockburn)
- Notion API: https://developers.notion.com/

---

## Aprobaciones

- [x] Arquitectura general
- [x] Stack tecnológico
- [x] Modelo de datos
- [x] Roadmap por fases
- [x] Criterios de aceptación

**Próximo paso**: Fase 0 — setup del proyecto.
