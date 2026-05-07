# Design — Phase 4–5: Wire Frontend ↔ Backend End-to-End

| Campo | Valor |
|---|---|
| **Fecha** | 2026-05-07 |
| **Estado** | Aprobado — listo para writing-plans |
| **PRD base** | `docs/specs/2026-05-06-pre-autorizacion-quirurgica-prd.md` (v1.1) |
| **Owner** | Bryan |

## 1. Goal

Cerrar la brecha entre el backend (B0–B3 done) y el frontend (waves 1–5 done) para que la app funcione **end-to-end**: el Angular app deja de usar mocks in-memory y consume el FastAPI real. Cubre la mayoría de los AC pendientes del PRD §2.3 y completa Fase 4 + parte de Fase 5 del roadmap.

## 2. Decisiones del brainstorming (input → diseño)

| Decisión | Elección | Implicación |
|---|---|---|
| Prioridad | Wire FE↔BE end-to-end | Foco de esta sesión |
| Modo de datos | **In-memory + mock agent en backend** | Sin Notion, sin claves LLM. La app levanta y demuestra el flujo completo sin secretos. |
| Auth | **Sí — login UI completo** | `/login` page, JWT en memoria + refresh httpOnly, interceptor, redirect por rol |
| Insurer CRUD | **Incluido** | Cumple US-A1 |
| SSE | **Fake-stream desde respuesta sync** | Backend submit sigue síncrono; frontend re-emite el trace devuelto con delay (~200ms/step) |
| PDF | **Multipart endpoint + UI** | Hospital puede subir PDFs ≤10MB; backend los persiste vía `FileStorage` |
| Tests | **Critical paths** (pytest backend) | Auth integration, policy CRUD, file upload. Sin tests Angular (PRD §4.6 los excluye en v1) |
| TS types | **Generados de `/openapi.json`** vía `openapi-typescript` | Cumple PRD §4.3.3 — single source of truth |

## 3. Arquitectura

### 3.1 Principio rector

**Mantener** los patrones existentes; **no** reescribir. Cada gap se cierra agregando un adapter o endpoint detrás del port que ya existe.

- Backend: vertical slicing + clean arch (ya en su lugar). Endpoints nuevos siguen el patrón de `cases.py` / `policies.py`. CRUD nuevo amplía los ports existentes.
- Frontend: signals + facade pattern (ya en su lugar). HTTP repos implementan los mismos ports que los in-memory. El **único** lugar que cambia para alternar transport es `app.config.ts`.
- DTO contract: `/openapi.json` del backend → `openapi-typescript` → `schema.d.ts` en el frontend.

### 3.2 Out of scope (esta sesión, alineado con el PRD)

- Real SSE endpoint en backend (`/cases/{id}/events`) — usamos fake-stream
- Notion como persistencia activa — solo in-memory en esta iteración
- Real LLM/Vision — mock agent flow del backend sigue corriendo
- Auditor adjunta archivos al resolver (PRD §2.3.3 línea opcional)
- Angular component tests
- Seed de Notion (Phase 5 completa) — defer

## 4. Backend — cambios

### 4.1 Endpoint nuevo: PDF upload

**`POST /api/v1/cases/upload`** — `multipart/form-data`:
- Form fields: `policy_number` (str), `patient_id` (str), `procedure_solicited_hint` (str | None), `diagnosis` (str | None), `attending_doctor` (str | None), `scenario_key` (str | None)
- File field: `file` (PDF, ≤10 MB)
- Auth: `require_authenticated` (cualquier rol que ya pueda crear casos)
- Flow:
  1. Genera `case_id` candidato y `report_id`
  2. Persiste el PDF vía `FileStorage.save(case_id, filename, bytes)` → devuelve `storage_path`
  3. Construye `MedicalReport(format=PDF, content=storage_path, …)`
  4. Llama al mismo `SubmitCaseUseCase` que el endpoint JSON
  5. Devuelve `CaseOut` (202 Accepted)
- Validaciones:
  - `Content-Type` empieza con `multipart/form-data`
  - Tamaño: `Content-Length` ≤ `10 * 1024 * 1024` (config: `max_upload_mb`, default 10)
  - Magic bytes: el archivo arranca con `%PDF-` (defensa básica vs upload de cualquier blob)
  - `filename`: server-side genera `<uuid4>.pdf` — el filename del cliente se descarta

El endpoint JSON existente (`POST /api/v1/cases`) se mantiene intacto.

### 4.2 Endpoint nuevo: File download

