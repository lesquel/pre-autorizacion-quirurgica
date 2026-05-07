# FE↔BE Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Angular frontend to the FastAPI backend end-to-end so the demo runs against a real HTTP API instead of in-memory mocks. Adds the missing backend endpoints (procedures, policy/coverage CRUD, PDF upload/download), a real login UI on the frontend, HTTP repositories, and a fake-stream agent adapter.

**Architecture:** Backend stays vertical-slice + clean arch; new endpoints follow existing patterns. Backend stays in **in-memory + mock-agent** mode (no Notion/LLM keys). Frontend keeps the signals + facade pattern; HTTP adapters implement the same ports as the in-memory ones — only `app.config.ts` flips. Backend submit stays synchronous; frontend "fake-streams" the returned trace step-by-step (~200 ms per step) for the live UX. TS types are generated from `/openapi.json` via `openapi-typescript` (single source of truth, PRD §4.3.3).

**Tech Stack:** FastAPI · Pydantic v2 · uv · pytest · Angular 19 (signals, standalone components) · Tailwind v4 · RxJS · openapi-typescript

**Spec:** `docs/superpowers/specs/2026-05-07-fe-be-wiring-design.md`

---

## File Structure

### Backend — files created

```
backend/
├── .env.example                                        (new)
├── src/pre_autorizacion/
│   ├── config/settings.py                              (modify — add max_upload_mb)
│   ├── config/di.py                                    (modify — add procedure repo factory)
│   ├── main.py                                         (modify — wire procedures router)
│   ├── features/
│   │   ├── procedures/                                 (new feature)
│   │   │   ├── __init__.py
│   │   │   ├── domain/
│   │   │   │   ├── __init__.py
│   │   │   │   └── ports/
│   │   │   │       ├── __init__.py
│   │   │   │       └── procedure_repository.py
│   │   │   ├── application/
│   │   │   │   ├── __init__.py
│   │   │   │   └── use_cases/
│   │   │   │       ├── __init__.py
│   │   │   │       └── list_procedures.py
│   │   │   ├── infrastructure/
│   │   │   │   ├── __init__.py
│   │   │   │   └── repos/
│   │   │   │       ├── __init__.py
│   │   │   │       └── in_memory_procedure.py
│   │   │   └── api/
│   │   │       ├── __init__.py
│   │   │       ├── routers/
│   │   │       │   ├── __init__.py
│   │   │       │   └── procedures.py
│   │   │       └── schemas/
│   │   │           ├── __init__.py
│   │   │           └── procedures.py
│   │   ├── policies/
│   │   │   ├── domain/ports/policy_repository.py       (modify — add CRUD methods)
│   │   │   ├── domain/ports/coverage_repository.py     (modify — add replace_for_policy)
│   │   │   ├── application/use_cases/                  (new use cases)
│   │   │   │   ├── create_policy.py
│   │   │   │   ├── update_policy.py
│   │   │   │   ├── delete_policy.py
│   │   │   │   └── replace_policy_coverages.py
│   │   │   ├── application/use_cases/__init__.py       (modify — re-export)
│   │   │   ├── infrastructure/repos/in_memory_policy.py    (modify — implement CRUD)
│   │   │   ├── infrastructure/repos/in_memory_coverage.py  (modify — implement replace)
│   │   │   ├── infrastructure/repos/notion_policy.py       (modify — raise NotImplementedError)
│   │   │   ├── infrastructure/repos/notion_coverage.py     (modify — raise NotImplementedError)
│   │   │   ├── api/routers/policies.py                 (modify — add CRUD endpoints)
│   │   │   └── api/schemas/policies.py                 (modify — add PolicyIn, CoverageIn)
│   │   └── authorization_cases/
│   │       ├── api/routers/cases.py                    (modify — add upload + download endpoints)
│   │       └── api/schemas/cases.py                    (modify — add CaseUploadOut helpers)
└── tests/integration/api/
    ├── __init__.py                                     (new — empty)
    ├── conftest.py                                     (new — TestClient fixture)
    ├── test_auth_flow.py                               (new)
    ├── test_policy_crud.py                             (new)
    ├── test_case_upload.py                             (new)
    └── test_procedures.py                              (new)
```

### Frontend — files created

```
frontend/
├── package.json                                        (modify — add openapi-typescript dep, gen:api script)
├── angular.json                                        (modify — fileReplacements)
├── src/
│   ├── environments/
│   │   ├── environment.ts                              (new)
│   │   └── environment.production.ts                   (new)
│   └── app/
│       ├── app.config.ts                               (modify — provideHttpClient + bindings)
│       ├── app.routes.ts                               (modify — add /login route + auth guard)
│       ├── shared/
│       │   ├── api/
│       │   │   ├── schema.d.ts                         (new — generated)
│       │   │   ├── api-base-url.token.ts               (new — InjectionToken)
│       │   │   ├── interceptors/
│       │   │   │   ├── auth.interceptor.ts             (new)
│       │   │   │   └── error.interceptor.ts            (new)
│       │   │   ├── errors/api-error.ts                 (new)
│       │   │   └── mappers/                            (new — DTO↔domain)
│       │   │       ├── case.mapper.ts
│       │   │       ├── policy.mapper.ts
│       │   │       ├── coverage.mapper.ts
│       │   │       ├── insurer.mapper.ts
│       │   │       └── procedure.mapper.ts
│       │   └── guards/auth.guard.ts                    (new)
│       ├── features/
│       │   ├── auth/                                   (new feature)
│       │   │   ├── domain/
│       │   │   │   ├── entities/user.ts
│       │   │   │   ├── value-objects/auth-tokens.ts
│       │   │   │   └── ports/
│       │   │   │       ├── auth-repository.port.ts
│       │   │   │       └── token-store.port.ts
│       │   │   ├── application/
│       │   │   │   ├── facades/auth.facade.ts
│       │   │   │   └── use-cases/
│       │   │   │       ├── login.use-case.ts
│       │   │   │       ├── logout.use-case.ts
│       │   │   │       └── refresh-session.use-case.ts
│       │   │   ├── infrastructure/
│       │   │   │   ├── repos/http-auth.repository.ts
│       │   │   │   └── stores/in-memory-token.store.ts
│       │   │   └── presentation/pages/login/login.page.ts
│       │   ├── authorization-cases/
│       │   │   ├── infrastructure/
│       │   │   │   ├── repos/http-case.repository.ts                  (new)
│       │   │   │   └── agents/http-agent.adapter.ts                   (new — replaces mock-agent)
│       │   │   ├── application/use-cases/submit-case.use-case.ts      (modify — accept text|pdf)
│       │   │   ├── presentation/components/medical-report-form/
│       │   │   │   └── medical-report-form.ts                         (modify — text/PDF toggle)
│       │   │   └── presentation/pages/hospital/procedures/
│       │   │       └── procedures.page.ts                             (modify — uses HTTP repo)
│       │   └── policies/
│       │       ├── application/facades/policies.facade.ts             (modify — add create/update/delete/replaceCoverages)
│       │       ├── application/use-cases/                              (new)
│       │       │   ├── create-policy.use-case.ts
│       │       │   ├── update-policy.use-case.ts
│       │       │   ├── delete-policy.use-case.ts
│       │       │   └── replace-coverages.use-case.ts
│       │       ├── domain/ports/policy-repository.port.ts             (modify — add CRUD)
│       │       ├── domain/ports/coverage-repository.port.ts           (modify — add replaceForPolicy)
│       │       ├── infrastructure/repos/                              (new)
│       │       │   ├── http-policy.repository.ts
│       │       │   ├── http-coverage.repository.ts
│       │       │   └── http-insurer.repository.ts
│       │       └── presentation/pages/insurer/
│       │           ├── policies/policies.page.ts                       (modify — CRUD UI)
│       │           ├── policies/policy-form.component.ts               (new)
│       │           └── coverages/coverages.page.ts                     (modify — bulk edit UI)
│       └── core/services/role.service.ts                               (modify — passthrough to AuthFacade.role)
```

---

## Tasks

> Each task = one commit. Branch stays on `main` (per repo convention — no feature branches in this hackathon).

---

### Task 1: Backend — `.env.example` template + `MAX_UPLOAD_MB` setting

**Files:**
- Create: `backend/.env.example`
- Modify: `backend/src/pre_autorizacion/config/settings.py`

- [ ] **Step 1: Create `backend/.env.example` with placeholders**

```dotenv
# ─── Server ───
APP_HOST=0.0.0.0
APP_PORT=8000
APP_ENV=development

# ─── Auth (JWT) ───
# In dev only. Generate a strong secret for staging/prod: openssl rand -hex 32
JWT_SECRET=changeme-please-very-secret-and-long-at-least-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7

# ─── IA: text provider (DeepSeek default) ───
TEXT_PROVIDER=deepseek
TEXT_MODEL=deepseek-chat
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com

# ─── IA: vision provider (Gemini for PDFs) ───
VISION_PROVIDER=gemini
VISION_MODEL=gemini-2.5-flash
GOOGLE_API_KEY=

# ─── IA: decision thresholds ───
CONFIDENCE_THRESHOLD=0.80
PROCEDURE_MATCH_THRESHOLD=0.85

# ─── Notion (optional in v1 — leave blank to use in-memory adapters) ───
NOTION_TOKEN=
NOTION_DB_PATIENTS=
NOTION_DB_INSURERS=
NOTION_DB_PROCEDURES=
NOTION_DB_POLICIES=
NOTION_DB_COVERAGES=
NOTION_DB_MEDICAL_REPORTS=
NOTION_DB_AUTHORIZATION_CASES=

# ─── Storage ───
UPLOADS_DIR=./var/uploads
MAX_UPLOAD_MB=10

# ─── CORS ───
CORS_ORIGINS=http://localhost:4200
```

- [ ] **Step 2: Add `max_upload_mb` to Settings**

In `backend/src/pre_autorizacion/config/settings.py`, inside the `Settings` class, **add** after the `uploads_dir` line:

```python
    max_upload_mb: int = 10
```

- [ ] **Step 3: Verify settings load**

Run: `cd backend && uv run python -c "from pre_autorizacion.config.settings import get_settings; s = get_settings(); print(s.max_upload_mb, s.uploads_dir)"`
Expected: `10 var\uploads` (or whatever path)

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example backend/src/pre_autorizacion/config/settings.py
git commit -m "feat(backend): add .env.example template and MAX_UPLOAD_MB setting"
```

---

### Task 2: Backend — Procedures feature (port + use case + repo)

**Files:**
- Create: `backend/src/pre_autorizacion/features/procedures/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/domain/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/domain/ports/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/domain/ports/procedure_repository.py`
- Create: `backend/src/pre_autorizacion/features/procedures/application/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/application/use_cases/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/application/use_cases/list_procedures.py`
- Create: `backend/src/pre_autorizacion/features/procedures/infrastructure/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/infrastructure/repos/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/infrastructure/repos/in_memory_procedure.py`

- [ ] **Step 1: Create `procedure_repository.py` port**

```python
"""ProcedureRepository — port read-only del catálogo de procedimientos."""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.shared.domain.entities import Procedure


class ProcedureRepository(ABC):
    """Port read-only para el catálogo de procedimientos. Adapter típico → Notion."""

    @abstractmethod
    async def list(self) -> tuple[Procedure, ...]:
        """Lista el catálogo completo."""

    @abstractmethod
    async def search(self, query: str) -> tuple[Procedure, ...]:
        """Filtra por substring case-insensitive en `code` o `name`."""
```

- [ ] **Step 2: Re-export the port in `domain/ports/__init__.py`**

```python
from pre_autorizacion.features.procedures.domain.ports.procedure_repository import (
    ProcedureRepository,
)

__all__ = ["ProcedureRepository"]
```

- [ ] **Step 3: Create `in_memory_procedure.py` adapter**

```python
"""InMemoryProcedureRepository — fallback adapter, seeded con `SEED_PROCEDURES`."""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
from pre_autorizacion.shared.domain.entities import Procedure
from pre_autorizacion.shared.fixtures import SEED_PROCEDURES


class InMemoryProcedureRepository(ProcedureRepository):
    """Repo in-memory del catálogo de procedimientos (PRD §4.2.2 DB Notion 3)."""

    def __init__(self, seed: Iterable[Procedure] = SEED_PROCEDURES) -> None:
        self._procedures: tuple[Procedure, ...] = tuple(seed)

    async def list(self) -> tuple[Procedure, ...]:
        return self._procedures

    async def search(self, query: str) -> tuple[Procedure, ...]:
        q = query.strip().lower()
        if not q:
            return self._procedures
        return tuple(
            p for p in self._procedures
            if q in p.code.lower() or q in p.name.lower()
        )
```

- [ ] **Step 4: Re-export adapter in `infrastructure/repos/__init__.py`**

```python
from pre_autorizacion.features.procedures.infrastructure.repos.in_memory_procedure import (
    InMemoryProcedureRepository,
)

