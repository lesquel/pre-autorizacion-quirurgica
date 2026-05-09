# Skill Registry — Pre-Autorización Quirúrgica

Pre-digested project standards. The orchestrator reads this file (or its engram
mirror) once per session, matches relevant blocks against each sub-agent's task
+ code context, and injects the matching **Compact Rules** blocks into the
sub-agent prompt as `## Project Standards (auto-resolved)`.

Sub-agents do NOT read this file directly. They receive the matching blocks
already pasted into their prompt.

Keep each Compact Rules block under ~20 lines. If a rule needs more detail,
link to a doc in **Project Conventions** instead of expanding the block.

## Compact Rules

### backend-python-clean
**Trigger**: `backend/**/*.py`, FastAPI, Pydantic, hexagonal, repository, port, use case, adapter, DI

- Architecture: Clean / Hexagonal / Vertical Slicing. Layers: `domain` (entities + ports + errors), `application` (use cases), `infrastructure` (adapters), `api` (routers + DTOs).
- Domain: `@dataclass(frozen=True, slots=True)` para entities. `abc.ABC + @abstractmethod` para ports. **Pydantic NUNCA en domain**.
- Pydantic v2: SOLO en `api/schemas/*.py` (DTOs) y `config/settings.py`. DTOs heredan `CamelModel` de `shared/api/schemas` (alias_generator camelCase, populate_by_name=True).
- Imports: `from __future__ import annotations` siempre. `TYPE_CHECKING` para imports de tipos en use cases (evita ciclos).
- Use cases: `@dataclass(slots=True)` con dependencies por constructor. Método único `async def execute(self, ...)`.
- DI: factories en `config/di.py`. `Annotated[T, Depends(...)]` aliases en `shared/api/deps.py`.
- Errors: subclases de `DomainError` en `shared/domain/errors.py`. `register_error_handlers` mapea a RFC 7807 — NO usar `HTTPException` directamente en use cases.
- Naming: snake_case. Modules en singular para entities (`patient.py`), plural para colecciones de schemas/routers (`patients.py`).
- Logging: `structlog.get_logger("<area>.<sub>")`. Eventos como `<area>.<event>` (ej. `router.patients.unavailable`).

### backend-fastapi-routers
**Trigger**: `backend/**/api/routers/*.py`, FastAPI router, endpoint, `/api/v1/`

- Prefix `/api/v1/<feature>`. Tag = nombre del feature.
- Auth obligatoria: `Annotated[User, Depends(require_authenticated)]` (o `require_role(...)` para RBAC).
- Errores explícitos: levantar `NotFoundError`/`ValidationError` (mapeados por error handler). NUNCA try/except genérico que se trague el error.
- DTO responses: `response_model=PatientOut` (heredando `CamelModel`). Mapper explícito `domain_to_out(entity) -> DTO` en `api/schemas/`.
- Dependency factories: helper privado `_get_<x>_use_case(repo: <X>RepositoryDep) -> <X>UseCase`. Aliases `Annotated[<UseCase>, Depends(_get_<x>_use_case)]`.
- Documentar 4xx en `responses={404: {"description": "..."}}` para Swagger.
- Registración: `main._register_feature_routers` con try/except `ImportError` defensive (mismo patrón que cases/policies/procedures/patients).

### backend-mypy-strict
**Trigger**: `backend/**/*.py`, mypy, type hints

- mypy strict ON (`strict = true` en pyproject). NUNCA `# type: ignore` sin razón explícita en el comentario.
- Baseline son **5 errores pre-existentes** en 3 archivos (no relacionados al feature actual). NO sumar más; al cerrar un cambio, mypy debe estar en ese baseline o mejor.
- Generics: `tuple[T, ...]` para colecciones inmutables, `list[T]` para mutables. NUNCA `Tuple` o `List` mayúscula (legacy).
- Optional: `T | None` (PEP 604). NUNCA `Optional[T]`.
- `Annotated`, `TYPE_CHECKING` se importan desde `typing` (no `typing_extensions`).

