# PRD — Agente de Pre-Autorización Quirúrgica en Tiempo Real

| Campo | Valor |
|---|---|
| **Versión** | 1.1 |
| **Fecha** | 2026-05-06 |
| **Estado** | Aprobado — listo para implementación (v1 / hackathon) |
| **Owner** | lesquel |
| **Repositorio** | https://github.com/lesquel/pre-autorizacion-quirurgica |

> **Cambios v1.1 respecto a v1.0:**
> - LLM default: **DeepSeek** (`deepseek-chat`) reemplaza al hybrid Anthropic. Adapters preservados para swap de proveedor.
> - Vision separada en su propio port (`VisionExtractor`) para PDFs.
> - Decisión del agente expone explícitamente `rationale`, `confidence` y `evidence`.
> - Storage de archivos: **filesystem local del servidor** detrás del port `FileStorage` (no S3/MinIO en v1).
> - Eliminadas para v1: Evaluation Strategy (3.2), Observabilidad (4.5), Testing (4.6) y gates relacionados. Se reintroducen post-v1.

---

## 1. Executive Summary

### 1.1 Problem Statement

Los pacientes deben esperar **horas o días** para que su seguro autorice una cirugía. El proceso manual implica revisión humana de informes médicos contra pólizas, validación de carencias y verificación de documentos — todo en serie, todo lento, todo bloqueando atención médica que muchas veces es tiempo-crítica.

### 1.2 Proposed Solution

Un agente IA que recibe el informe médico digital (Hospital) y la póliza del paciente (Aseguradora) desde una base de datos en Notion, analiza cobertura, carencia y documentación de forma instantánea, y emite uno de tres desenlaces: pre-aprobación automática, solicitud de documentos faltantes, o escalamiento a auditor médico humano.

**El sistema NUNCA auto-rechaza** — todo rechazo escala a juicio humano por responsabilidad legal y clínica.

Toda decisión expone tres campos auditables: `rationale` (por qué decidió eso), `confidence` (qué tan seguro está) y `evidence` (citas concretas al informe y a la póliza usadas como base).

### 1.3 Success Criteria (KPIs)

| # | KPI | Threshold |
|---|---|---|
| 1 | Latencia de respuesta | ≤ 10s (texto) / ≤ 20s (PDF) como objetivo de diseño. |
| 2 | Tasa de auto-resolución | ≥ 60% de casos resueltos sin intervención humana en la demo. |
| 3 | Decisión justificada | 100% de las decisiones incluyen `rationale` + `confidence` (0..1) + `evidence` (citas al informe y a la cobertura). |
| 4 | Seguridad clínica | **0% de rechazos automáticos**. Todo rechazo pasa por humano. |
| 5 | Cost-per-case | ≤ $0.02 USD por caso (DeepSeek ~10× más barato que un stack Claude puro). |

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
- Necesita ver el `rationale`, `confidence` y `evidence` del agente, además del trace paso a paso.
- Resuelve casos manualmente (aprobar/rechazar) con justificación clínica.
- Necesita filtros por urgencia, fecha, motivo de escalamiento.

### 2.2 User Stories

#### Hospital
- **US-H1**: Como personal del hospital, quiero subir un informe médico (texto o PDF) y recibir pre-autorización en menos de 20 segundos, para no demorar la programación quirúrgica.
- **US-H2**: Como personal del hospital, quiero ver en vivo qué pasos ejecuta el agente, para saber cuánto falta y qué está validando.
- **US-H3**: Como personal del hospital, quiero recibir una lista clara de documentos faltantes cuando aplica, sin tener que adivinar qué pide la aseguradora.
- **US-H4**: Como personal del hospital, quiero ver la justificación y el nivel de confianza de la decisión, para entender por qué se aprobó, se pidieron documentos o se escaló.

#### Aseguradora
- **US-A1**: Como operador de la aseguradora, quiero crear y editar pólizas con sus coberturas, carencias y docs requeridos por procedimiento, para que el agente tenga las reglas correctas.
- **US-A2**: Como operador de la aseguradora, quiero ver un dashboard con la distribución de outcomes y casos por hospital, para detectar anomalías.

#### Auditor
- **US-AU1**: Como auditor médico, quiero ver una bandeja con todos los casos escalados ordenados por urgencia clínica.
- **US-AU2**: Como auditor médico, quiero leer el `rationale` del agente, ver su `confidence` y revisar la `evidence` (qué citó del informe y de la póliza), para evaluar la calidad de su razonamiento.
- **US-AU3**: Como auditor médico, quiero resolver el caso (aprobar/rechazar) con mi justificación textual, que queda en el record permanente.