__all__ = ["InMemoryProcedureRepository"]
```

- [ ] **Step 5: Create `list_procedures.py` use case**

```python
"""ListProceduresUseCase — listar / buscar procedimientos."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
    from pre_autorizacion.shared.domain.entities import Procedure


@dataclass(slots=True)
class ListProceduresUseCase:
    procedure_repository: ProcedureRepository

    async def execute(self, query: str | None = None) -> tuple[Procedure, ...]:
        if query is None or not query.strip():
            return await self.procedure_repository.list()
        return await self.procedure_repository.search(query)
```

- [ ] **Step 6: Re-export use case in `application/use_cases/__init__.py`**

```python
from pre_autorizacion.features.procedures.application.use_cases.list_procedures import (
    ListProceduresUseCase,
)

__all__ = ["ListProceduresUseCase"]
```

- [ ] **Step 7: Empty `__init__.py` for the feature, application, infrastructure, domain dirs**

Each of `procedures/__init__.py`, `procedures/domain/__init__.py`, `procedures/application/__init__.py`, `procedures/infrastructure/__init__.py` is just an empty file.

- [ ] **Step 8: Verify imports**

Run: `cd backend && uv run python -c "from pre_autorizacion.features.procedures.application.use_cases import ListProceduresUseCase; from pre_autorizacion.features.procedures.infrastructure.repos import InMemoryProcedureRepository; print('ok')"`
Expected: `ok`

- [ ] **Step 9: Commit**

```bash
git add backend/src/pre_autorizacion/features/procedures
git commit -m "feat(backend): add procedures feature (port + use case + in-memory repo)"
```

---

### Task 3: Backend — Procedures router + DI wiring

**Files:**
- Create: `backend/src/pre_autorizacion/features/procedures/api/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/api/routers/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/api/routers/procedures.py`
- Create: `backend/src/pre_autorizacion/features/procedures/api/schemas/__init__.py`
- Create: `backend/src/pre_autorizacion/features/procedures/api/schemas/procedures.py`
- Modify: `backend/src/pre_autorizacion/config/di.py`
- Modify: `backend/src/pre_autorizacion/shared/api/deps.py`
- Modify: `backend/src/pre_autorizacion/main.py`

- [ ] **Step 1: Create `api/schemas/procedures.py`**

```python
"""DTOs del feature `procedures`."""

from __future__ import annotations

from pre_autorizacion.shared.api.schemas import CamelModel
from pre_autorizacion.shared.domain.entities import Procedure


class ProcedureOut(CamelModel):
    code: str
    name: str
    category: str | None = None
    waiting_days_typical: int | None = None


def procedure_to_out(p: Procedure) -> ProcedureOut:
    return ProcedureOut(
        code=p.code,
        name=p.name,
        category=p.category,
        waiting_days_typical=p.waiting_days_typical,
    )


__all__ = ["ProcedureOut", "procedure_to_out"]
```

- [ ] **Step 2: Re-export in `api/schemas/__init__.py`**

```python
from pre_autorizacion.features.procedures.api.schemas.procedures import (
    ProcedureOut,
    procedure_to_out,
)

__all__ = ["ProcedureOut", "procedure_to_out"]
```

- [ ] **Step 3: Create `api/routers/procedures.py`**

```python
"""Router FastAPI del feature `procedures`."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from pre_autorizacion.features.auth.domain.entities import User
from pre_autorizacion.features.procedures.api.schemas import ProcedureOut, procedure_to_out
from pre_autorizacion.features.procedures.application.use_cases import ListProceduresUseCase
from pre_autorizacion.shared.api.deps import ProcedureRepositoryDep, require_authenticated

router = APIRouter(prefix="/api/v1/procedures", tags=["procedures"])


def _get_use_case(repo: ProcedureRepositoryDep) -> ListProceduresUseCase:
    return ListProceduresUseCase(procedure_repository=repo)


ListProceduresDep = Annotated[ListProceduresUseCase, Depends(_get_use_case)]


@router.get("", response_model=list[ProcedureOut], summary="List or search procedures")
async def list_procedures(
    use_case: ListProceduresDep,
    _user: Annotated[User, Depends(require_authenticated)],
    q: Annotated[str | None, Query(description="Substring filter by code or name.")] = None,
) -> list[ProcedureOut]:
    items = await use_case.execute(q)
    return [procedure_to_out(p) for p in items]


__all__ = ["router"]
```

- [ ] **Step 4: Re-export router in `api/routers/__init__.py`**

```python
from pre_autorizacion.features.procedures.api.routers.procedures import router

__all__ = ["router"]
```

Empty `api/__init__.py`.

- [ ] **Step 5: Add DI factory to `config/di.py`**

After `get_case_repository(...)`, add:

```python
@lru_cache(maxsize=1)
def get_procedure_repository(settings: Settings | None = None) -> ProcedureRepository:
    """Procedure catalog — in-memory in v1 (Notion adapter is post-v1)."""
    _ = settings or get_settings()
    from pre_autorizacion.features.procedures.infrastructure.repos import (  # noqa: PLC0415
        InMemoryProcedureRepository,
    )
    return InMemoryProcedureRepository()
```

Add the import at the top of the file:

```python
from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
```

Add `"get_procedure_repository"` to `__all__` and to `reset_container()`:

```python
def reset_container() -> None:
    ...
    get_procedure_repository.cache_clear()
```

- [ ] **Step 6: Add `ProcedureRepositoryDep` to `shared/api/deps.py`**

Add the import:

```python
from pre_autorizacion.config.di import (
    ...
    get_procedure_repository,
    ...
)
from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
```

Add the typed dep alias near the other ones:

```python
ProcedureRepositoryDep = Annotated[ProcedureRepository, Depends(get_procedure_repository)]
```

Add to `__all__`.

- [ ] **Step 7: Wire the router in `main.py`**

Replace the `for module_path in (…)` block (the procedures probe) with a direct include:

```python
    from pre_autorizacion.features.procedures.api.routers import (  # noqa: PLC0415
        router as procedures_router,
    )
    app.include_router(procedures_router)
```

- [ ] **Step 8: Verify the app boots and the route is registered**

Run: `cd backend && uv run python -c "from pre_autorizacion.main import app; print([r.path for r in app.routes if 'procedures' in r.path])"`
Expected: `['/api/v1/procedures']`

- [ ] **Step 9: Commit**

```bash
git add backend/src/pre_autorizacion/features/procedures backend/src/pre_autorizacion/config/di.py backend/src/pre_autorizacion/shared/api/deps.py backend/src/pre_autorizacion/main.py
git commit -m "feat(backend): wire procedures router + DI factory"
```

---

### Task 4: Backend — Policy/Coverage CRUD ports + in-memory implementations

**Files:**
- Modify: `backend/src/pre_autorizacion/features/policies/domain/ports/policy_repository.py`
- Modify: `backend/src/pre_autorizacion/features/policies/domain/ports/coverage_repository.py`
- Modify: `backend/src/pre_autorizacion/features/policies/infrastructure/repos/in_memory_policy.py`
- Modify: `backend/src/pre_autorizacion/features/policies/infrastructure/repos/in_memory_coverage.py`
- Modify: `backend/src/pre_autorizacion/features/policies/infrastructure/repos/notion_policy.py`
- Modify: `backend/src/pre_autorizacion/features/policies/infrastructure/repos/notion_coverage.py`

- [ ] **Step 1: Add CRUD methods to `PolicyRepository` port**

Replace the body of `policy_repository.py` with:

```python
"""PolicyRepository — port para pólizas (read + CRUD)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from pre_autorizacion.features.policies.domain.entities import Policy


class PolicyRepository(ABC):
    @abstractmethod
    async def list(self) -> tuple[Policy, ...]: ...

    @abstractmethod
    async def find_by_number(self, n: str) -> Policy | None: ...

    @abstractmethod
    async def create(self, policy: Policy) -> Policy:
        """Persist a new policy. Raises if `policy.number` already exists."""

    @abstractmethod
    async def update(self, policy: Policy) -> Policy:
        """Replace the policy identified by `policy.number`. Raises if missing."""

    @abstractmethod
    async def delete(self, number: str) -> None:
        """Remove the policy by number. No-op if it doesn't exist (idempotent)."""
```

- [ ] **Step 2: Add `replace_for_policy` to `CoverageRepository` port**

Append to `coverage_repository.py` inside the class:

```python
    @abstractmethod
    async def replace_for_policy(
        self,
        policy_number: str,
        coverages: tuple[Coverage, ...],
    ) -> tuple[Coverage, ...]:
        """Atomically replace the full coverage set for `policy_number`."""
```

- [ ] **Step 3: Implement CRUD in `in_memory_policy.py`**

Replace the body with:

```python
"""InMemoryPolicyRepository — fallback adapter (read + CRUD) seedeado con SEED_POLICIES."""

from __future__ import annotations

from collections.abc import Iterable

from pre_autorizacion.features.policies.domain.entities import Policy
from pre_autorizacion.features.policies.domain.ports import PolicyRepository
from pre_autorizacion.shared.domain.errors import NotFoundError
from pre_autorizacion.shared.fixtures import SEED_POLICIES


class PolicyAlreadyExistsError(Exception):
    """Raised when create() is called with a number that already exists."""


class PolicyNotFoundError(NotFoundError):
    title = "Policy not found"


class InMemoryPolicyRepository(PolicyRepository):
    def __init__(self, seed: Iterable[Policy] = SEED_POLICIES) -> None:
        self._policies: dict[str, Policy] = {p.number: p for p in seed}

    async def list(self) -> tuple[Policy, ...]:
        return tuple(self._policies.values())

    async def find_by_number(self, n: str) -> Policy | None:
        return self._policies.get(n)

    async def create(self, policy: Policy) -> Policy:
        if policy.number in self._policies:
            raise PolicyAlreadyExistsError(f"Policy already exists: {policy.number!r}")
        self._policies[policy.number] = policy
        return policy

    async def update(self, policy: Policy) -> Policy:
        if policy.number not in self._policies:
            raise PolicyNotFoundError(f"No policy: {policy.number!r}")
        self._policies[policy.number] = policy
        return policy

    async def delete(self, number: str) -> None:
        self._policies.pop(number, None)
```

- [ ] **Step 4: Implement `replace_for_policy` in `in_memory_coverage.py`**

Open the file, find the class. Add this method (and a helper to keep state mutable):

```python
    async def replace_for_policy(
        self,
        policy_number: str,
        coverages: tuple[Coverage, ...],
    ) -> tuple[Coverage, ...]:
        # Filter out any existing for this policy, then append the new set.
        kept = tuple(c for c in self._coverages if c.policy_number != policy_number)
        new = tuple(c for c in coverages if c.policy_number == policy_number)
        self._coverages = kept + new
        return new
```

If `_coverages` is currently a `tuple` declared in `__init__`, leave the type as `tuple[Coverage, ...]` but allow reassignment (it is a regular instance attribute, not frozen).

- [ ] **Step 5: Stub Notion adapters**

In `notion_policy.py`, **add** these methods to the existing `NotionPolicyRepository` class:

```python
    async def create(self, policy: Policy) -> Policy:  # type: ignore[override]
        raise NotImplementedError(
            "CRUD on Notion is out of scope for v1. Use InMemoryPolicyRepository."
        )

    async def update(self, policy: Policy) -> Policy:  # type: ignore[override]
        raise NotImplementedError(
            "CRUD on Notion is out of scope for v1. Use InMemoryPolicyRepository."
        )

    async def delete(self, number: str) -> None:  # type: ignore[override]
        raise NotImplementedError(
            "CRUD on Notion is out of scope for v1. Use InMemoryPolicyRepository."
        )
```

In `notion_coverage.py`, add:

```python
    async def replace_for_policy(  # type: ignore[override]
        self,
        policy_number: str,
        coverages: tuple[Coverage, ...],
    ) -> tuple[Coverage, ...]:
        raise NotImplementedError(
            "CRUD on Notion is out of scope for v1. Use InMemoryCoverageRepository."
        )
```

- [ ] **Step 6: Verify existing tests still pass**

Run: `cd backend && uv run pytest -q`
Expected: 45 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/src/pre_autorizacion/features/policies
git commit -m "feat(backend): extend Policy/Coverage ports with CRUD + in-memory impls"
```

---

### Task 5: Backend — Policy CRUD use cases + endpoints

**Files:**
- Create: `backend/src/pre_autorizacion/features/policies/application/use_cases/create_policy.py`
- Create: `backend/src/pre_autorizacion/features/policies/application/use_cases/update_policy.py`
- Create: `backend/src/pre_autorizacion/features/policies/application/use_cases/delete_policy.py`
- Create: `backend/src/pre_autorizacion/features/policies/application/use_cases/replace_policy_coverages.py`
- Modify: `backend/src/pre_autorizacion/features/policies/application/use_cases/__init__.py`
- Modify: `backend/src/pre_autorizacion/features/policies/api/schemas/policies.py`
- Modify: `backend/src/pre_autorizacion/features/policies/api/routers/policies.py`

- [ ] **Step 1: `create_policy.py`**

```python
"""CreatePolicyUseCase — alta de póliza."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Policy
    from pre_autorizacion.features.policies.domain.ports import PolicyRepository


@dataclass(slots=True)
class CreatePolicyUseCase:
    policy_repository: PolicyRepository

    async def execute(self, policy: Policy) -> Policy:
        return await self.policy_repository.create(policy)
```