**`GET /api/v1/cases/{case_id}/files/{filename}`**:
- Auth: `require_authenticated` + RBAC (PRD §4.4.2):
  - Hospital: solo si creó el caso (post-MVP de hecho — en v1 cualquier hospital puede ver, todos los hospitales son uno solo)
  - Insurer: solo si la póliza del caso pertenece a su aseguradora (en v1 hay una sola insurer, así que pasa)
  - Auditor: siempre
- Validaciones contra path traversal:
  - `filename` debe matchear `^[A-Za-z0-9_-]+\.pdf$`
  - El path resuelto debe estar dentro de `uploads_dir / case_id / `
- Respuesta: `StreamingResponse` con `application/pdf`

### 4.3 Procedures router

**Nuevo feature** `features/procedures/`:
```
procedures/
├── domain/
│   ├── entities/  (Procedure ya existe en shared/domain/)
│   └── ports/procedure_repository.py
├── application/use_cases/list_procedures.py
├── infrastructure/repos/in_memory_procedure.py
└── api/
    ├── routers/procedures.py
    └── schemas/procedures.py
```

**Endpoints**:
- `GET /api/v1/procedures` — lista completa
- `GET /api/v1/procedures?q=<text>` — filtra por nombre/código (substring case-insensitive)

Seeded data de `shared/fixtures/seed.py` o un nuevo fixture coherente con los 5 casos de prueba.

DI: `get_procedure_repository()` agregado en `config/di.py`.

### 4.4 Policy + Coverage CRUD

**Ports** — extensión:
- `PolicyRepository`: `create(policy)`, `update(policy)`, `delete(number)`
- `CoverageRepository`: `replace_for_policy(policy_number, coverages)`

**InMemory impls** — implementadas; `NotionPolicyRepository` y `NotionCoverageRepository` exponen los métodos nuevos pero `raise NotImplementedError` (con mensaje claro: "CRUD on Notion is out of scope for v1").

**Use cases nuevos** (`features/policies/application/use_cases/`):
- `create_policy.py` → `CreatePolicyUseCase`
- `update_policy.py` → `UpdatePolicyUseCase`
- `delete_policy.py` → `DeletePolicyUseCase`
- `replace_policy_coverages.py` → `ReplacePolicyCoveragesUseCase`

**Endpoints nuevos** en `features/policies/api/routers/policies.py`:
- `POST /api/v1/policies` (insurer-only) — body: `PolicyIn` → 201 + `PolicyOut`
- `PUT /api/v1/policies/{number}` (insurer-only) — body: `PolicyIn` → 200 + `PolicyOut`
- `DELETE /api/v1/policies/{number}` (insurer-only) → 204
- `PUT /api/v1/policies/{number}/coverages` (insurer-only) — body: `list[CoverageIn]` → 200 + `list[CoverageOut]`

**Schemas nuevos**: `PolicyIn`, `CoverageIn` (Pydantic, camelCase wire format).

### 4.5 Configuración + tests

- **`backend/.env.example`**: copia del bloque del README con valores placeholder. Incluye `MAX_UPLOAD_MB=10`.
- **Settings**: agregar `max_upload_mb: int = 10`.
- **Tests pytest** (critical paths only):
  - `tests/integration/api/test_auth_flow.py` — login → refresh → me → logout
  - `tests/integration/api/test_policy_crud.py` — create → list → update → replace coverages → delete; RBAC (hospital no puede crear)
  - `tests/integration/api/test_case_upload.py` — multipart con PDF válido → 202; >10MB → 413; archivo no-PDF → 415; path traversal en download → 400
  - `tests/integration/api/test_procedures.py` — listado + filtro `?q=`

## 5. Frontend — cambios

### 5.1 Bootstrap

**`app.config.ts`** — composition root, agrega:
```ts
provideHttpClient(
  withFetch(),
  withInterceptors([authInterceptor, errorInterceptor]),
),
{ provide: CaseRepository, useClass: HttpCaseRepository },
{ provide: PolicyRepository, useClass: HttpPolicyRepository },
{ provide: CoverageRepository, useClass: HttpCoverageRepository },
{ provide: InsurerRepository, useClass: HttpInsurerRepository },
{ provide: ProcedureRepository, useClass: HttpProcedureRepository },
{ provide: AgentOrchestrator, useClass: HttpAgentAdapter },
```

**Environment**:
- `src/environments/environment.ts` — `{ production: false, apiBaseUrl: 'http://localhost:8000' }`
- `src/environments/environment.production.ts` — placeholder (no se usa en hackathon)
- `angular.json` `fileReplacements` para production build

**TS types**:
- `npm install --save-dev openapi-typescript`
- `npm run gen:api` ejecuta `openapi-typescript http://localhost:8000/openapi.json -o src/app/shared/api/schema.d.ts`
- Backend genera `openapi.json` en boot y queda servido en `/openapi.json` (FastAPI default)