### 2.3 Acceptance Criteria (v1)

#### 2.3.1 Hospital — submission
- [ ] Puede subir informe en texto libre o PDF (≤ 10 MB).
- [ ] Recibe ID del caso inmediatamente (HTTP 202 Accepted).
- [ ] Ve actualizaciones del agente en vivo vía Server-Sent Events (al menos: extracción → matching → validación → decisión).
- [ ] Recibe el resultado final con: `outcome`, `mensaje` (español natural), `rationale`, `confidence`, `evidence[]`, `missing_docs[]` (si aplica), `escalation_reason` (si aplica).

#### 2.3.2 Aseguradora — gestión de pólizas
- [ ] CRUD completo de pólizas (número, paciente, plan, fechas, estado).
- [ ] Reemplazo masivo de coberturas por póliza (procedimiento + cubierto + carencia + docs requeridos).
- [ ] Lista paginada con filtros (estado, fecha, paciente).

#### 2.3.3 Auditor — bandeja y resolución
- [ ] Bandeja con casos escalados, ordenados por fecha o motivo de escalamiento.
- [ ] Vista de detalle del caso con: informe original, póliza relevante, **`rationale`**, **`confidence`**, **`evidence`**, trace completo del agente, motivo de escalamiento.
- [ ] Acción de resolver: outcome (APPROVED/REJECTED) + mensaje + razonamiento + adjuntos opcionales.
- [ ] Estado del caso pasa a `DECIDIDO` y el hospital lo ve vía SSE.

#### 2.3.4 Calidad del sistema (v1)
- [ ] Latencia objetivo p95 ≤ 10s (texto) / ≤ 20s (PDF) — validado por demo, sin gate automatizado.
- [ ] Cada respuesta (éxito o error) incluye `trace_id` para correlación manual con logs.
- [ ] Errores siguen formato consistente (RFC 7807 sugerido, no obligatorio).
- [ ] Demo de 3 minutos con los 3 desenlaces ensayada y reproducible.

### 2.4 Non-Goals (NO en v1)

- ❌ Vista del paciente (v1.1).
- ❌ Integración HL7/FHIR. Recepción solo texto/PDF.
- ❌ Soporte multi-hospital ni multi-aseguradora. UN hospital, UNA aseguradora.
- ❌ **Rechazo automático bajo ninguna circunstancia.** Todo rechazo escala a auditor.
- ❌ OCR avanzado para PDFs manuscritos. Si el vision provider no extrae con calidad, escala.
- ❌ Object storage en cloud (S3 / MinIO / R2). **PDFs viven en el filesystem del servidor en v1.**
- ❌ Métricas, dashboards, observabilidad formal (Prometheus / Grafana / OTel).
- ❌ Suite de tests, gates de coverage, evaluation benchmark, replay grabado.
- ❌ Hybrid LLM (extractor + decision-maker en modelos distintos). Single-model en v1.
- ❌ Integración con sistemas hospitalarios reales (HIS/EHR).
- ❌ Notificaciones push/email/SMS. La UI muestra estado en vivo vía SSE.
- ❌ Internacionalización. Spanish-only.
- ❌ Procesamiento batch / asíncrono pesado. Un caso a la vez.

---

## 3. AI System Requirements

### 3.1 Tool Requirements

#### 3.1.1 Modelos LLM (estrategia simplificada para v1)

| Componente | Default | Razón |
|---|---|---|
| **Texto (extracción + decisión)** | DeepSeek `deepseek-chat` | Bajo costo, latencia razonable, soporte de structured output, API compatible con OpenAI. |
| **Vision (PDFs / imágenes)** | Gemini `gemini-2.5-flash` (candidato) vía `VisionExtractor` port | DeepSeek no acepta imágenes. Port separado permite enchufar cualquier vision provider sin tocar el dominio. |

**Single-model para texto en v1**: el mismo `deepseek-chat` se usa tanto para extracción de entidades clínicas como para la decisión final. Hybrid (e.g., `deepseek-chat` + `deepseek-reasoner`) es upgrade post-v1 vía cambio de Settings — sin reescritura.

#### 3.1.2 Frameworks IA

- **LangChain** (`langchain-core`, `langchain-openai`): clientes LLM, tools, memoria.
- **LangGraph**: orquestación del agente como máquina de estados explícita. Auditable y testeable, requisito para dominio médico-legal.
- DeepSeek se consume vía la SDK `openai` apuntando a `https://api.deepseek.com` (compatible). El base URL y la API key viven en `.env`.

