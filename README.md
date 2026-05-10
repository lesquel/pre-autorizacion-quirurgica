# Pre-Autorización Quirúrgica

Agente IA que pre-autoriza cirugías en segundos en lugar de días. Recibe el
informe médico del hospital + la póliza del paciente, valida cobertura,
carencia y documentación, y emite **uno de tres outcomes**:

- `APPROVED_AUTO` — pre-aprobado automáticamente.
- `NEEDS_DOCS` — falta documentación, le pide al hospital lo específico.
- `ESCALATED` — escala a auditor médico humano con rationale + evidencia.

**El agente NUNCA auto-rechaza por diseño** (PRD §3.1.3). Si hay duda,
escala. Toda decisión incluye rationale en lenguaje natural y citas
literales del informe y la póliza para auditoría legal.

## Demo live

- **Frontend (Vercel)** → https://pre-autorizacion-quirurgica.vercel.app
- **Backend (Render)** → https://pre-autorizacion-quirurgica.onrender.com
- **OpenAPI / Swagger** → https://pre-autorizacion-quirurgica.onrender.com/docs

Usuarios demo (un click):

| Rol | Email | Password |
|---|---|---|
| Hospital | `hospital@demo.com` | `hospital` |
| Aseguradora | `insurer@demo.com` | `insurer` |
| Auditor | `auditor@demo.com` | `auditor` |

> Nota: el backend está en plan free de Render — la primera request tras
> inactividad despierta el container (~50s). Después responde normal.

## Stack

**Backend**: Python 3.13 · FastAPI · uv · Pydantic v2 · LangChain + LangGraph
· DeepSeek (texto) · Gemini Vision (PDFs) · Notion (persistencia) · mypy strict
· pytest

**Frontend**: Angular 21 standalone · Signals · Tailwind v4 · driver.js (tour)
· vitest

**Arquitectura**: Vertical Slicing + Clean Architecture (mirror frontend/backend).
Hexagonal: domain con `@dataclass(frozen=True, slots=True)`, ports `abc.ABC`,
Pydantic solo en boundaries (`api/schemas`, `config/settings`).

**Deploy**: Docker multi-stage (backend, genérico Railway/Fly/Render/Cloud Run) ·
Vercel (frontend, build-time env injection vía `inject-env.mjs`).

## Quick start local

```sh
# clonar
git clone https://github.com/lesquel/pre-autorizacion-quirurgica.git
cd pre-autorizacion-quirurgica

# backend (terminal 1)
cd backend
cp .env.example .env       # editá APIs keys + JWT_SECRET
uv sync
uv run uvicorn pre_autorizacion.main:app --reload

# frontend (terminal 2)
cd frontend
npm ci
npm start
```

Backend: http://localhost:8000/docs · Frontend: http://localhost:4200

Hay también un `Makefile` en la raíz con `make backend-dev`, `make frontend-dev`,
`make test`, etc. (`make help` para la lista).

## Estructura

```
.
├── backend/                    # FastAPI + LangGraph + adapters Notion
│   ├── src/pre_autorizacion/
│   │   ├── config/             # Settings + DI composition root
│   │   ├── features/           # Vertical slices (auth, patients, cases, policies, ...)
│   │   │   └── <feature>/{domain,application,infrastructure,api}/
│   │   └── shared/             # Cross-cutting: domain base, notion client, LLM ports
│   ├── tests/{unit,integration}/
│   ├── Dockerfile              # Multi-stage uv + python:3.13-slim
│   └── pyproject.toml
├── frontend/                   # Angular 21 standalone
│   ├── src/app/
│   │   ├── core/               # Services + layouts + topbar/sidenav
│   │   ├── features/<x>/{domain,application,infrastructure,presentation}/
│   │   └── shared/             # UI components, helpers, api schema generado
│   ├── scripts/inject-env.mjs  # Inyecta BACKEND_API_URL en build-time
│   └── vercel.json
├── docs/
│   ├── specs/2026-05-06-pre-autorizacion-quirurgica-prd.md  # PRD oficial
│   ├── notion-campos-recomendados.md
│   └── casos-prueba/           # 5 casos de prueba con resultado esperado
├── e2e/                        # Playwright cross-browser
├── .atl/skill-registry.md      # Standards del proyecto (para agentes IA)
├── DEPLOY.md                   # Guía deploy backend + frontend
└── Makefile
```

## Documentos