### 5.2 Auth feature (nuevo)

```
features/auth/
├── domain/
│   ├── entities/user.ts
│   ├── value-objects/role.ts        (mover desde core/types/role.ts; re-export)
│   ├── value-objects/auth-tokens.ts
│   └── ports/
│       ├── auth-repository.port.ts
│       └── token-store.port.ts
├── application/
│   ├── facades/auth.facade.ts
│   └── use-cases/
│       ├── login.use-case.ts
│       ├── logout.use-case.ts
│       └── refresh-session.use-case.ts
├── infrastructure/
│   ├── repos/http-auth.repository.ts
│   └── stores/in-memory-token.store.ts
└── presentation/
    └── pages/login/login.page.ts
```

**`AuthFacade`** signals:
- `accessToken: Signal<string | null>`
- `currentUser: Signal<User | null>`
- `role: Signal<Role>` — derivado de `currentUser`; default `Role.HOSPITAL` cuando no hay sesión (preserva el flujo actual del topbar)
- `isAuthenticated: Signal<boolean>`

**`RoleService`** se convierte en thin facade que reexporta `AuthFacade.role` para no romper call sites — eliminado en una sesión posterior.

**`authInterceptor`**: attach `Authorization: Bearer <accessToken>`; on 401 → llama `refresh-session` use case → reintenta una vez; si falla, navega a `/login`.

**`errorInterceptor`**: parsea RFC 7807 errors → throws typed `ApiError`.

**`/login` page**: form simple (email + password), botón "Entrar", muestra error si credenciales mal. Tras éxito redirige a la home del rol del JWT.

**Auth guard**: `canActivate` check de `isAuthenticated`. Aplicado a todas las rutas excepto `/login`.

### 5.3 HTTP repositories

Cada repo implementa el mismo port que su versión in-memory. Mappers DTO↔domain en `infrastructure/mappers/`.

- `HttpCaseRepository`:
  - `cases: Signal<readonly AuthorizationCase[]>` — populated por `loadAll()` que llama `GET /cases`
  - `submitText(input)` → `POST /cases` → devuelve case completo (con trace)
  - `submitFile(input)` → `POST /cases/upload` (multipart) → devuelve case completo
  - `findById(id)` → `GET /cases/{id}` (también acepta snapshot del signal)
  - `getTrace(id)` → `GET /cases/{id}/trace`
  - `resolve(input)` → `POST /cases/{id}/resolve`
- `HttpPolicyRepository` (incluye CRUD nuevo)
- `HttpCoverageRepository` (incluye `replaceForPolicy`)
- `HttpInsurerRepository`
- `HttpProcedureRepository`

**Reactividad**: cada HTTP repo expone `cases` (o equivalente) como signal interno; `loadAll` lo refresca al inicializarse y tras mutaciones. Las facades existentes consumen el signal — no se enteran de que cambió el adapter.

### 5.4 HttpAgentAdapter (reemplaza mock-agent)

Implementa el mismo port que `MockAgentAdapter`. Devuelve un Observable de `AgentEvent`:

```ts
submit(input): { caseId; events$ }
  ↓
1. POST /cases (text) o /cases/upload (PDF) — synchronous on backend
2. Recibe CaseOut con trace + decision completos
3. caseId := response.id; emite events$ desde un `from(...)` con timer:
   - Por cada step en response.trace: emite { kind: 'step', step } cada ~200ms
   - Al final: emite { kind: 'done', decision, trace }
4. Si la HTTP call falla: emite { kind: 'error', error, trace: [] }
```

El facade existente no cambia — sigue suscribiéndose al `events$` y actualizando `currentRun`.

### 5.5 PDF upload UI

`medical-report-form` recibe un toggle Text/PDF (componente `Segmented` ya existe):
- **Text mode**: el textarea actual
- **PDF mode**: file picker (`<input type="file" accept="application/pdf">`)
  - Validación cliente: ≤ 10 MB; `file.type === 'application/pdf'`
  - Submit emite un payload diferente que el `submit-case.use-case.ts` despacha al método correcto del repo

`SubmitCaseInput` se vuelve unión:
```ts
type SubmitCaseInput =
  | { kind: 'text'; report: MedicalReportText; policyNumber: string; scenarioKey?: string }
  | { kind: 'pdf'; report: MedicalReportPdf; policyNumber: string; scenarioKey?: string };
```

### 5.6 Insurer CRUD UI