#### 3.1.3 Nodos del grafo (agente)

| # | Nodo | Tipo | Modelo |
|---|---|---|---|
| 1 | `extract_report` | LLM (texto) o Vision (PDF) | DeepSeek (texto) / Vision adapter (PDF) |
| 2 | `match_procedure` | Rule + embeddings (fallback) | — |
| 3 | `load_policy_coverage` | Notion API | — |
| 4 | `check_waiting_period` | Determinístico (date math) | — |
| 5 | `check_required_docs` | Determinístico (set diff) | — |
| 6 | `make_decision` | LLM con structured output | DeepSeek |
| 7 | `persist_case` | Notion API + FileStorage | — |

**El agente NUNCA auto-rechaza por diseño**: el grafo no tiene rama `REJECTED_AUTO`. Todos los caminos negativos van a `ESCALATED`.

**Contract de `make_decision`** — siempre devuelve un objeto estructurado validado por Pydantic:

```json
{
  "outcome": "APPROVED_AUTO" | "DOCS_REQUESTED" | "ESCALATED",
  "rationale": "string — explicación en español natural de por qué llegó a esta decisión, citando los hechos relevantes del informe y de la cobertura",
  "confidence": 0.0..1.0,
  "evidence": [
    { "source": "report" | "policy", "field": "string", "quote": "string" }
  ],
  "missing_docs": ["string"],
  "escalation_reason": "string"
}
```

**Gate determinístico post-LLM**: si `confidence < 0.80`, el outcome se fuerza a `ESCALATED` con `escalation_reason = "low_confidence"`, sin importar lo que haya elegido el LLM. Esta lógica vive en el rule engine, no en el prompt — el LLM no puede saltarse el gate.

#### 3.1.4 Patrón de desacople LLM y Vision

Dos puertos independientes en el dominio:

- **`LLMProvider`** (port): abstrae el modelo de texto.
  - Adapters: `DeepSeekLLMAdapter` (default), `OpenAILLMAdapter`, `GeminiLLMAdapter`, `AnthropicLLMAdapter`.
- **`VisionExtractor`** (port): abstrae extracción desde PDFs / imágenes.
  - Adapters: `GeminiVisionAdapter` (default candidato), `AnthropicVisionAdapter`, `OpenAIVisionAdapter`.

Encima de esos puertos de bajo nivel viven puertos de alto nivel (estrategias):

- `MedicalReportExtractor`, `AuthorizationDecisionMaker`, `ResponseGenerator` — usan `LLMProvider` para texto.
- `PdfReportExtractor` — usa `VisionExtractor` cuando el input es PDF.

Strategy via Pydantic Settings + Dependency Injection en FastAPI:

```python
class AISettings(BaseSettings):
    text_provider: Literal["deepseek", "openai", "gemini", "anthropic"] = "deepseek"
    text_model: str = "deepseek-chat"
    text_base_url: str = "https://api.deepseek.com"

    vision_provider: Literal["gemini", "anthropic", "openai"] = "gemini"
    vision_model: str = "gemini-2.5-flash"

    confidence_threshold: float = 0.80
```

> **Sección 3.2 (Evaluation Strategy) eliminada en v1.** Se reintroduce post-v1 cuando exista budget para benchmark dataset, replay tests y métricas de calibration.

---

## 4. Technical Specifications

### 4.1 Architecture Overview

**Estilo backend**: **Vertical slicing + Clean Architecture**. Cada feature es un slice con sus propias capas (`domain/`, `application/`, `infrastructure/`, `api/`). Recursos transversales (LLM, vision, storage, Notion client base, middlewares) viven en `shared/`. Capas de dominio sin dependencias externas, adapters intercambiables.

**Estilo frontend**: idéntico — slicing por feature con clean arch interna (ver 4.1.5). Backend y frontend simétricos.

#### 4.1.1 Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular (standalone components, signals), Tailwind CSS v4 |
| Backend | Python 3.12+, FastAPI, uv (dep manager), Pydantic v2 |
| IA — texto | LangChain + LangGraph + `openai` SDK apuntando a DeepSeek |
| IA — vision | Adapter intercambiable (Gemini default) |
| Persistencia (datos) | Notion (vía `notion-client`) |
| Cache | `cachetools` en proceso (v1) |
| Storage de archivos | **Filesystem local del servidor** (`var/uploads/<case_id>/...`) detrás del port `FileStorage` |
| CI/CD | GitHub Actions (lint + build, sin gates de tests en v1) |
| Deploy | Fly.io (backend), Vercel (frontend) |