### backend-testing
**Trigger**: `backend/tests/**/*.py`, pytest, hypothesis, respx, asyncio test

- pytest-asyncio en `auto` mode (no necesita decorador). `async def test_...` directo.
- Naming: `test_<unit>_<scenario>_<expected>`. Carpeta `tests/<feature>/` espeja `src/<feature>/`.
- Hypothesis para invariantes en use cases puros; respx para mockear `httpx.AsyncClient`; **NO** mockear DB ni adapters internos a menos que sea integration test.
- Todo test debe correr offline (sin Notion / DeepSeek / Gemini reales). Usar fakes de `shared/infrastructure/repos/in_memory_*.py` y dummies de `shared/llm/`.
- Strict TDD mode activo: para nueva lógica, **test first**. Test rojo → mínima implementación verde → refactor.

### frontend-angular-signals
**Trigger**: `frontend/src/**/*.ts`, Angular 21, signal, computed, component, inject

- `@Component({ standalone: true })` SIEMPRE. NUNCA NgModules.
- DI: `inject()` (no constructor injection).
- I/O: `input<T>()`, `input.required<T>()`, `output<T>()` (funciones, no decoradores).
- State: `signal()` para mutable, `computed()` para derivado, `effect()` para side-effects.
- `changeDetection: ChangeDetectionStrategy.OnPush` por defecto.
- Templates: `@if`, `@for (track ...)`, `@switch` (control flow nuevo). NUNCA `*ngIf`/`*ngFor`.
- Imports en el `imports: []` del componente.

### frontend-tailwind-v4
**Trigger**: `frontend/**/*.{html,scss,css}`, tailwind, theme

- Tailwind v4 — config CSS-first en `frontend/src/styles.scss` con `@theme`. NO `tailwind.config.js`.
- Custom tokens en `@theme { --color-... --font-... }`.
- Dark mode automático con `dark:` prefix; preferencia persistida via signal en `app.config` o un service.
- Atomic design para componentes UI compartidos.

### frontend-vertical-slicing
**Trigger**: `frontend/src/app/features/**`, frontend architecture, adapter, port, use case (TS)

- Mirror del backend: `features/<feature>/{domain,application,infrastructure,presentation}`.
- API adapters en `infrastructure/adapters/http-*.adapter.ts` implementando un port domain.
- Use cases con dependencias inyectadas via `inject(<TOKEN>)`.
- camelCase (frontend) ↔ snake_case (backend Python): el backend serializa camelCase via `CamelModel`; `openapi-typescript` genera tipos camelCase en `shared/api/schema.d.ts` (auto-gen, NO editar a mano).
- Container/Presentational: smart components en `presentation/pages/`, dumb en `presentation/components/`.

### project-conventions
**Trigger**: cualquier delegación que escriba código, commits, PRs