- [ ] **Step 2: `update_policy.py`**

```python
"""UpdatePolicyUseCase — edición de póliza por número."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Policy
    from pre_autorizacion.features.policies.domain.ports import PolicyRepository


@dataclass(slots=True)
class UpdatePolicyUseCase:
    policy_repository: PolicyRepository

    async def execute(self, policy: Policy) -> Policy:
        return await self.policy_repository.update(policy)
```

- [ ] **Step 3: `delete_policy.py`**

```python
"""DeletePolicyUseCase — baja de póliza por número."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.ports import PolicyRepository


@dataclass(slots=True)
class DeletePolicyUseCase:
    policy_repository: PolicyRepository

    async def execute(self, number: str) -> None:
        await self.policy_repository.delete(number)
```

- [ ] **Step 4: `replace_policy_coverages.py`**

```python
"""ReplacePolicyCoveragesUseCase — bulk replace de coberturas para una póliza."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pre_autorizacion.features.policies.domain.entities import Coverage
    from pre_autorizacion.features.policies.domain.ports import CoverageRepository


@dataclass(slots=True)
class ReplacePolicyCoveragesUseCase:
    coverage_repository: CoverageRepository

    async def execute(
        self,
        policy_number: str,
        coverages: tuple[Coverage, ...],
    ) -> tuple[Coverage, ...]:
        return await self.coverage_repository.replace_for_policy(policy_number, coverages)
```

- [ ] **Step 5: Re-export the new use cases**

In `application/use_cases/__init__.py`, append the four imports and add the names to `__all__`. Keep existing exports.

```python
from pre_autorizacion.features.policies.application.use_cases.create_policy import (
    CreatePolicyUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.update_policy import (
    UpdatePolicyUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.delete_policy import (
    DeletePolicyUseCase,
)
from pre_autorizacion.features.policies.application.use_cases.replace_policy_coverages import (
    ReplacePolicyCoveragesUseCase,
)
```

Make sure `__all__` includes the 4 new names plus what's there already (`GetDashboardMetricsUseCase`, `GetPolicyUseCase`, `ListCoveragesUseCase`, `ListInsurersUseCase`, `ListPoliciesUseCase`).

- [ ] **Step 6: Add input DTOs to `api/schemas/policies.py`**

Append (and add to `__all__`):

```python
class PolicyIn(CamelModel):
    """Body de POST/PUT /policies."""
    number: str
    patient_id: str
    plan: str
    insurer_id: str
    start_date: date
    end_date: date
    status: PolicyStatus


class CoverageIn(CamelModel):
    """Item de PUT /policies/{number}/coverages."""
    policy_number: str
    procedure_code: str
    covered: bool
    waiting_days: int
    copay: Decimal
    required_docs: list[str] = Field(default_factory=list)


def policy_in_to_domain(body: PolicyIn) -> Policy:
    return Policy(
        number=body.number,
        patient_id=body.patient_id,
        plan=body.plan,
        insurer_id=body.insurer_id,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
    )


def coverage_in_to_domain(body: CoverageIn) -> Coverage:
    return Coverage(
        policy_number=body.policy_number,
        procedure_code=body.procedure_code,
        covered=body.covered,
        waiting_days=body.waiting_days,
        copay=body.copay,
        required_docs=tuple(body.required_docs),
    )
```