> Filas de observabilidad y testing eliminadas para v1.

#### 4.1.2 Diagrama de bloques

```
[Hospital UI]   [Aseguradora UI]   [Auditor UI]
       └─────────────┬──────────────┘
                     │ HTTPS + JWT
                     ▼
               [FastAPI Gateway]
                     │
        ┌────────────┼─────────────────────────────┐
        ▼            ▼                             ▼
   [LangGraph    [Notion              [LLM Adapter: DeepSeek (default)]
    Orchestrator] Adapters]            [Vision Adapter: Gemini (default)]
        │            │                             │
        ▼            ▼                             ▼
   [Rule        [7 DBs Notion]          [DeepSeek API + Vision API]
    Engine]
        │
        └─── [FileStorage port → filesystem local del servidor]
```

#### 4.1.3 Flujo end-to-end

1. Hospital → `POST /api/v1/cases` (informe texto o PDF).
2. Si hay PDF, backend lo persiste vía `FileStorage` adapter en `var/uploads/<case_id>/<filename>`.
3. Backend crea `AuthorizationCase` en Notion como `PENDIENTE`, con referencia al path del archivo.
4. LangGraph ejecuta nodos secuenciales con conditional edges.
5. Cada nodo escribe `TraceStep` al estado.
6. `make_decision` produce `AgentDecision` (outcome + rationale + confidence + evidence).
7. Rule engine aplica el gate de confidence; outcome final es `APROBADO_AUTO` / `DOCS_PEDIDOS` / `ESCALADO`.
8. SSE emite eventos en vivo al Hospital UI a lo largo del flujo.
9. Si `ESCALADO`, el caso aparece en bandeja del Auditor con `rationale`, `confidence` y `evidence` visibles.

#### 4.1.4 Estructura de capas (backend) — Slicing + Clean Arch

```
src/pre_autorizacion/
├── features/
│   ├── authorization_cases/        # crear caso, listar, detalle, resolver, SSE
│   │   ├── domain/                 # entidades del slice + ports específicos
│   │   ├── application/            # use cases, agente LangGraph del slice
│   │   ├── infrastructure/         # repos Notion del slice, FileStorage usage
│   │   └── api/                    # routers FastAPI + schemas
│   ├── policies/                   # CRUD pólizas y coberturas
│   │   └── (domain/ application/ infrastructure/ api/)
│   ├── procedures/                 # catálogo de procedimientos
│   │   └── (...)
│   └── auth/                       # login, refresh, RBAC
│       └── (...)
├── shared/
│   ├── domain/                     # value objects compartidos, exceptions base
│   ├── llm/                        # LLMProvider port + adapters
│   │   ├── deepseek_adapter.py     # default
│   │   ├── openai_adapter.py
│   │   ├── gemini_adapter.py
│   │   └── anthropic_adapter.py
│   ├── vision/                     # VisionExtractor port + adapters
│   │   ├── gemini_adapter.py       # default candidato
│   │   ├── anthropic_adapter.py
│   │   └── openai_adapter.py
│   ├── storage/                    # FileStorage port + LocalFsAdapter
│   ├── notion/                     # NotionClient base
│   └── api/                        # middlewares, error handlers, SSE base
└── config/
    ├── settings.py                 # Pydantic Settings (.env-driven)
    └── di.py                       # composition root
```

Reglas de import entre slices:
- Un feature solo importa de su propio slice o de `shared/`.
- Dependencias entre features se expresan vía ports en `domain/` y se resuelven en `config/di.py`.
- `shared/llm/` y `shared/vision/` exponen ports en su `__init__.py` siguiendo la regla de re-exports a nivel de paquete.

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

`Patient`, `Insurer`, `Procedure`, `Policy`, `Coverage`, `MedicalReport`, `AuthorizationCase`, `AgentDecision`.

`AgentDecision` (value object):
```
outcome:            APPROVED_AUTO | DOCS_REQUESTED | ESCALATED
rationale:          str
confidence:         float in [0.0, 1.0]
evidence:           list[Evidence]
missing_docs:       list[str] | None
escalation_reason:  str | None
```

`Evidence` (value object): `source` (`"report"` | `"policy"`), `field` (str), `quote` (str).

#### 4.2.2 DBs Notion (7)