**`insurer/policies.page.ts`**:
- Tabla con columnas (número, paciente, plan, vigencia, estado, acciones)
- Botón "Nueva póliza" → abre slide-over con formulario `PolicyForm`
- Cada fila tiene "Editar" (mismo slide-over con valores pre-cargados) y "Eliminar" (confirm dialog)
- Llama `PoliciesFacade.create/update/delete`

**`insurer/coverages.page.ts`**:
- Selector de póliza (dropdown)
- Tabla editable de coberturas para esa póliza (procedimiento, cubierto, días carencia, copago, docs requeridos)
- Botón "Agregar cobertura" agrega una fila vacía
- Botón "Guardar todo" llama `replaceForPolicy(policyNumber, coverages)`

**`PoliciesFacade`** se extiende con `createPolicy`, `updatePolicy`, `deletePolicy`, `replacePolicyCoverages`.

### 5.7 Procedures wiring

`hospital/procedures.page.ts` ya existe — solo cambia el adapter (in-memory → HTTP). El search bar emite query → llama `ProcedureRepository.search(q)`.

## 6. Build sequence

1. **Backend gaps** (`feat(backend): phase B4 — endpoints + crud`):
   - Procedures feature completo
   - Policy/Coverage CRUD ports + use cases + endpoints + InMemory impls
   - PDF upload endpoint + file download endpoint
   - `MAX_UPLOAD_MB` setting + `.env.example`
   - Pytest integration tests (auth flow, policy CRUD, upload, procedures)
2. **API contract** (`chore: regenerate openapi schema`):
   - Levantar backend, dump `openapi.json` a `frontend/openapi.json`
   - `npm install` + `npm run gen:api`
3. **Frontend bootstrap** (`feat(frontend): wave 6 — http client + environment`):
   - `provideHttpClient`, environments, gen:api script
4. **Frontend auth** (`feat(frontend): wave 7 — auth feature + login page`):
   - Auth feature completo (domain, application, infra, presentation)
   - Interceptors + auth guard
   - Migrar `RoleService` a passthrough sobre `AuthFacade.role`
5. **Frontend HTTP repos** (`feat(frontend): wave 8 — http repositories`):
   - Cinco HTTP repos + mappers
   - Cambio de bindings en `app.config.ts`
6. **Frontend HttpAgentAdapter** (`feat(frontend): wave 9 — http agent adapter`):
   - Reemplaza `MockAgentAdapter` con fake-stream desde HTTP response
7. **Frontend PDF upload UI** (`feat(frontend): wave 10 — pdf upload`)
8. **Frontend insurer CRUD** (`feat(frontend): wave 11 — insurer crud ui`)
9. **Smoke test manual** + commit final

Cada paso = un commit. Frontend waves 6–11 son chicos/independientes.

## 7. Riesgos / open issues

| Riesgo | Mitigación |
|---|---|
| Mappers DTO↔domain explotan en runtime por field mismatch | Generar TS types de OpenAPI elimina el grueso; tests integration cubren el roundtrip backend |
| `provideHttpClient` con `withFetch()` no soporta interceptors clásicos | Usar functional interceptors (`HttpInterceptorFn`) — Angular 19 native pattern |
| In-memory user store con bcrypt: passwords seedeadas | Seeds tienen `password=demo123` por usuario; documentado en `.env.example` y login page |
| RBAC del download endpoint con un solo hospital | En v1 todos los hospitals son uno → check trivial. Comentar el TODO para v2 (`patient_id` ownership) |
| Fake-stream se ve "fake" si los pasos llegan demasiado rápido o lento | Constante `STEP_DELAY_MS = 200` configurable en environment; suficiente para US-H2 |
| OpenAPI schema queda desactualizado | `npm run gen:api` corre con backend levantado; documentar en README. Post-v1: CI gate. |

## 8. Acceptance criteria de esta iteración

- [ ] `cd backend && uv run uvicorn pre_autorizacion.main:app --reload` levanta sin errores
- [ ] `cd frontend && npm start` levanta y la app navega a `/login` por default cuando no hay sesión
- [ ] Login con un usuario seedeado (hospital/insurer/auditor) redirige a su home
- [ ] Hospital puede submit un caso de texto y ver el trace progresivo + decisión
- [ ] Hospital puede submit un PDF y ver el trace progresivo + decisión
- [ ] Insurer ve dashboard con métricas reales del backend
- [ ] Insurer crea/edita/borra una póliza y reemplaza sus coberturas
- [ ] Auditor ve la bandeja de escalados y resuelve un caso
- [ ] Logout limpia tokens y vuelve a `/login`
- [ ] `uv run pytest` pasa en el backend (los 45 anteriores + los nuevos integration tests)

---

**Próximo paso**: writing-plans skill genera el plan de implementación paso a paso.