Add `Coverage` to the existing imports at the top (it's already imported).

- [ ] **Step 7: Add CRUD endpoints to `api/routers/policies.py`**

Add imports:

```python
from fastapi import status as http_status

from pre_autorizacion.features.policies.api.schemas.policies import (
    CoverageIn,
    PolicyIn,
    coverage_in_to_domain,
    policy_in_to_domain,
)
from pre_autorizacion.features.policies.application.use_cases import (
    CreatePolicyUseCase,
    DeletePolicyUseCase,
    ReplacePolicyCoveragesUseCase,
    UpdatePolicyUseCase,
)
```

Add the DI helpers:

```python
def _get_create_policy(repo: PolicyRepositoryDep) -> CreatePolicyUseCase:
    return CreatePolicyUseCase(policy_repository=repo)


def _get_update_policy(repo: PolicyRepositoryDep) -> UpdatePolicyUseCase:
    return UpdatePolicyUseCase(policy_repository=repo)


def _get_delete_policy(repo: PolicyRepositoryDep) -> DeletePolicyUseCase:
    return DeletePolicyUseCase(policy_repository=repo)


def _get_replace_coverages(repo: CoverageRepositoryDep) -> ReplacePolicyCoveragesUseCase:
    return ReplacePolicyCoveragesUseCase(coverage_repository=repo)


CreatePolicyDep = Annotated[CreatePolicyUseCase, Depends(_get_create_policy)]
UpdatePolicyDep = Annotated[UpdatePolicyUseCase, Depends(_get_update_policy)]
DeletePolicyDep = Annotated[DeletePolicyUseCase, Depends(_get_delete_policy)]
ReplaceCoveragesDep = Annotated[ReplacePolicyCoveragesUseCase, Depends(_get_replace_coverages)]
```

Add the endpoints:

```python
@router.post(
    "/policies",
    response_model=PolicyOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create a policy (insurer-only)",
)
async def create_policy(
    body: PolicyIn,
    use_case: CreatePolicyDep,
    _user: Annotated[User, Depends(require_role(Role.INSURER))],
) -> PolicyOut:
    policy = await use_case.execute(policy_in_to_domain(body))
    return policy_to_out(policy)


@router.put(
    "/policies/{number}",
    response_model=PolicyOut,
    summary="Update a policy by number (insurer-only)",
)
async def update_policy(
    number: str,
    body: PolicyIn,
    use_case: UpdatePolicyDep,
    _user: Annotated[User, Depends(require_role(Role.INSURER))],
) -> PolicyOut:
    if body.number != number:
        from pre_autorizacion.shared.domain.errors import ValidationError
        raise ValidationError(f"Path number {number!r} does not match body number {body.number!r}")
    policy = await use_case.execute(policy_in_to_domain(body))
    return policy_to_out(policy)


@router.delete(
    "/policies/{number}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete a policy by number (insurer-only)",
)
async def delete_policy(
    number: str,
    use_case: DeletePolicyDep,
    _user: Annotated[User, Depends(require_role(Role.INSURER))],
) -> None:
    await use_case.execute(number)


@router.put(
    "/policies/{number}/coverages",
    response_model=list[CoverageOut],
    summary="Replace all coverages for a policy (insurer-only)",
)
async def replace_coverages(
    number: str,
    body: list[CoverageIn],
    use_case: ReplaceCoveragesDep,
    _user: Annotated[User, Depends(require_role(Role.INSURER))],
) -> list[CoverageOut]:
    new = await use_case.execute(
        number,
        tuple(coverage_in_to_domain(item) for item in body),
    )
    return [coverage_to_out(c) for c in new]
```

- [ ] **Step 8: Make sure `ValidationError` exists in `shared/domain/errors.py`**

Run: `Grep "class ValidationError" backend/src/pre_autorizacion/shared/domain/errors.py`. If absent, add:

```python
class ValidationError(Exception):
    """Generic 400 — input does not match domain expectations."""
    title = "Validation error"
```

If present, no change.

- [ ] **Step 9: Boot check**

Run: `cd backend && uv run python -c "from pre_autorizacion.main import app; print(sorted(r.path for r in app.routes if 'policies' in r.path or 'coverages' in r.path))"`
Expected (order may vary):
```
['/api/v1/coverages', '/api/v1/policies', '/api/v1/policies/{number}', '/api/v1/policies/{number}/coverages', '/api/v1/policies/{number}/coverages']
```
(The two `coverages` paths are GET + PUT — same path, different methods.)

- [ ] **Step 10: Commit**

```bash
git add backend/src/pre_autorizacion/features/policies backend/src/pre_autorizacion/shared/domain/errors.py
git commit -m "feat(backend): policy/coverage CRUD use cases + endpoints (insurer-only)"
```

---

### Task 6: Backend — PDF upload + file download endpoints

**Files:**
- Modify: `backend/src/pre_autorizacion/features/authorization_cases/api/routers/cases.py`
- Modify: `backend/src/pre_autorizacion/features/authorization_cases/api/schemas/cases.py` (already has what we need)

- [ ] **Step 1: Add upload endpoint to `cases.py` router**

Add imports at the top:

```python
import re

from fastapi import File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from pre_autorizacion.features.authorization_cases.domain.entities import (
    MedicalReport,
    ReportFormat,
)
from pre_autorizacion.shared.api.deps import FileStorageDep, SettingsDep
```

Add this helper above the existing endpoints:

```python
_PDF_FILENAME_RE = re.compile(r"^[A-Za-z0-9_\-]+\.pdf$")
_PDF_MAGIC = b"%PDF-"


def _validate_pdf_filename(filename: str) -> str:
    if not _PDF_FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    return filename
```

Add the upload endpoint:

```python
@router.post(
    "/upload",
    response_model=CaseOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a new authorization case with a PDF report (multipart)",
)
async def submit_case_upload(
    use_case: SubmitUseCaseDep,
    storage: FileStorageDep,
    settings: SettingsDep,
    _user: Annotated[User, Depends(require_authenticated)],
    policy_number: Annotated[str, Form(...)],
    patient_id: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)],
    procedure_solicited_hint: Annotated[str | None, Form()] = None,
    diagnosis: Annotated[str | None, Form()] = None,
    attending_doctor: Annotated[str | None, Form()] = None,
    scenario_key: Annotated[str | None, Form()] = None,
) -> CaseOut:
    """PDF upload variant of `POST /api/v1/cases`. Stores the file via FileStorage."""
    max_bytes = settings.max_upload_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds max size of {settings.max_upload_mb}MB",
        )
    if not content.startswith(_PDF_MAGIC):
        raise HTTPException(status_code=415, detail="File is not a valid PDF")

    case_id = f"CASE-{uuid.uuid4().hex[:8].upper()}"
    storage_filename = f"{uuid.uuid4().hex}.pdf"
    storage_key = f"{case_id}/{storage_filename}"
    saved_key = await storage.save(storage_key, content, content_type="application/pdf")

    report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
    domain_report = MedicalReport(
        id=report_id,
        patient_id=patient_id,
        format=ReportFormat.PDF,
        content=saved_key,
        submitted_at=datetime.now(UTC),
        procedure_solicited_hint=procedure_solicited_hint,
        diagnosis=diagnosis,
        attending_doctor=attending_doctor,
    )

    use_case_input = SubmitCaseInput(
        report=domain_report,
        policy_number=policy_number,
        scenario_key=scenario_key,
    )
    case = await use_case.execute(use_case_input)
    return case_to_out(case)
```

Add the file download endpoint:

```python
@router.get(
    "/{case_id}/files/{filename}",
    summary="Download a file attached to a case (auth + RBAC)",
)
async def download_case_file(
    case_id: str,
    filename: str,
    storage: FileStorageDep,
    case_repo: CaseRepositoryDep,
    _user: Annotated[User, Depends(require_authenticated)],
) -> StreamingResponse:
    """Serves a stored PDF after RBAC + path-traversal checks."""
    safe_filename = _validate_pdf_filename(filename)
    case = await case_repo.find_by_id(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_key = f"{case_id}/{safe_filename}"
    try:
        data = await storage.read(storage_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc

    def _iter() -> object:
        yield data

    return StreamingResponse(
        _iter(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_filename}"'},
    )
```

- [ ] **Step 2: Boot check**

Run: `cd backend && uv run python -c "from pre_autorizacion.main import app; print(sorted({(r.methods, r.path) for r in app.routes if hasattr(r, 'methods') and '/cases' in r.path}, key=str))"`
Expected: includes `({'POST'}, '/api/v1/cases/upload')` and `({'GET'}, '/api/v1/cases/{case_id}/files/{filename}')`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/pre_autorizacion/features/authorization_cases
git commit -m "feat(backend): add PDF upload and authenticated file download endpoints"
```

---

### Task 7: Backend — Integration tests for the new surface

**Files:**
- Create: `backend/tests/integration/api/__init__.py` (empty)
- Create: `backend/tests/integration/api/conftest.py`
- Create: `backend/tests/integration/api/test_auth_flow.py`
- Create: `backend/tests/integration/api/test_policy_crud.py`
- Create: `backend/tests/integration/api/test_case_upload.py`
- Create: `backend/tests/integration/api/test_procedures.py`

- [ ] **Step 1: `conftest.py` with TestClient + fresh container per test**

```python
"""Integration test fixtures — FastAPI TestClient + reset DI between tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from pre_autorizacion.config.di import reset_container
from pre_autorizacion.main import create_app


@pytest.fixture(autouse=True)
def _reset_di() -> Iterator[None]:
    reset_container()
    yield
    reset_container()


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def login(client: TestClient, email: str, password: str) -> str:
    """Helper: returns the access token from a successful login."""
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: `test_auth_flow.py`**

```python
"""Integration tests — login, refresh, me, logout."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login


class TestAuthFlow:
    def test_login_with_valid_credentials_returns_tokens(self, client: TestClient) -> None:
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "hospital@demo.com", "password": "hospital"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["accessToken"]
        assert body["refreshToken"]
        assert body["user"]["role"] == "hospital"

    def test_login_with_bad_password_returns_401(self, client: TestClient) -> None:
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "hospital@demo.com", "password": "wrong"},
        )
        assert res.status_code == 401

    def test_me_returns_current_user(self, client: TestClient) -> None:
        token = login(client, "auditor@demo.com", "auditor")
        res = client.get("/api/v1/auth/me", headers=auth_header(token))
        assert res.status_code == 200
        assert res.json()["role"] == "auditor"

    def test_refresh_returns_new_access_token(self, client: TestClient) -> None:
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": "insurer@demo.com", "password": "insurer"},
        )
        refresh_token = login_res.json()["refreshToken"]
        res = client.post(
            "/api/v1/auth/refresh",
            json={"refreshToken": refresh_token},
        )
        assert res.status_code == 200
        assert res.json()["accessToken"]

    def test_logout_returns_204(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post("/api/v1/auth/logout", headers=auth_header(token))
        assert res.status_code == 204
```

- [ ] **Step 3: `test_policy_crud.py`**

```python
"""Integration tests — policy CRUD + RBAC + replace coverages."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login

NEW_POLICY = {
    "number": "POL-NEW-0001",
    "patientId": "PAC-00481",
    "plan": "Plan Test",
    "insurerId": "INS-ANDINA",
    "startDate": "2026-01-01",
    "endDate": "2027-01-01",
    "status": "ACTIVE",
}


class TestPolicyCrud:
    def test_create_policy_as_insurer(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        res = client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        assert res.status_code == 201
        assert res.json()["number"] == "POL-NEW-0001"

    def test_create_policy_as_hospital_is_forbidden(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        assert res.status_code == 403

    def test_update_policy(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        updated = {**NEW_POLICY, "plan": "Plan Updated"}
        res = client.put(
            f"/api/v1/policies/{NEW_POLICY['number']}",
            json=updated,
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert res.json()["plan"] == "Plan Updated"

    def test_update_policy_path_body_mismatch_returns_400(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        res = client.put(
            "/api/v1/policies/POL-OTHER",
            json=NEW_POLICY,
            headers=auth_header(token),
        )
        assert res.status_code == 400

    def test_delete_policy(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        res = client.delete(
            f"/api/v1/policies/{NEW_POLICY['number']}",
            headers=auth_header(token),
        )
        assert res.status_code == 204
        get_res = client.get(
            f"/api/v1/policies/{NEW_POLICY['number']}",
            headers=auth_header(token),
        )
        assert get_res.status_code == 404

    def test_replace_coverages(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        coverages = [
            {
                "policyNumber": NEW_POLICY["number"],
                "procedureCode": "K80.20",
                "covered": True,
                "waitingDays": 90,
                "copay": "80",
                "requiredDocs": ["Informe médico", "Eco abdominal"],
            }
        ]
        res = client.put(
            f"/api/v1/policies/{NEW_POLICY['number']}/coverages",
            json=coverages,
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["procedureCode"] == "K80.20"
```

- [ ] **Step 4: `test_case_upload.py`**

```python
"""Integration tests — multipart PDF upload + file download."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login

# Minimal valid-looking PDF: "%PDF-1.4\n..." — enough for our magic-byte check.
_FAKE_PDF = b"%PDF-1.4\n%\x80\x80\x80\x80\n1 0 obj <<>> endobj trailer<<>> %%EOF"


class TestCaseUpload:
    def test_upload_pdf_creates_case(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post(
            "/api/v1/cases/upload",
            files={"file": ("informe.pdf", _FAKE_PDF, "application/pdf")},
            data={
                "policy_number": "POL-2024-04812",
                "patient_id": "PAC-00481",
                "procedure_solicited_hint": "K80.20",
            },
            headers=auth_header(token),
        )
        assert res.status_code == 202, res.text
        body = res.json()
        assert body["id"].startswith("CASE-")
        assert body["status"] in {"APROBADO_AUTO", "DOCS_PEDIDOS", "ESCALADO"}

    def test_upload_non_pdf_returns_415(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post(
            "/api/v1/cases/upload",
            files={"file": ("notes.txt", b"not a pdf", "text/plain")},
            data={"policy_number": "POL-2024-04812", "patient_id": "PAC-00481"},
            headers=auth_header(token),
        )
        assert res.status_code == 415

    def test_upload_too_large_returns_413(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        # 11 MB of garbage prefixed with PDF magic so the size check fires first.
        big = _FAKE_PDF + b"\x00" * (11 * 1024 * 1024)
        res = client.post(
            "/api/v1/cases/upload",
            files={"file": ("huge.pdf", big, "application/pdf")},
            data={"policy_number": "POL-2024-04812", "patient_id": "PAC-00481"},
            headers=auth_header(token),
        )
        assert res.status_code == 413

    def test_download_file_with_traversal_filename_returns_400(
        self, client: TestClient
    ) -> None:
        token = login(client, "auditor@demo.com", "auditor")
        res = client.get(
            "/api/v1/cases/CASE-XYZ/files/..%2Fevil.pdf",
            headers=auth_header(token),
        )
        assert res.status_code == 400
```

- [ ] **Step 5: `test_procedures.py`**

```python
"""Integration tests — procedures listing + search."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login


class TestProcedures:
    def test_list_returns_seed_catalog(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get("/api/v1/procedures", headers=auth_header(token))
        assert res.status_code == 200
        assert len(res.json()) >= 6

    def test_search_filters_results(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get("/api/v1/procedures?q=catarata", headers=auth_header(token))
        assert res.status_code == 200
        body = res.json()
        assert all("catarata" in p["name"].lower() for p in body)
        assert len(body) >= 1

    def test_unauthenticated_request_returns_401(self, client: TestClient) -> None:
        res = client.get("/api/v1/procedures")
        assert res.status_code == 401
```

- [ ] **Step 6: Run the new tests**

Run: `cd backend && uv run pytest tests/integration -v`
Expected: all tests green. If `_reset_di` clears caches but a fixture leaks a pre-seeded policy, double-check that `InMemoryPolicyRepository` is rebuilt from `SEED_POLICIES` per request.

If any test reveals a real bug, fix it before continuing — do not change the test to mask it.

- [ ] **Step 7: Run the full suite**

Run: `cd backend && uv run pytest -q`
Expected: 45 unit + new integration tests, all green.

- [ ] **Step 8: Commit**

```bash
git add backend/tests/integration
git commit -m "test(backend): integration tests for auth, policy CRUD, upload, procedures"
```

---

### Task 8: Backend — dump `openapi.json` for the frontend type generator

**Files:**
- Create: `frontend/openapi.json` (generated; not committed if you prefer — see step 4)

- [ ] **Step 1: Boot the backend (background)**

Run: `cd backend && uv run uvicorn pre_autorizacion.main:app --port 8000` in a new terminal.

- [ ] **Step 2: Dump the schema**

Run: `curl http://localhost:8000/openapi.json -o ../frontend/openapi.json`
Expected: file `frontend/openapi.json` exists, ~50 KB.

- [ ] **Step 3: Stop the backend**

Ctrl-C the uvicorn process.

- [ ] **Step 4: Commit**

```bash
git add frontend/openapi.json
git commit -m "chore: snapshot openapi.json for frontend type generation"
```

---

### Task 9: Frontend — install `openapi-typescript`, add `gen:api` script, generate types

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/app/shared/api/schema.d.ts` (generated)

- [ ] **Step 1: Install the dev dep**

Run: `cd frontend && npm install --save-dev openapi-typescript`
Expected: package added under `devDependencies`.

- [ ] **Step 2: Add the `gen:api` script**

In `frontend/package.json` under `"scripts"`, add:

```json
"gen:api": "openapi-typescript ./openapi.json -o src/app/shared/api/schema.d.ts"
```

- [ ] **Step 3: Generate the types**

Run: `cd frontend && npm run gen:api`
Expected: `src/app/shared/api/schema.d.ts` created with `paths`, `components`, `operations` exports.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors related to `schema.d.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/app/shared/api/schema.d.ts
git commit -m "chore(frontend): add openapi-typescript + generated API schema types"
```

---

### Task 10: Frontend — environment files + `provideHttpClient` with interceptors (skeletons)

**Files:**
- Create: `frontend/src/environments/environment.ts`
- Create: `frontend/src/environments/environment.production.ts`
- Modify: `frontend/angular.json`
- Create: `frontend/src/app/shared/api/api-base-url.token.ts`
- Create: `frontend/src/app/shared/api/errors/api-error.ts`
- Create: `frontend/src/app/shared/api/interceptors/auth.interceptor.ts` (skeleton — no auth yet)
- Create: `frontend/src/app/shared/api/interceptors/error.interceptor.ts`
- Modify: `frontend/src/app/app.config.ts`

- [ ] **Step 1: `environment.ts`**

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
  agentStepDelayMs: 200,
};
```

- [ ] **Step 2: `environment.production.ts`**

```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.example.com',
  agentStepDelayMs: 200,
};
```

- [ ] **Step 3: `angular.json` `fileReplacements`**

In `angular.json` → `projects.frontend.architect.build.configurations.production`, add (or extend):

```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.production.ts"
  }
]
```

- [ ] **Step 4: `api-base-url.token.ts`**

```typescript
import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});
```

- [ ] **Step 5: `errors/api-error.ts`**

```typescript
/**
 * ApiError — typed wrapper around RFC 7807 problem+json responses, plus
 * fallback for transport-level failures.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly title?: string,
    readonly detail?: string,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

- [ ] **Step 6: `interceptors/error.interceptor.ts`**

```typescript
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiError } from '../errors/api-error';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error ?? {};
        const message = body?.detail ?? body?.title ?? err.message ?? 'Request failed';
        return throwError(
          () =>
            new ApiError(
              err.status,
              message,
              body?.title,
              body?.detail,
              err.headers.get('x-request-id') ?? undefined,
            ),
        );
      }
      return throwError(() => err);
    }),
  );
```

- [ ] **Step 7: `interceptors/auth.interceptor.ts` (skeleton — completed in Task 11)**

```typescript
import { type HttpInterceptorFn } from '@angular/common/http';

/**
 * AuthInterceptor — attaches the bearer token to outbound requests.
 * The full implementation (with refresh-on-401) lands in Task 11 once the
 * AuthFacade exists.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => next(req);
```

- [ ] **Step 8: Wire `provideHttpClient` + interceptors in `app.config.ts`**

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './shared/api/interceptors/auth.interceptor';
import { errorInterceptor } from './shared/api/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
```

- [ ] **Step 9: Build check**

Run: `cd frontend && npm run build -- --configuration development`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add frontend/angular.json frontend/src/environments frontend/src/app/app.config.ts frontend/src/app/shared/api
git commit -m "feat(frontend): provideHttpClient + environment + interceptor skeletons"
```

---

### Task 11: Frontend — Auth feature (domain + application + infrastructure + login page)

**Files:**
- Create: `frontend/src/app/features/auth/domain/entities/user.ts`
- Create: `frontend/src/app/features/auth/domain/value-objects/auth-tokens.ts`
- Create: `frontend/src/app/features/auth/domain/ports/auth-repository.port.ts`
- Create: `frontend/src/app/features/auth/domain/ports/token-store.port.ts`
- Create: `frontend/src/app/features/auth/application/use-cases/login.use-case.ts`
- Create: `frontend/src/app/features/auth/application/use-cases/logout.use-case.ts`
- Create: `frontend/src/app/features/auth/application/use-cases/refresh-session.use-case.ts`
- Create: `frontend/src/app/features/auth/application/facades/auth.facade.ts`
- Create: `frontend/src/app/features/auth/infrastructure/repos/http-auth.repository.ts`
- Create: `frontend/src/app/features/auth/infrastructure/stores/in-memory-token.store.ts`
- Create: `frontend/src/app/features/auth/presentation/pages/login/login.page.ts`
- Modify: `frontend/src/app/shared/api/interceptors/auth.interceptor.ts`
- Create: `frontend/src/app/shared/guards/auth.guard.ts`
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/core/services/role.service.ts`

> Each file holds one class/function/const per the project rule. Update each parent `__init__`/`index.ts` as you create files.

- [ ] **Step 1: Domain — `user.ts`**

```typescript
import type { Role } from '../../../../core/types/role';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}
```

- [ ] **Step 2: Domain — `auth-tokens.ts`**

```typescript
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}
```

- [ ] **Step 3: Domain — `auth-repository.port.ts`**

```typescript
import type { Observable } from 'rxjs';

import type { User } from '../entities/user';
import type { AuthTokens } from '../value-objects/auth-tokens';

export interface LoginResult {
  readonly tokens: AuthTokens;
  readonly user: User;
}

export abstract class AuthRepository {
  abstract login(email: string, password: string): Observable<LoginResult>;
  abstract refresh(refreshToken: string): Observable<{ accessToken: string }>;
  abstract me(): Observable<User>;
  abstract logout(): Observable<void>;
}
```

- [ ] **Step 4: Domain — `token-store.port.ts`**

```typescript
import type { AuthTokens } from '../value-objects/auth-tokens';

export abstract class TokenStore {
  abstract get(): AuthTokens | null;
  abstract set(tokens: AuthTokens): void;
  abstract clear(): void;
}
```

- [ ] **Step 5: Infrastructure — `in-memory-token.store.ts`**

```typescript
import { Injectable } from '@angular/core';

import type { AuthTokens } from '../../domain/value-objects/auth-tokens';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class InMemoryTokenStore extends TokenStore {
  private tokens: AuthTokens | null = null;

  override get(): AuthTokens | null {
    return this.tokens;
  }

  override set(tokens: AuthTokens): void {
    this.tokens = tokens;
  }

  override clear(): void {
    this.tokens = null;
  }
}
```

- [ ] **Step 6: Infrastructure — `http-auth.repository.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { AuthRepository, type LoginResult } from '../../domain/ports/auth-repository.port';
import type { User } from '../../domain/entities/user';

interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: User['role'] };
}

interface RefreshResponseDto {
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class HttpAuthRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  override login(email: string, password: string): Observable<LoginResult> {
    return this.http
      .post<LoginResponseDto>(`${this.base}/api/v1/auth/login`, { email, password })
      .pipe(
        map((dto) => ({
          tokens: { accessToken: dto.accessToken, refreshToken: dto.refreshToken },
          user: dto.user,
        })),
      );
  }

  override refresh(refreshToken: string): Observable<{ accessToken: string }> {
    return this.http.post<RefreshResponseDto>(
      `${this.base}/api/v1/auth/refresh`,
      { refreshToken },
    );
  }

  override me(): Observable<User> {
    return this.http.get<User>(`${this.base}/api/v1/auth/me`);
  }

  override logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/api/v1/auth/logout`, {});
  }
}
```

- [ ] **Step 7: Application use cases**

`login.use-case.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { tap, type Observable } from 'rxjs';

import { AuthRepository, type LoginResult } from '../../domain/ports/auth-repository.port';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class LoginUseCase {
  private readonly repo = inject(AuthRepository);
  private readonly store = inject(TokenStore);

  execute(email: string, password: string): Observable<LoginResult> {
    return this.repo.login(email, password).pipe(
      tap((result) => this.store.set(result.tokens)),
    );
  }
}
```

`logout.use-case.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { catchError, of, tap, type Observable } from 'rxjs';

import { AuthRepository } from '../../domain/ports/auth-repository.port';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class LogoutUseCase {
  private readonly repo = inject(AuthRepository);
  private readonly store = inject(TokenStore);

  execute(): Observable<void> {
    return this.repo.logout().pipe(
      catchError(() => of(void 0)),
      tap(() => this.store.clear()),
    );
  }
}
```

`refresh-session.use-case.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { tap, type Observable } from 'rxjs';

import { AuthRepository } from '../../domain/ports/auth-repository.port';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class RefreshSessionUseCase {
  private readonly repo = inject(AuthRepository);
  private readonly store = inject(TokenStore);

  execute(): Observable<{ accessToken: string }> {
    const tokens = this.store.get();
    if (!tokens) {
      throw new Error('No refresh token available');
    }
    return this.repo.refresh(tokens.refreshToken).pipe(
      tap((res) =>
        this.store.set({ accessToken: res.accessToken, refreshToken: tokens.refreshToken }),
      ),
    );
  }
}
```

- [ ] **Step 8: `auth.facade.ts`**

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap, type Observable } from 'rxjs';

import type { Role } from '../../../../core/types/role';
import type { User } from '../../domain/entities/user';
import { LoginUseCase } from '../use-cases/login.use-case';
import { LogoutUseCase } from '../use-cases/logout.use-case';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly loginUC = inject(LoginUseCase);
  private readonly logoutUC = inject(LogoutUseCase);
  private readonly tokens = inject(TokenStore);

  private readonly _user = signal<User | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly accessToken = computed(() => this.tokens.get()?.accessToken ?? null);
  readonly role = computed<Role>(() => this._user()?.role ?? 'hospital');

  login(email: string, password: string): Observable<User> {
    return this.loginUC.execute(email, password).pipe(
      tap((res) => this._user.set(res.user)),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      // shape conversion: we want to expose just the User
      // (use a plain map but tap is fine because callers only consume the User next)
    ) as unknown as Observable<User>;
  }

  logout(): void {
    this.logoutUC.execute().subscribe();
    this._user.set(null);
  }
}
```

> The cast at the end of `login` is intentional — the use case returns `LoginResult` but the facade's public contract is `Observable<User>`. We could `pipe(map(r => r.user))` instead. Prefer the explicit map:

Replace the `login` body with the map version:

```typescript
  login(email: string, password: string): Observable<User> {
    return this.loginUC.execute(email, password).pipe(
      tap((res) => this._user.set(res.user)),
      map((res) => res.user),
    );
  }
```

…and add `import { map, tap, type Observable } from 'rxjs';`.

- [ ] **Step 9: `login.page.ts`**

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthFacade } from '../../../application/facades/auth.facade';
import { ApiError } from '../../../../../shared/api/errors/api-error';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="min-h-screen flex items-center justify-center bg-base-100 p-6">
      <form
        (ngSubmit)="submit()"
        class="card w-full max-w-md bg-base-200 p-6 shadow-xl space-y-4"
      >
        <h1 class="text-2xl font-semibold">Iniciar sesión</h1>

        <label class="form-control">
          <span class="label-text">Email</span>
          <input
            type="email"
            class="input input-bordered"
            name="email"
            [(ngModel)]="email"
            required
            autocomplete="email"
          />
        </label>

        <label class="form-control">
          <span class="label-text">Contraseña</span>
          <input
            type="password"
            class="input input-bordered"
            name="password"
            [(ngModel)]="password"
            required
            autocomplete="current-password"
          />
        </label>

        @if (error()) {
          <p class="text-error text-sm">{{ error() }}</p>
        }

        <button type="submit" class="btn btn-primary w-full" [disabled]="loading()">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>

        <p class="text-xs opacity-70">
          Demo: hospital@demo.com / hospital · insurer@demo.com / insurer · auditor@demo.com / auditor
        </p>
      </form>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigate([`/${user.role}`]);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Error inesperado.');
      },
    });
  }
}
```

- [ ] **Step 10: Auth guard**

```typescript
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthFacade } from '../../features/auth/application/facades/auth.facade';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.parseUrl(`/login?next=${encodeURIComponent(state.url)}`);
};
```

- [ ] **Step 11: Replace stub `auth.interceptor.ts`**

```typescript
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { TokenStore } from '../../../features/auth/domain/ports/token-store.port';
import { RefreshSessionUseCase } from '../../../features/auth/application/use-cases/refresh-session.use-case';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStore);
  const refreshUC = inject(RefreshSessionUseCase);

  // Don't attach to /auth/login or /auth/refresh — they're the entry points.
  if (req.url.endsWith('/auth/login') || req.url.endsWith('/auth/refresh')) {
    return next(req);
  }

  const tokens = store.get();
  const authed = tokens
    ? req.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } })
    : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && tokens) {
        return refreshUC.execute().pipe(
          switchMap((res) =>
            next(
              req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }),
            ),
          ),
        );
      }
      return throwError(() => err);
    }),
  );
};
```

- [ ] **Step 12: Wire `/login` route + auth guard in `app.routes.ts`**

Add the login route at the top, and wrap the existing `hospital`, `insurer`, `auditor` routes with `canActivate: [authGuard]`. Concretely, the file becomes:

```typescript
import { Routes } from '@angular/router';

import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/presentation/pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'hospital',
    canActivate: [authGuard],
    children: [ /* …unchanged… */ ],
  },
  {
    path: 'insurer',
    canActivate: [authGuard],
    children: [ /* …unchanged… */ ],
  },
  {
    path: 'auditor',
    canActivate: [authGuard],
    children: [ /* …unchanged… */ ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'hospital' },
  { path: '**', redirectTo: '' },
];
```

Keep the children arrays untouched — only add `canActivate: [authGuard]` to each top-level role route and add the new `login` entry first.

- [ ] **Step 13: Bind `AuthRepository` and `TokenStore` in `app.config.ts`**

Add to the providers array:

```typescript
import { AuthRepository } from './features/auth/domain/ports/auth-repository.port';
import { TokenStore } from './features/auth/domain/ports/token-store.port';
import { HttpAuthRepository } from './features/auth/infrastructure/repos/http-auth.repository';
import { InMemoryTokenStore } from './features/auth/infrastructure/stores/in-memory-token.store';

// inside providers:
{ provide: AuthRepository, useClass: HttpAuthRepository },
{ provide: TokenStore, useClass: InMemoryTokenStore },
```

- [ ] **Step 14: Convert `RoleService` to passthrough**

Open `frontend/src/app/core/services/role.service.ts`. Keep the existing public surface (so call sites in `App` and components don't break) but make `role` come from `AuthFacade.role`. Concretely, replace the implementation with:

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthFacade } from '../../features/auth/application/facades/auth.facade';
import type { Role } from '../types/role';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly auth = inject(AuthFacade);
  // Keep an internal override (used only by the role toggle while we transition)
  private readonly _override = signal<Role | null>(null);

  readonly role = computed<Role>(() => this._override() ?? this.auth.role());

  setRole(role: Role): void {
    this._override.set(role);
  }

  clearOverride(): void {
    this._override.set(null);
  }
}
```

> Existing call sites that read `roleService.role()` keep working. The topbar role switcher continues to function (via `_override`); it becomes a debug aid until the topbar is updated to use the auth facade directly in a follow-up.

- [ ] **Step 15: Build check**

Run: `cd frontend && npm run build -- --configuration development`
Expected: build succeeds.

- [ ] **Step 16: Smoke test (manual)**

Run: terminal A → `cd backend && uv run uvicorn pre_autorizacion.main:app --reload`. Terminal B → `cd frontend && npm start`. Open `http://localhost:4200`, expect a redirect to `/login`. Log in with `hospital@demo.com / hospital` → expect redirect to `/hospital/submit`. Open DevTools Network tab and confirm the `Authorization: Bearer …` header appears on subsequent requests.

(The hospital page still renders from in-memory mocks at this stage; that's the next task.)

- [ ] **Step 17: Commit**

```bash
git add frontend/src/app/features/auth frontend/src/app/shared/guards frontend/src/app/shared/api/interceptors/auth.interceptor.ts frontend/src/app/app.config.ts frontend/src/app/app.routes.ts frontend/src/app/core/services/role.service.ts
git commit -m "feat(frontend): auth feature + login page + auth guard + interceptor"
```

---

### Task 12: Frontend — DTO↔domain mappers (shared)

**Files:**
- Create: `frontend/src/app/shared/api/mappers/case.mapper.ts`
- Create: `frontend/src/app/shared/api/mappers/policy.mapper.ts`
- Create: `frontend/src/app/shared/api/mappers/coverage.mapper.ts`
- Create: `frontend/src/app/shared/api/mappers/insurer.mapper.ts`
- Create: `frontend/src/app/shared/api/mappers/procedure.mapper.ts`

> Each mapper holds two functions: `toDomain` and `toDto` (or `toCreateBody`). One file per entity to honor the one-export-per-file rule.

- [ ] **Step 1: `policy.mapper.ts`**

```typescript
import type { components } from '../schema';
import type { Policy } from '../../../features/policies/domain/entities/policy';

type PolicyDto = components['schemas']['PolicyOut'];
type PolicyInDto = components['schemas']['PolicyIn'];

export function policyFromDto(dto: PolicyDto): Policy {
  return {
    number: dto.number,
    patientId: dto.patientId,
    plan: dto.plan,
    insurerId: dto.insurerId,
    startDate: dto.startDate,
    endDate: dto.endDate,
    status: dto.status,
  };
}

export function policyToCreateBody(p: Policy): PolicyInDto {
  return {
    number: p.number,
    patientId: p.patientId,
    plan: p.plan,
    insurerId: p.insurerId,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
  };
}
```

- [ ] **Step 2: `coverage.mapper.ts`**

```typescript
import type { components } from '../schema';
import type { Coverage } from '../../../features/policies/domain/entities/coverage';

type CoverageDto = components['schemas']['CoverageOut'];
type CoverageInDto = components['schemas']['CoverageIn'];

export function coverageFromDto(dto: CoverageDto): Coverage {
  return {
    policyNumber: dto.policyNumber,
    procedureCode: dto.procedureCode,
    covered: dto.covered,
    waitingDays: dto.waitingDays,
    copay: Number(dto.copay),
    requiredDocs: dto.requiredDocs ?? [],
  };
}

export function coverageToBody(c: Coverage): CoverageInDto {
  return {
    policyNumber: c.policyNumber,
    procedureCode: c.procedureCode,
    covered: c.covered,
    waitingDays: c.waitingDays,
    copay: String(c.copay),
    requiredDocs: c.requiredDocs ?? [],
  };
}
```

- [ ] **Step 3: `insurer.mapper.ts`**

```typescript
import type { components } from '../schema';
import type { Insurer } from '../../../features/policies/domain/entities/insurer';

type InsurerDto = components['schemas']['InsurerOut'];

export function insurerFromDto(dto: InsurerDto): Insurer {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email ?? undefined,
  };
}
```

- [ ] **Step 4: `procedure.mapper.ts`**

```typescript
import type { components } from '../schema';
import type { Procedure } from '../../domain/entities/procedure';

type ProcedureDto = components['schemas']['ProcedureOut'];

export function procedureFromDto(dto: ProcedureDto): Procedure {
  return {
    code: dto.code,
    name: dto.name,
    category: dto.category ?? undefined,
    waitingDaysTypical: dto.waitingDaysTypical ?? undefined,
  };
}
```

- [ ] **Step 5: `case.mapper.ts`**

```typescript
import type { components } from '../schema';
import type { AuthorizationCase } from '../../../features/authorization-cases/domain/entities/authorization-case';
import type { AgentDecision } from '../../../features/authorization-cases/domain/value-objects/agent-decision';
import type { TraceStep } from '../../../features/authorization-cases/domain/value-objects/trace-step';

type CaseDto = components['schemas']['CaseOut'];
type DecisionDto = components['schemas']['DecisionOut'];
type TraceStepDto = components['schemas']['TraceStepOut'];

function decisionFromDto(d: DecisionDto): AgentDecision {
  return {
    outcome: d.outcome,
    rationale: d.rationale,
    confidence: d.confidence,
    decidedBy: d.decidedBy,
    evidence: (d.evidence ?? []).map((e) => ({
      source: e.source,
      field: e.field,
      quote: e.quote,
    })),
    missingDocs: d.missingDocs ?? [],
    escalationReason: d.escalationReason ?? undefined,
    modelUsed: d.modelUsed ?? undefined,
  };
}

export function traceStepFromDto(s: TraceStepDto): TraceStep {
  return {
    node: s.node,
    timestamp: s.timestamp,
    state: s.state,
    durationMs: s.durationMs ?? undefined,
    modelUsed: s.modelUsed ?? undefined,
    tokensIn: s.tokensIn ?? undefined,
    tokensOut: s.tokensOut ?? undefined,
    detail: s.detail ?? undefined,
    error: s.error ?? undefined,
  };
}

export function caseFromDto(dto: CaseDto): AuthorizationCase {
  return {
    id: dto.id,
    status: dto.status,
    reportId: dto.reportId,
    policyNumber: dto.policyNumber,
    decision: dto.decision ? decisionFromDto(dto.decision) : undefined,
    createdAt: dto.createdAt,
    decidedAt: dto.decidedAt ?? undefined,
    // The frontend's existing `AuthorizationCase` shape may include `agentTrace`;
    // populate it from the trace endpoint or the run events. Set empty here.
    agentTrace: [],
  };
}
```

> If TS complains because the local `AuthorizationCase` shape differs from what's set, open the entity file and align — but **only** rename optional fields; do not change semantics. The intent is to keep the existing domain shape and have the mapper produce it.

- [ ] **Step 6: Build check**

Run: `cd frontend && npm run build -- --configuration development`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/api/mappers
git commit -m "feat(frontend): DTO↔domain mappers using generated openapi types"
```

---

### Task 13: Frontend — HTTP repos for cases/policies/coverages/insurers/procedures

**Files:**
- Create: `frontend/src/app/features/authorization-cases/infrastructure/repos/http-case.repository.ts`
- Create: `frontend/src/app/features/policies/infrastructure/repos/http-policy.repository.ts`
- Create: `frontend/src/app/features/policies/infrastructure/repos/http-coverage.repository.ts`
- Create: `frontend/src/app/features/policies/infrastructure/repos/http-insurer.repository.ts`
- Create: `frontend/src/app/features/authorization-cases/infrastructure/repos/http-procedure.repository.ts` (or under shared if that's where the port lives — verify)
- Modify: `frontend/src/app/app.config.ts`

> The shape of each port is already in `domain/ports/*.port.ts`. Each HTTP repo holds an internal `signal` for the cached collection and a `loadAll()` method invoked by the facade on init.

- [ ] **Step 1: `http-policy.repository.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { policyFromDto, policyToCreateBody } from '../../../../shared/api/mappers/policy.mapper';
import type { Policy } from '../../domain/entities/policy';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpPolicyRepository extends PolicyRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly _policies = signal<readonly Policy[]>([]);
  override readonly policies = this._policies.asReadonly();

  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<unknown[]>(`${this.base}/api/v1/policies`),
    );
    this._policies.set(dtos.map((d) => policyFromDto(d as never)));
  }

  override findByNumber(n: string): Policy | undefined {
    return this._policies().find((p) => p.number === n);
  }

  override async create(p: Policy): Promise<Policy> {
    const dto = await firstValueFrom(
      this.http.post<unknown>(`${this.base}/api/v1/policies`, policyToCreateBody(p)),
    );
    const created = policyFromDto(dto as never);
    this._policies.update((arr) => [...arr, created]);
    return created;
  }

  override async update(p: Policy): Promise<Policy> {
    const dto = await firstValueFrom(
      this.http.put<unknown>(
        `${this.base}/api/v1/policies/${encodeURIComponent(p.number)}`,
        policyToCreateBody(p),
      ),
    );
    const updated = policyFromDto(dto as never);
    this._policies.update((arr) => arr.map((x) => (x.number === updated.number ? updated : x)));
    return updated;
  }

  override async delete(number: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.base}/api/v1/policies/${encodeURIComponent(number)}`),
    );
    this._policies.update((arr) => arr.filter((x) => x.number !== number));
  }
}
```

> If the existing `PolicyRepository` port doesn't expose `create/update/delete` on the frontend domain, add the abstract methods now. Match the signatures.

- [ ] **Step 2: Update `policy-repository.port.ts` to declare the new methods**

Append abstract method declarations matching the HTTP repo (sync return type wrapped in `Promise` — do not retrofit signal-based contracts to async):

```typescript
abstract create(policy: Policy): Promise<Policy>;
abstract update(policy: Policy): Promise<Policy>;
abstract delete(number: string): Promise<void>;
```

The existing in-memory repo will need stubs that return `Promise.resolve(...)` after mutating the signal. Add them inline.

- [ ] **Step 3: `http-coverage.repository.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import {
  coverageFromDto,
  coverageToBody,
} from '../../../../shared/api/mappers/coverage.mapper';
import type { Coverage } from '../../domain/entities/coverage';
import { CoverageRepository } from '../../domain/ports/coverage-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpCoverageRepository extends CoverageRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly _coverages = signal<readonly Coverage[]>([]);
  override readonly coverages = this._coverages.asReadonly();

  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<unknown[]>(`${this.base}/api/v1/coverages`),
    );
    this._coverages.set(dtos.map((d) => coverageFromDto(d as never)));
  }

  override listForPolicy(policyNumber: string): readonly Coverage[] {
    return this._coverages().filter((c) => c.policyNumber === policyNumber);
  }

  override async replaceForPolicy(
    policyNumber: string,
    coverages: readonly Coverage[],
  ): Promise<readonly Coverage[]> {
    const dtos = await firstValueFrom(
      this.http.put<unknown[]>(
        `${this.base}/api/v1/policies/${encodeURIComponent(policyNumber)}/coverages`,
        coverages.map(coverageToBody),
      ),
    );
    const next = dtos.map((d) => coverageFromDto(d as never));
    this._coverages.update((arr) => [
      ...arr.filter((c) => c.policyNumber !== policyNumber),
      ...next,
    ]);
    return next;
  }
}
```

Update `coverage-repository.port.ts` to add `replaceForPolicy` abstract.

- [ ] **Step 4: `http-insurer.repository.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { insurerFromDto } from '../../../../shared/api/mappers/insurer.mapper';
import type { Insurer } from '../../domain/entities/insurer';
import { InsurerRepository } from '../../domain/ports/insurer-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpInsurerRepository extends InsurerRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly _insurers = signal<readonly Insurer[]>([]);
  override readonly insurers = this._insurers.asReadonly();

  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<unknown[]>(`${this.base}/api/v1/insurers`),
    );
    this._insurers.set(dtos.map((d) => insurerFromDto(d as never)));
  }
}
```

- [ ] **Step 5: `http-procedure.repository.ts`**

Place at `frontend/src/app/shared/infrastructure/repos/http-procedure.repository.ts` (new dir if needed). Keep procedures shared since both Hospital and Insurer features may consult the catalog.

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../api/api-base-url.token';
import { procedureFromDto } from '../../api/mappers/procedure.mapper';
import type { Procedure } from '../../domain/entities/procedure';
import { ProcedureRepository } from '../../domain/ports/procedure-repository.port';
```

If `ProcedureRepository` port does not exist on the frontend yet, create it at `frontend/src/app/shared/domain/ports/procedure-repository.port.ts`:

```typescript
import type { Procedure } from '../entities/procedure';

export abstract class ProcedureRepository {
  abstract list(): Promise<readonly Procedure[]>;
  abstract search(query: string): Promise<readonly Procedure[]>;
}
```

Then the HTTP impl:

```typescript
@Injectable({ providedIn: 'root' })
export class HttpProcedureRepository extends ProcedureRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly _procedures = signal<readonly Procedure[]>([]);
  readonly procedures = this._procedures.asReadonly();

  override async list(): Promise<readonly Procedure[]> {
    const dtos = await firstValueFrom(
      this.http.get<unknown[]>(`${this.base}/api/v1/procedures`),
    );
    const next = dtos.map((d) => procedureFromDto(d as never));
    this._procedures.set(next);
    return next;
  }

  override async search(query: string): Promise<readonly Procedure[]> {
    const params = new HttpParams().set('q', query);
    const dtos = await firstValueFrom(
      this.http.get<unknown[]>(`${this.base}/api/v1/procedures`, { params }),
    );
    return dtos.map((d) => procedureFromDto(d as never));
  }
}
```

- [ ] **Step 6: `http-case.repository.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { caseFromDto, traceStepFromDto } from '../../../../shared/api/mappers/case.mapper';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import type { TraceStep } from '../../domain/value-objects/trace-step';
import { CaseRepository } from '../../domain/ports/case-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpCaseRepository extends CaseRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly _cases = signal<readonly AuthorizationCase[]>([]);
  override readonly cases = this._cases.asReadonly();

  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<unknown[]>(`${this.base}/api/v1/cases`),
    );
    this._cases.set(dtos.map((d) => caseFromDto(d as never)));
  }

  override listSnapshot(): readonly AuthorizationCase[] {
    return this._cases();
  }

  override findById(id: string): AuthorizationCase | undefined {
    return this._cases().find((c) => c.id === id);
  }

  override create(c: AuthorizationCase): void {
    this._cases.update((arr) => [...arr, c]);
  }

  override update(id: string, patch: Partial<AuthorizationCase>): void {
    this._cases.update((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  // — extras used by the HTTP agent adapter —

  async getTrace(id: string): Promise<readonly TraceStep[]> {
    const body = await firstValueFrom(
      this.http.get<{ trace: unknown[] }>(`${this.base}/api/v1/cases/${encodeURIComponent(id)}/trace`),
    );
    return body.trace.map((s) => traceStepFromDto(s as never));
  }
}
```

- [ ] **Step 7: Bind HTTP repos in `app.config.ts`**

```typescript
import { CaseRepository } from './features/authorization-cases/domain/ports/case-repository.port';
import { HttpCaseRepository } from './features/authorization-cases/infrastructure/repos/http-case.repository';
import { PolicyRepository } from './features/policies/domain/ports/policy-repository.port';
import { CoverageRepository } from './features/policies/domain/ports/coverage-repository.port';
import { InsurerRepository } from './features/policies/domain/ports/insurer-repository.port';
import { HttpPolicyRepository } from './features/policies/infrastructure/repos/http-policy.repository';
import { HttpCoverageRepository } from './features/policies/infrastructure/repos/http-coverage.repository';
import { HttpInsurerRepository } from './features/policies/infrastructure/repos/http-insurer.repository';
import { ProcedureRepository } from './shared/domain/ports/procedure-repository.port';
import { HttpProcedureRepository } from './shared/infrastructure/repos/http-procedure.repository';

// in providers:
{ provide: CaseRepository, useClass: HttpCaseRepository },
{ provide: PolicyRepository, useClass: HttpPolicyRepository },
{ provide: CoverageRepository, useClass: HttpCoverageRepository },
{ provide: InsurerRepository, useClass: HttpInsurerRepository },
{ provide: ProcedureRepository, useClass: HttpProcedureRepository },
```

- [ ] **Step 8: Trigger initial load on first authenticated render**

Open `frontend/src/app/app.ts`. In the constructor (or via `effect`), once `auth.isAuthenticated()` becomes true, kick off `Promise.all([caseRepo.loadAll(), policyRepo.loadAll(), coverageRepo.loadAll(), insurerRepo.loadAll(), procedureRepo.list()])`. Inject the concrete classes (not the abstract ports) for the load calls — only the runtime instance has `loadAll`.

If `app.ts` already has effects, follow the existing pattern. Concrete code:

```typescript
import { effect, inject } from '@angular/core';

import { AuthFacade } from './features/auth/application/facades/auth.facade';
import { HttpCaseRepository } from './features/authorization-cases/infrastructure/repos/http-case.repository';
import { HttpPolicyRepository } from './features/policies/infrastructure/repos/http-policy.repository';
import { HttpCoverageRepository } from './features/policies/infrastructure/repos/http-coverage.repository';
import { HttpInsurerRepository } from './features/policies/infrastructure/repos/http-insurer.repository';
import { HttpProcedureRepository } from './shared/infrastructure/repos/http-procedure.repository';

// inside the App component class:
private readonly auth = inject(AuthFacade);
private readonly cases = inject(HttpCaseRepository);
private readonly policies = inject(HttpPolicyRepository);
private readonly coverages = inject(HttpCoverageRepository);
private readonly insurers = inject(HttpInsurerRepository);
private readonly procedures = inject(HttpProcedureRepository);

constructor() {
  effect(() => {
    if (this.auth.isAuthenticated()) {
      Promise.all([
        this.cases.loadAll(),
        this.policies.loadAll(),
        this.coverages.loadAll(),
        this.insurers.loadAll(),
        this.procedures.list(),
      ]).catch(() => undefined);
    }
  });
}
```

- [ ] **Step 9: Build + manual smoke test**

`npm run build`, then run both servers; log in as `insurer@demo.com / insurer`; expect the dashboard to render real metrics from the backend (numbers may differ from the prior fixture totals, that's the point).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app
git commit -m "feat(frontend): HTTP repositories for cases, policies, coverages, insurers, procedures"
```

---

### Task 14: Frontend — `HttpAgentAdapter` (replaces mock-agent), submit accepts text|pdf

**Files:**
- Create: `frontend/src/app/features/authorization-cases/infrastructure/agents/http-agent.adapter.ts`
- Modify: `frontend/src/app/features/authorization-cases/application/use-cases/submit-case.use-case.ts`
- Modify: `frontend/src/app/app.config.ts` (rebind `AgentOrchestrator`)

- [ ] **Step 1: Make `SubmitCaseInput` a discriminated union**

Open the existing `submit-case.use-case.ts`. Replace the input shape and use case body so it can dispatch to text or PDF. Concrete code:

```typescript
import { Injectable, inject } from '@angular/core';
import { Subject, type Observable } from 'rxjs';

import type { AgentEvent } from '../../domain/ports/agent-orchestrator.port';
import { AgentOrchestrator } from '../../domain/ports/agent-orchestrator.port';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import type { MedicalReport } from '../../domain/entities/medical-report';

export interface SubmitTextInput {
  readonly kind: 'text';
  readonly report: MedicalReport;
  readonly policyNumber: string;
  readonly scenarioKey?: string;
}

export interface SubmitPdfInput {
  readonly kind: 'pdf';
  readonly file: File;
  readonly patientId: string;
  readonly policyNumber: string;
  readonly procedureSolicitedHint?: string;
  readonly diagnosis?: string;
  readonly attendingDoctor?: string;
  readonly scenarioKey?: string;
}

export type SubmitCaseInput = SubmitTextInput | SubmitPdfInput;

@Injectable({ providedIn: 'root' })
export class SubmitCaseUseCase {
  private readonly orchestrator = inject(AgentOrchestrator);
  private readonly cases = inject(CaseRepository);

  execute(input: SubmitCaseInput): { caseId: string; events$: Observable<AgentEvent> } {
    return this.orchestrator.submit(input);
  }
}
```

> Note: the `AgentOrchestrator` port now needs a `submit(input)` method on top of (or instead of) `run(request)`. Update the port accordingly.

- [ ] **Step 2: Update `agent-orchestrator.port.ts`**

Replace `run(request: AgentRunRequest): Observable<AgentEvent>` with:

```typescript
import type { SubmitCaseInput } from '../../application/use-cases/submit-case.use-case';

export abstract class AgentOrchestrator {
  abstract submit(input: SubmitCaseInput): {
    readonly caseId: string;
    readonly events$: Observable<AgentEvent>;
  };
}
```

> The previous `run(...)` shape was tailored to the mock adapter. Migrating callers is part of this task.

- [ ] **Step 3: Update existing callers**

The `AuthorizationCasesFacade.submitCase` already destructures `{ caseId, events$ }` from the orchestrator — it should keep working with the new port. Search the repo for any other call to `orchestrator.run` and replace it with `orchestrator.submit`. The `mock-agent.adapter.ts` will be deleted in step 6 of this task.

- [ ] **Step 4: Implement `http-agent.adapter.ts`**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject, type Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { caseFromDto, traceStepFromDto } from '../../../../shared/api/mappers/case.mapper';
import {
  AgentOrchestrator,
  type AgentEvent,
} from '../../domain/ports/agent-orchestrator.port';
import type { SubmitCaseInput } from '../../application/use-cases/submit-case.use-case';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import { HttpCaseRepository } from '../repos/http-case.repository';

@Injectable({ providedIn: 'root' })
export class HttpAgentAdapter extends AgentOrchestrator {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly cases = inject(CaseRepository) as HttpCaseRepository;

  override submit(input: SubmitCaseInput): {
    caseId: string;
    events$: Observable<AgentEvent>;
  } {
    const events$ = new Subject<AgentEvent>();
    // Pre-allocate a placeholder id so the facade has something to track immediately.
    // We replace it once the backend response arrives.
    const placeholderId = `PENDING-${Date.now()}`;

    const requestPromise =
      input.kind === 'text'
        ? this.submitText(input)
        : this.submitPdf(input);

    let actualCaseId = placeholderId;
    requestPromise
      .then(async (caseDto) => {
        actualCaseId = caseDto.id;
        this.cases.update(placeholderId, { id: caseDto.id });

        const trace = caseDto.trace.map(traceStepFromDto);
        for (const step of trace) {
          events$.next({ kind: 'step', step });
          await delay(environment.agentStepDelayMs);
        }

        const decision = caseFromDto(caseDto as never).decision;
        if (decision) {
          events$.next({ kind: 'done', decision, trace });
        } else {
          events$.next({ kind: 'error', error: 'Backend returned no decision', trace });
        }
        events$.complete();
        // Refresh the cases list so other views see the new entry.
        await this.cases.loadAll();
      })
      .catch((err) => {
        events$.next({
          kind: 'error',
          error: err instanceof Error ? err.message : String(err),
          trace: [],
        });
        events$.complete();
      });

    return { caseId: actualCaseId, events$: events$.asObservable() };
  }

  private async submitText(input: Extract<SubmitCaseInput, { kind: 'text' }>) {
    const body = {
      report: {
        patientId: input.report.patientId,
        format: 'TEXT',
        content: input.report.content,
        procedureSolicitedHint: input.report.procedureSolicitedHint,
        diagnosis: input.report.diagnosis,
        attendingDoctor: input.report.attendingDoctor,
      },
      policyNumber: input.policyNumber,
      scenarioKey: input.scenarioKey,
    };
    return await firstValuePromise(
      this.http.post<CaseWithTraceDto>(`${this.base}/api/v1/cases`, body),
    );
  }

  private async submitPdf(input: Extract<SubmitCaseInput, { kind: 'pdf' }>) {
    const fd = new FormData();
    fd.set('policy_number', input.policyNumber);
    fd.set('patient_id', input.patientId);
    if (input.procedureSolicitedHint) fd.set('procedure_solicited_hint', input.procedureSolicitedHint);
    if (input.diagnosis) fd.set('diagnosis', input.diagnosis);
    if (input.attendingDoctor) fd.set('attending_doctor', input.attendingDoctor);
    if (input.scenarioKey) fd.set('scenario_key', input.scenarioKey);
    fd.set('file', input.file);
    return await firstValuePromise(
      this.http.post<CaseWithTraceDto>(`${this.base}/api/v1/cases/upload`, fd),
    );
  }
}

interface CaseWithTraceDto {
  readonly id: string;
  readonly trace: readonly unknown[]; // backend embeds the trace under /trace
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

import { firstValueFrom, type Observable as Obs } from 'rxjs';
function firstValuePromise<T>(o: Obs<T>): Promise<T> {
  return firstValueFrom(o);
}
```

> The backend's `POST /cases` returns a `CaseOut` that does **not** include the `trace[]` inline. We need to fetch the trace via `GET /cases/{id}/trace` after submit — adjust:

Replace the part inside `then(async (caseDto) => { … })` to:

```typescript
.then(async (caseDto) => {
  actualCaseId = caseDto.id;
  this.cases.update(placeholderId, { id: caseDto.id });

  const traceDtos = await firstValuePromise(
    this.http.get<{ trace: unknown[] }>(
      `${this.base}/api/v1/cases/${encodeURIComponent(caseDto.id)}/trace`,
    ),
  );
  const trace = traceDtos.trace.map(traceStepFromDto);
  for (const step of trace) {
    events$.next({ kind: 'step', step });
    await delay(environment.agentStepDelayMs);
  }

  const fullCase = caseFromDto(caseDto as never);
  if (fullCase.decision) {
    events$.next({ kind: 'done', decision: fullCase.decision, trace });
  } else {
    events$.next({ kind: 'error', error: 'Backend returned no decision', trace });
  }
  events$.complete();
  await this.cases.loadAll();
})
```

- [ ] **Step 5: Bind `AgentOrchestrator` to `HttpAgentAdapter` in `app.config.ts`**

```typescript
import { AgentOrchestrator } from './features/authorization-cases/domain/ports/agent-orchestrator.port';
import { HttpAgentAdapter } from './features/authorization-cases/infrastructure/agents/http-agent.adapter';

// in providers:
{ provide: AgentOrchestrator, useClass: HttpAgentAdapter },
```

Remove (or delete) any prior binding for `MockAgentAdapter`.

- [ ] **Step 6: Delete the mock agent module**

Delete `frontend/src/app/features/authorization-cases/infrastructure/agents/mock-agent.adapter.ts` and its companions (`agent-nodes.ts`, `decision.ts`, `scenario-builder.ts`) **only if** no other code imports them. Run `grep -r "mock-agent\|scenario-builder\|agent-nodes" frontend/src` first; if there are remaining usages (e.g., in tests), update them to use `HttpAgentAdapter` or remove the import.

- [ ] **Step 7: Build + smoke test**

Run both servers, log in as hospital, submit a text case from `/hospital/submit`, verify the trace appears step-by-step and a decision lands.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app
git commit -m "feat(frontend): HttpAgentAdapter (fake-streams trace from sync backend)"
```

---

### Task 15: Frontend — PDF upload UI in `medical-report-form`

**Files:**
- Modify: `frontend/src/app/features/authorization-cases/presentation/components/medical-report-form/medical-report-form.ts`

- [ ] **Step 1: Add Text/PDF mode toggle and file picker**

Open the component and:

1. Add a `mode` signal (`'text' | 'pdf'`) defaulting to `'text'`.
2. When `mode === 'pdf'`, show `<input type="file" accept="application/pdf" (change)="onFile($event)">`.
3. Validate client-side: file size ≤ 10 MB; reject otherwise with a user-visible error.
4. The component's `submit` event must now emit a payload that matches the new `SubmitCaseInput` union (`{ kind: 'text', ... }` or `{ kind: 'pdf', ... }`).

Concrete signature:

```typescript
@Output() submitForm = new EventEmitter<SubmitCaseInput>();

readonly mode = signal<'text' | 'pdf'>('text');
readonly fileError = signal<string | null>(null);
private file: File | null = null;

onFile(evt: Event): void {
  const input = evt.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  if (!f) {
    this.file = null;
    this.fileError.set(null);
    return;
  }
  if (f.type !== 'application/pdf') {
    this.fileError.set('Solo se acepta application/pdf');
    this.file = null;
    return;
  }
  if (f.size > 10 * 1024 * 1024) {
    this.fileError.set('El archivo supera 10 MB');
    this.file = null;
    return;
  }
  this.fileError.set(null);
  this.file = f;
}

submit(): void {
  if (this.mode() === 'text') {
    this.submitForm.emit({
      kind: 'text',
      report: this.buildTextReport(),
      policyNumber: this.policyNumber,
      scenarioKey: this.scenarioKey || undefined,
    });
    return;
  }
  if (!this.file) {
    this.fileError.set('Seleccioná un PDF.');
    return;
  }
  this.submitForm.emit({
    kind: 'pdf',
    file: this.file,
    patientId: this.patientId,
    policyNumber: this.policyNumber,
    procedureSolicitedHint: this.procedureSolicitedHint || undefined,
    diagnosis: this.diagnosis || undefined,
    attendingDoctor: this.attendingDoctor || undefined,
    scenarioKey: this.scenarioKey || undefined,
  });
}
```

(Adjust to the existing form fields — leave field names unchanged where the component already declares them.)

- [ ] **Step 2: Update the parent page (`hospital/submit/submit.page.ts`) to forward the union to the facade**

Where it previously called `facade.submitCase({ report, policyNumber, scenarioKey })`, now it calls `facade.submitCase(payload)` directly because the payload is already of the right shape.

- [ ] **Step 3: Build + manual test (text + PDF)**

Run: `npm run build`. Smoke test both modes. For PDF, use any small PDF on disk. The hospital live-run page should show the same step reveal UX.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/authorization-cases
git commit -m "feat(frontend): text/PDF toggle in medical-report-form + PDF submit wiring"
```

---

### Task 16: Frontend — Insurer policies CRUD UI

**Files:**
- Modify: `frontend/src/app/features/policies/presentation/pages/insurer/policies/policies.page.ts`
- Create: `frontend/src/app/features/policies/presentation/pages/insurer/policies/policy-form.component.ts`
- Modify: `frontend/src/app/features/policies/application/facades/policies.facade.ts`
- Create: `frontend/src/app/features/policies/application/use-cases/create-policy.use-case.ts`
- Create: `frontend/src/app/features/policies/application/use-cases/update-policy.use-case.ts`
- Create: `frontend/src/app/features/policies/application/use-cases/delete-policy.use-case.ts`

- [ ] **Step 1: `create-policy.use-case.ts`**

```typescript
import { Injectable, inject } from '@angular/core';

import type { Policy } from '../../domain/entities/policy';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

@Injectable({ providedIn: 'root' })
export class CreatePolicyUseCase {
  private readonly repo = inject(PolicyRepository);
  execute(p: Policy): Promise<Policy> {
    return this.repo.create(p);
  }
}
```

- [ ] **Step 2: `update-policy.use-case.ts`**

```typescript
import { Injectable, inject } from '@angular/core';

import type { Policy } from '../../domain/entities/policy';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

@Injectable({ providedIn: 'root' })
export class UpdatePolicyUseCase {
  private readonly repo = inject(PolicyRepository);
  execute(p: Policy): Promise<Policy> {
    return this.repo.update(p);
  }
}
```

- [ ] **Step 3: `delete-policy.use-case.ts`**

```typescript
import { Injectable, inject } from '@angular/core';

import { PolicyRepository } from '../../domain/ports/policy-repository.port';

@Injectable({ providedIn: 'root' })
export class DeletePolicyUseCase {
  private readonly repo = inject(PolicyRepository);
  execute(number: string): Promise<void> {
    return this.repo.delete(number);
  }
}
```

- [ ] **Step 4: Extend `policies.facade.ts`**

Add public methods:

```typescript
private readonly createUC = inject(CreatePolicyUseCase);
private readonly updateUC = inject(UpdatePolicyUseCase);
private readonly deleteUC = inject(DeletePolicyUseCase);

createPolicy(p: Policy): Promise<Policy> {
  return this.createUC.execute(p);
}

updatePolicy(p: Policy): Promise<Policy> {
  return this.updateUC.execute(p);
}

deletePolicy(number: string): Promise<void> {
  return this.deleteUC.execute(number);
}
```

- [ ] **Step 5: `policy-form.component.ts`**

Standalone component with two-way bindings, emits `submit` with a `Policy` and `cancel` event.

```typescript
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { Policy } from '../../../../domain/entities/policy';

@Component({
  selector: 'app-policy-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="onSubmit()" class="space-y-3 p-4 bg-base-200 rounded-lg">
      <h2 class="text-lg font-semibold">{{ initial ? 'Editar' : 'Nueva' }} póliza</h2>

      <input class="input input-bordered w-full" placeholder="Número" name="number"
             [(ngModel)]="model.number" [readonly]="!!initial" required />
      <input class="input input-bordered w-full" placeholder="Patient ID" name="patientId"
             [(ngModel)]="model.patientId" required />
      <input class="input input-bordered w-full" placeholder="Plan" name="plan"
             [(ngModel)]="model.plan" required />
      <input class="input input-bordered w-full" placeholder="Insurer ID" name="insurerId"
             [(ngModel)]="model.insurerId" required />
      <input class="input input-bordered w-full" type="date" name="startDate"
             [(ngModel)]="model.startDate" required />
      <input class="input input-bordered w-full" type="date" name="endDate"
             [(ngModel)]="model.endDate" required />
      <select class="select select-bordered w-full" name="status" [(ngModel)]="model.status">
        <option value="ACTIVE">ACTIVE</option>
        <option value="INACTIVE">INACTIVE</option>
        <option value="SUSPENDED">SUSPENDED</option>
      </select>

      <div class="flex gap-2 justify-end">
        <button type="button" class="btn" (click)="cancel.emit()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `,
})
export class PolicyFormComponent {
  @Input() set initial(p: Policy | null) {
    this._initial = p;
    this.model = p ? { ...p } : this.empty();
  }
  get initial(): Policy | null { return this._initial; }
  private _initial: Policy | null = null;

  model: Policy = this.empty();

  @Output() submitForm = new EventEmitter<Policy>();
  @Output() cancel = new EventEmitter<void>();

  onSubmit(): void {
    this.submitForm.emit({ ...this.model });
  }

  private empty(): Policy {
    return {
      number: '',
      patientId: '',
      plan: '',
      insurerId: '',
      startDate: '',
      endDate: '',
      status: 'ACTIVE' as Policy['status'],
    };
  }
}
```

- [ ] **Step 6: Modify `policies.page.ts`**

Wire the table buttons:
- "Nueva póliza" → toggle a `selected` signal to a new empty policy
- Each row's "Editar" → toggle `selected` to that policy
- Each row's "Eliminar" → confirm dialog → `facade.deletePolicy(p.number)`
- The form `submit` event:
  - If editing: `facade.updatePolicy(p)`
  - If creating: `facade.createPolicy(p)`

Concrete pattern:

```typescript
readonly editing = signal<Policy | null | undefined>(undefined);
// undefined = closed; null = creating; Policy = editing

openCreate(): void { this.editing.set(null); }
openEdit(p: Policy): void { this.editing.set({ ...p }); }
close(): void { this.editing.set(undefined); }

async save(p: Policy): Promise<void> {
  if (this.editing()) {
    await this.facade.updatePolicy(p);
  } else {
    await this.facade.createPolicy(p);
  }
  this.close();
}

async confirmDelete(p: Policy): Promise<void> {
  if (!window.confirm(`Eliminar póliza ${p.number}?`)) return;
  await this.facade.deletePolicy(p.number);
}
```

Render the form in a slide-over `<aside>` when `editing() !== undefined`.

- [ ] **Step 7: Build + smoke test**

Log in as insurer; navigate to `/insurer/policies`; create a new policy → see it in the list; edit it → see updated values; delete it → confirm it's gone. Reload the page → the changes persist (in-memory while the backend process is alive; lost on backend restart).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/policies
git commit -m "feat(frontend): insurer CRUD UI for policies (create, edit, delete)"
```

---

### Task 17: Frontend — Insurer coverages bulk-edit UI

**Files:**
- Modify: `frontend/src/app/features/policies/presentation/pages/insurer/coverages/coverages.page.ts`
- Modify: `frontend/src/app/features/policies/application/facades/policies.facade.ts`
- Create: `frontend/src/app/features/policies/application/use-cases/replace-coverages.use-case.ts`

- [ ] **Step 1: `replace-coverages.use-case.ts`**

```typescript
import { Injectable, inject } from '@angular/core';

import type { Coverage } from '../../domain/entities/coverage';
import { CoverageRepository } from '../../domain/ports/coverage-repository.port';

@Injectable({ providedIn: 'root' })
export class ReplaceCoveragesUseCase {
  private readonly repo = inject(CoverageRepository);
  execute(policyNumber: string, coverages: readonly Coverage[]): Promise<readonly Coverage[]> {
    return this.repo.replaceForPolicy(policyNumber, coverages);
  }
}
```

- [ ] **Step 2: Add facade method**

```typescript
private readonly replaceCoveragesUC = inject(ReplaceCoveragesUseCase);

replaceCoverages(policyNumber: string, coverages: readonly Coverage[]): Promise<readonly Coverage[]> {
  return this.replaceCoveragesUC.execute(policyNumber, coverages);
}
```

- [ ] **Step 3: Modify `coverages.page.ts`**

UI flow:
1. Policy dropdown (signal) — populated from `policiesFacade.policies()`
2. Editable rows of coverages for the selected policy. Maintain a working copy in a `signal<Coverage[]>`.
3. "+ Agregar fila" appends an empty coverage with `policyNumber=selected`.
4. "Guardar" calls `facade.replaceCoverages(selected, working())`.

Concrete skeleton:

```typescript
readonly selectedPolicy = signal<string | null>(null);
readonly working = signal<Coverage[]>([]);

constructor() {
  effect(() => {
    const sel = this.selectedPolicy();
    if (sel) {
      this.working.set([...this.coverageRepo.listForPolicy(sel)]);
    } else {
      this.working.set([]);
    }
  });
}

addRow(): void {
  const sel = this.selectedPolicy();
  if (!sel) return;
  this.working.update((arr) => [
    ...arr,
    {
      policyNumber: sel,
      procedureCode: '',
      covered: true,
      waitingDays: 0,
      copay: 0,
      requiredDocs: [],
    },
  ]);
}

removeRow(idx: number): void {
  this.working.update((arr) => arr.filter((_, i) => i !== idx));
}

async save(): Promise<void> {
  const sel = this.selectedPolicy();
  if (!sel) return;
  await this.facade.replaceCoverages(sel, this.working());
}
```

The render is a `<table>` with `<input>`s bound via `[(ngModel)]` for each column, plus a `<button>` per row to remove and a "Guardar" CTA.

- [ ] **Step 4: Build + smoke test**

Log in as insurer, navigate `/insurer/coverages`, pick a policy, edit `waitingDays`, add a row, save, reload — the changes survive within the backend process lifetime.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/policies
git commit -m "feat(frontend): insurer bulk-edit UI for coverages by policy"
```

---

### Task 18: End-to-end smoke test + cleanup

- [ ] **Step 1: Verify the full stack**

Terminal A:
```bash
cd backend && uv run uvicorn pre_autorizacion.main:app --reload
```

Terminal B:
```bash
cd frontend && npm start
```

In a browser at `http://localhost:4200`:
1. Redirected to `/login`. Use `hospital@demo.com / hospital`.
2. On `/hospital/submit`: submit one of the seeded scenarios in **text mode** → trace appears step by step → decision shows.
3. Submit again in **PDF mode** with any small PDF → same UX.
4. Logout → redirected to `/login`.
5. Login as `auditor@demo.com / auditor` → tray shows escalated cases including the ones you just submitted (if scenarios escalate).
6. Resolve a case → status flips to DECIDIDO.
7. Login as `insurer@demo.com / insurer` → dashboard shows real metrics; create / edit / delete a policy; replace coverages; verify the hospital submit flow uses the new coverage if applicable.

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && uv run pytest -q
```
Expected: all green (45 unit + the new integration tests).

- [ ] **Step 3: Build the frontend in production mode**

```bash
cd frontend && npm run build -- --configuration production
```
Expected: build succeeds; no `apiBaseUrl` referencing localhost in the production bundle (the file replacement should swap it).

- [ ] **Step 4: Commit any cleanup (only if there is any)**

If the smoke test surfaced a small fix, commit it as `fix(...)` with a focused message. Otherwise no commit needed.

---

## Self-review

**Spec coverage check (vs `2026-05-07-fe-be-wiring-design.md`):**
- §4.1 Multipart upload → Task 6 ✓
- §4.2 File download → Task 6 ✓
- §4.3 Procedures router → Tasks 2 + 3 ✓
- §4.4 Policy/Coverage CRUD → Tasks 4 + 5 ✓
- §4.5 `.env.example` + `MAX_UPLOAD_MB` + tests → Tasks 1 + 7 ✓
- §5.1 `provideHttpClient`, environments, `gen:api` → Tasks 9 + 10 ✓
- §5.2 Auth feature + login + interceptors + guard → Task 11 ✓
- §5.3 HTTP repositories → Task 13 ✓
- §5.4 HttpAgentAdapter → Task 14 ✓
- §5.5 PDF upload UI → Task 15 ✓
- §5.6 Insurer CRUD UI → Tasks 16 + 17 ✓
- §5.7 Procedures wiring → covered by Task 13 (HTTP procedure repo) and the existing page already calls the repo ✓
- §8 Acceptance criteria → Task 18 covers all bullets ✓

**Placeholder scan:** no "TBD", no "implement later", no "similar to Task N" — every step has runnable code or commands.

**Type consistency:** `SubmitCaseInput` is the same union in Task 14 and 15. `PolicyRepository` gets `create/update/delete` declared in Task 13 step 2 and used in Task 16 — consistent. `AgentOrchestrator.submit` is introduced in Task 14 step 2 and used in the same task — consistent.

**One known compromise to flag:** the current frontend `RoleService` becomes a hybrid (auth-derived + manual override). The override is left in to avoid breaking the existing topbar role switcher. Removing the topbar switcher entirely is a follow-up, not part of this plan.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-fe-be-wiring-plan.md`.**