1. **Pacientes** — Nombre, DNI, FechaNacimiento, Sexo
2. **Aseguradoras** — Nombre, Email
3. **Procedimientos** — CódigoCIE10, Nombre, Categoría, Descripción
4. **Pólizas** — NumeroPoliza, Paciente (rel), Aseguradora (rel), Plan, FechaInicio, FechaFin, Estado
5. **Coberturas** — Póliza (rel), Procedimiento (rel), Cubierto, DíasCarencia, Copago, DocsRequeridos
6. **InformesMédicos** — Paciente (rel), Formato, Contenido, ProcedimientoSolicitado (rel), Diagnóstico, FechaInforme, ArchivoPath (si aplica)
7. **CasosAutorización** *(agregado central)* — Informe (rel), Póliza (rel), Estado, **Outcome**, **Rationale** (rich_text), **Confidence** (number), **Evidence** (rich_text JSON), MotivoEscalamiento, Auditor (person), TrazaAgente (rich_text JSON), CreatedAt, DecidedAt

PDFs **NO** viven en Notion ni en cloud storage. Viven en el **filesystem del servidor** bajo `var/uploads/<case_id>/<filename>`. Notion guarda solo el path relativo. La descarga pasa por endpoint autenticado que valida RBAC antes de servir el archivo.

### 4.3 Integration Points

#### 4.3.1 APIs externas

- **Notion API** (read/write): 7 DBs.
- **DeepSeek API** (vía `openai` SDK con `base_url=https://api.deepseek.com`): `deepseek-chat` para extracción texto + decisión.
- **Vision API** (Gemini default vía adapter): extracción desde PDFs.

#### 4.3.2 APIs internas (REST v1)

| Path | Quién |
|---|---|
| `/api/v1/auth/*` | login, refresh, me, logout |
| `/api/v1/cases` (POST/GET) | Hospital crea, todos listan filtrado por rol |
| `/api/v1/cases/{id}` | Detalle (incluye `rationale`, `confidence`, `evidence`) |
| `/api/v1/cases/{id}/trace` | Trace completo |
| `/api/v1/cases/{id}/resolve` | Auditor decide |
| `/api/v1/cases/{id}/events` | **SSE stream** |
| `/api/v1/cases/{id}/files/{filename}` | Descarga autenticada de archivos servidos por `FileStorage` |
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
- Endpoint de descarga de archivos valida que el usuario tenga acceso al caso al que pertenece el archivo, y bloquea path traversal.

#### 4.4.3 Privacidad

- **v1**: datos sintéticos exclusivamente. **NUNCA** datos reales de pacientes en repo, demos, ni Notion.
- **Producción real (v2.0)**: requiere HIPAA / Habeas Data compliance. Notion **NO** es BAA-compliant; el filesystem local del servidor **tampoco** lo es por sí solo. Migración obligatoria a almacenamiento conforme antes de procesar PHI real. La arquitectura Port-Adapter permite el cambio (`FileStorage` → S3 con BAA, Notion → DB clínica conforme) **sin reescritura del dominio**.
- TLS obligatorio en todas las comunicaciones.
- Secrets en `.env` (dev), Doppler / 1Password (producción). **Nunca** commiteados.
- Filesystem local: directorio de uploads fuera del repo, permisos restringidos al usuario del proceso, validación estricta de nombres de archivo (UUID generado server-side, no nombre del cliente).

#### 4.4.4 Auditoría

- 100% de las decisiones tienen `AgentDecision` (rationale, confidence, evidence) + `TrazaAgente` persistente con: inputs, outputs, modelo usado, tokens, duración, errores.
- `trace_id` correlacionable backend ↔ frontend para soporte/debugging.

> **Sección 4.5 (Observabilidad) y 4.6 (Testing) eliminadas en v1.** Se reintroducen post-v1 con Prometheus + Grafana + OTel y la pirámide de tests con coverage gates.

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout (v1 / hackathon)

| Fase | Duración | Outcome |
|---|---|---|
| **0 — Setup** | 1-2 días | Repo, uv, Angular, 7 DBs Notion creadas, CI básico (lint + build). |
| **1 — Domain core** | 2-3 días | Entidades por slice, ports (`LLMProvider`, `VisionExtractor`, `FileStorage`), rule engine, `AgentDecision` value object. |
| **2 — Backend skeleton** | 2-3 días | FastAPI con auth, Notion adapters (read), DI, endpoint POST `/cases` sin agente, `LocalFsAdapter` para archivos. |
| **3 — Agente LangGraph** | 4-5 días | Grafo completo, `DeepSeekLLMAdapter`, `GeminiVisionAdapter`, structured output del decision-maker, gate de confidence, persistencia. |
| **4 — Frontend MVP** | 4-5 días | 3 layouts, feature `authorization-cases` completa, SSE consumer, viewer de `rationale` + `confidence` + `evidence` + trace, login. |
| **5 — Demo data + ensayo** | 1-2 días | Seed scripts, 3 fixtures coherentes (texto + PDF), demo script ensayado y reproducible. |
| **v1 total** | **~2-3 semanas** | **Demo lista** |