- [**PRD**](docs/specs/2026-05-06-pre-autorizacion-quirurgica-prd.md) — fuente
  de verdad del producto (487 líneas: dominio, agente, RBAC, NotionDB).
- [**DEPLOY.md**](DEPLOY.md) — Docker + Vercel + env vars + CORS.
- [**backend/README.md**](backend/README.md) — setup local, env vars, troubleshooting.
- [**docs/notion-campos-recomendados.md**](docs/notion-campos-recomendados.md) —
  schema de las 7 NotionDB.
- [**docs/casos-prueba/README.md**](docs/casos-prueba/README.md) — 5 escenarios
  end-to-end cubriendo todos los outcomes.

## Estado actual

**MVP funcional** con todos los flujos del PRD implementados:

- **3 roles UI**: Hospital (submit + live run + cases + procedures),
  Aseguradora (dashboard global + cases + policies + coverages), Auditor
  (tray + case detail + resolved).
- **7 NotionDB** integradas con adapters reales (Pacientes, Médicos,
  Aseguradoras, Pólizas, Coberturas, Procedimientos, Casos). Fallback
  automático a `InMemory*Repository` cuando no hay `NOTION_TOKEN`.
- **Agente LangGraph** con 7 nodos: extract_report → match_procedure →
  load_policy_coverage → check_waiting_period → check_required_docs →
  make_decision → persist_case. Cada paso emite TraceStep con duración +
  modelo + tokens (auditoría legal por diseño).
- **PDF intake** con Gemini Vision (informe médico + póliza). Confidence
  gate `< 0.80` fuerza `ESCALATED`.
- **JWT auth** con `iss` + `aud` validation, refresh tokens, RBAC por rol.
- **Tour guiado** end-to-end con driver.js (botón "?" en topbar).
- **Responsive full** mobile-first: drawer sidenav, tabla → cards, padding
  adaptativo.
- **mypy strict**: 0 errores en 187 source files.
- **Tests**: 82 passed (63 originales + 12 guard del fix false-positive +
  7 integration de patients).

## Mejoras destacadas post-MVP

- Cadena false-positive de issues #2/#3 **rota con 12 tests unit** sobre
  `match_procedure_node` — el `match_score` ahora se capa por
  `extraction.confidence` (`min(1.0, conf)` exact, `raw_similarity * conf`
  fuzzy). Ningún PDF de baja calidad puede inflar artificialmente el match.
- 3 sprints del "Día del Juicio" cerraron 19 hallazgos de un adversarial
  review de 3 jueces: NotionError unificada (RFC 7807 ahora cubre todo
  Notion failure), JWT iss/aud, log-injection sanitization,
  CORS guards, lazy load de driver.js, dark mode del tour, schema.d.ts
  regenerado, etc.

## Casos de prueba

5 escenarios cubriendo los outcomes del agente (en `docs/casos-prueba/`):

1. **APPROVED_AUTO** — póliza activa, cobertura cumplida, docs OK.
2. **DOCS_REQUESTED** — cobertura OK pero faltan docs del set requerido.
3. **ESCALATED_WAITING** — carencia no cumplida (procedimiento dentro
   del período de espera).
4. **ESCALATED_LOW_CONF** — informe ambiguo, ningún procedimiento supera
   el match threshold.
5. **ESCALATED_PDF_FAIL** — PDF escaneado no extraíble con calidad mínima.

Para cada escenario hay un PDF generado en `docs/casos-prueba-pdf/` listo
para usar en el flow de subida.

## Convenciones del proyecto

Vivan en `.atl/skill-registry.md` (consumidas por agentes IA en cada
delegación). Resumen:

- Domain layer **sin Pydantic** — solo `@dataclass(frozen=True, slots=True)`
  para entities, `abc.ABC` para ports.
- DTOs heredan `CamelModel` (alias_generator camelCase) — backend serializa
  camelCase, frontend consume camelCase, Python sigue snake_case internamente.
- Errors: subclases de `DomainError` con `title`/`status`/`type_uri`/`detail`,
  mapeadas a Problem+JSON (RFC 7807) por `register_error_handlers`.
- Conventional commits en español rioplatense, sin AI attribution.
- Frontend: standalone components, `signal()`/`computed()`/`effect()`,
  `inject()`, `@if`/`@for`/`@switch` (control flow nuevo).
- TDD strict para nueva lógica de dominio (test rojo → mínima implementación
  verde → refactor).

## Licencia

Sin licencia publicada todavía — sumar `LICENSE` (MIT recomendado) antes de
abrir el repo a contribuciones externas.