- Conventional commits: `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, `refactor(scope): ...`. **NUNCA** `Co-Authored-By` ni AI attribution.
- Commits en español rioplatense para body. Subject corto, body explica el "por qué".
- NEVER `cat`/`grep`/`find`/`sed`/`ls` — usar `bat`/`rg`/`fd`/`sd`/`eza`.
- NEVER `build` después de cambios. mypy + pytest sí.
- Idioma: español rioplatense para docs internos, comentarios y commits. Nombres de identificadores en inglés.

### domain-pre-autorizacion
**Trigger**: cualquier trabajo en este proyecto

- Agente **NUNCA auto-rechaza**. Outcomes válidos: `APPROVED_AUTO`, `NEEDS_DOCS`, `ESCALATED`. (PRD §3.1.3)
- Confidence gate: `extraction.confidence < 0.80` → `ESCALATED` automáticamente.
- 7 NotionDB en producción: Pacientes, Médicos, Aseguradoras, Pólizas, Casos, Procedimientos, ReglasMédicas. Todas con adapters reales en `shared/infrastructure/repos/notion_*.py`.
- LLM: DeepSeek (texto) + Gemini Vision (PDFs). Ports `LLMProvider` y `VisionProvider` en `shared/llm/` y `shared/vision/` desacoplan ambos — cualquier nuevo provider implementa el port.
- LangGraph orquesta el flujo del agente; nodos en `shared/agent/nodes/`.
- Match procedure: el `match_score` SIEMPRE se capa por `extraction.confidence` (`min(1.0, conf)` exacto, `raw_similarity * conf` fuzzy). NO restaurar el bug previo de `score=1.0` independiente de la confianza.
- Prompt LLM: framing neutro, NUNCA anclar al `preliminary_outcome`. El LLM debe poder discrepar del match.

### testing-strict-tdd
**Trigger**: nueva feature, nueva lógica de dominio, refactor con cambio de comportamiento

- **STRICT TDD MODE** está activo en este proyecto.
- Orden: (1) test rojo, (2) implementación mínima verde, (3) refactor con tests verdes.
- Nunca implementar lógica nueva sin un test que la cubra primero.
- Tests son contrato — si un test rompe por refactor, primero entender por qué (puede ser regresión real).

## User Skills (trigger table)

| Skill | Trigger keywords | When to inject into sub-agent prompt |
|-------|------------------|--------------------------------------|
| backend-python-clean | `.py`, FastAPI, Pydantic, repository, use case, port, adapter | Cualquier cambio en `backend/src` |
| backend-fastapi-routers | router, endpoint, `/api/v1/`, `features/*/api/` | Endpoints HTTP nuevos o modificados |
| backend-mypy-strict | mypy, type, `# type: ignore` | Refactors o código Python nuevo |
| backend-testing | `tests/`, pytest, hypothesis, respx | Escribir/modificar tests Python |
| frontend-angular-signals | `.ts`, Angular, signal, component, inject | Cualquier cambio en `frontend/src` |
| frontend-tailwind-v4 | `.html`, `.scss`, tailwind, theme | Estilos / UI visual |
| frontend-vertical-slicing | `features/`, adapter, use-case (TS) | Nueva feature en frontend |
| project-conventions | commit, PR, push, refactor | Toda delegación que escriba código |
| domain-pre-autorizacion | informe médico, póliza, autorización, confidence, outcome, match | Trabajo de dominio del agente |
| testing-strict-tdd | feature nueva, lógica de dominio nueva | Cualquier delegación que agregue lógica |

## Project Conventions (paths to read on demand)

Sub-agents leen estos solo si su tarea los requiere — el orchestrator los pasa
como pointers, no como contenido inline:

- `docs/specs/2026-05-06-pre-autorizacion-quirurgica-prd.md` — PRD oficial. Single source of truth para reglas de dominio.
- `backend/src/pre_autorizacion/shared/domain/entities/` — entidades canónicas (Patient, Procedure, Policy, Case, etc).
- `backend/src/pre_autorizacion/shared/domain/ports/` — puertos hexagonales (interfaces). NUNCA agregar lógica acá.
- `backend/src/pre_autorizacion/config/di.py` — composition root. Toda inyección pasa por acá.
- `backend/src/pre_autorizacion/main.py` — registración de routers (try/except defensive pattern).
- `backend/src/pre_autorizacion/shared/api/deps.py` — `Annotated` aliases para DI en routers.
- `backend/src/pre_autorizacion/shared/api/schemas/` — `CamelModel` base + DTOs compartidos.
- `frontend/src/app/shared/api/schema.d.ts` — tipos generados desde OpenAPI. **No editar a mano**, regenerar con `npm run gen:api`.
- `Makefile` — comandos de orquestación local (backend-dev, frontend-dev, etc).
- `docs/notion-campos-recomendados.md` — schema Notion oficial (alineación con adapters).