**Post-v1** (no en este PRD): suite de tests + coverage gates, observabilidad (Prometheus + Grafana + OTel), evaluation benchmark con 150 casos sintéticos, hybrid LLM strategy (`deepseek-chat` + `deepseek-reasoner`), migración de `FileStorage` a S3/MinIO, vista del paciente, auth real (Auth0/Keycloak), multi-tenant, integración HL7/FHIR, drift monitoring.

### 5.2 Technical Risks (v1)

| Riesgo | Severidad | Probabilidad | Mitigación |
|---|---|---|---|
| Latencia de Notion API (200-500ms × 4-7 calls) | Alta | Alta | `cachetools` en proceso + warm-up del catálogo + rate-limit-aware client |
| Vision API mala extracción de PDFs escaneados | Media | Alta | Falla → ESCALATE con razón clara. No intentar OCR creativo. |
| Costo del LLM crece linealmente con volumen | Baja | Media | DeepSeek default ~10× más barato que Claude. Cost-per-case visible en logs. |
| Drift entre versiones de DeepSeek | Media | Baja-Media | Pin de modelo en Settings. |
| Confidence score mal calibrado | Alta | Media | Threshold conservador (0.80) + escalamiento forzado bajo umbral + Human-in-the-loop por diseño. |
| Notion downtime | Media | Baja | Health check en `/ready`. |
| **Notion / filesystem local no son BAA-compliant** | **Crítica (prod)** | **Certeza** | NO procesar PHI hasta migrar a almacenamiento HIPAA-compliant en v2.0. |
| Auto-aprobación errónea (falso positivo) | Crítica | Baja | Threshold alto + rule engine determinístico. Solo aprobar cuando todo es claro. |
| Auto-rechazo accidental | Crítica | **Cero por diseño** | El grafo NO tiene rama de auto-rechazo. |
| Pérdida de archivos por filesystem local | Media | Media | Backup nightly del directorio de uploads. Migración a S3 prevista post-v1. |
| Path traversal / file enumeration | Alta | Baja | Nombres de archivo generados server-side (UUID), validación estricta en endpoint de descarga, RBAC por caso. |

### 5.3 Open Questions

- Embeddings para fallback de matching (`voyage-3-lite` vs `text-embedding-3-small`). Decisión de implementación.
- Estrategia de retry del LLM (intentos, exponential backoff). Definir en Phase 3.
- TTL del cache de pólizas (5 min vs lifetime-de-caso). A medir en MVP.
- ¿`gemini-2.5-flash` vs `gemini-2.5-pro` como vision default? Probar ambos en Phase 3 con un par de PDFs reales.

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
| **Vertical slicing** | Organización del código por feature/caso de uso en el nivel superior, donde cada slice contiene sus propias capas de dominio, aplicación, infra y API. |
| **AgentDecision** | Value object que el agente emite con `outcome`, `rationale`, `confidence` y `evidence`. Contrato auditable de toda decisión. |

## Apéndice B — Referencias

- Repo: https://github.com/lesquel/pre-autorizacion-quirurgica
- LangGraph: https://langchain-ai.github.io/langgraph/
- FastAPI: https://fastapi.tiangolo.com/
- DeepSeek API (OpenAI-compatible): https://api-docs.deepseek.com/
- Clean Architecture (Robert C. Martin)
- Hexagonal Architecture (Alistair Cockburn)
- Vertical Slice Architecture (Jimmy Bogard)
- Notion API: https://developers.notion.com/

---

## Aprobaciones (v1.1)

- [x] Arquitectura general (slicing + clean arch)
- [x] Stack tecnológico (DeepSeek default, vision adapter separado, filesystem local detrás de port)
- [x] Modelo de datos (incluye `AgentDecision` con rationale/confidence/evidence)
- [x] Roadmap por fases (v1 sin testing/observabilidad)
- [x] Criterios de aceptación

**Próximo paso**: escribir el plan de implementación (writing-plans) y comenzar Fase 0 — setup del proyecto.
