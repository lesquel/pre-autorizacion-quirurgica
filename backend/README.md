# Backend — Pre-Autorización Quirúrgica

Stack: **Python 3.13+ · FastAPI · uv · Pydantic v2 · LangChain + LangGraph · DeepSeek (texto) · Gemini Vision (PDFs) · Notion (persistencia)**.

Arquitectura: **Vertical Slicing + Clean Architecture** (mirror del frontend Angular).

## Setup

```bash
cd backend
# Crear .env desde la sección "Variables de entorno" más abajo
uv sync
uv run uvicorn pre_autorizacion.main:app --reload
```

Abrí http://localhost:8000/docs para la OpenAPI generada.

## Variables de entorno

Crear `backend/.env` (NUNCA commitearlo) con el siguiente contenido:

```dotenv
# ─── Server ───
APP_HOST=0.0.0.0
APP_PORT=8000
APP_ENV=development

# ─── Auth (JWT) ───
# Generá un secret fuerte: openssl rand -hex 32
JWT_SECRET=changeme-please-very-secret-and-long-at-least-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7

# ─── IA: provider de texto (DeepSeek por default) ───
# DeepSeek se consume vía SDK de OpenAI apuntando a su base_url.
TEXT_PROVIDER=deepseek
TEXT_MODEL=deepseek-chat
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com

# ─── IA: provider de visión (Gemini para PDFs) ───
VISION_PROVIDER=gemini
VISION_MODEL=gemini-2.5-flash
GOOGLE_API_KEY=

# ─── IA: thresholds de decisión ───
CONFIDENCE_THRESHOLD=0.80
PROCEDURE_MATCH_THRESHOLD=0.85

# ─── Notion (persistencia primaria, 7 DBs) ───
NOTION_TOKEN=
NOTION_DB_PATIENTS=
NOTION_DB_INSURERS=
NOTION_DB_PROCEDURES=
NOTION_DB_POLICIES=
NOTION_DB_COVERAGES=
NOTION_DB_MEDICAL_REPORTS=
NOTION_DB_AUTHORIZATION_CASES=

# ─── Storage local de archivos (PDFs adjuntos) ───
UPLOADS_DIR=./var/uploads

# ─── CORS ───
CORS_ORIGINS=http://localhost:4200
```

> **Nota**: Phase B2 va a crear `config/settings.py` con Pydantic Settings que valida y tipa estas variables al arranque. Si falta una clave requerida, el server no levanta.

## Comandos

```bash
uv sync               # instala deps + dev
uv run pytest         # tests
uv run ruff check .   # lint
uv run ruff format .  # format
uv run mypy src/      # type check
```

## Estructura

```
src/pre_autorizacion/
├── config/                       # settings (Pydantic) + composition root (DI)
├── shared/                       # cross-feature
│   ├── domain/                   # Patient, Procedure (entities sin feature dueño)
│   ├── llm/                      # LLMProvider port + adapters (DeepSeek, OpenAI, Gemini)
│   ├── vision/                   # VisionExtractor port + adapters (Gemini default)
│   ├── storage/                  # FileStorage port + LocalFsAdapter
│   ├── notion/                   # NotionClient base
│   └── api/                      # middlewares, error handlers, deps
├── features/
│   ├── authorization_cases/      # feature central
│   │   ├── domain/               # entities + value objects + ports
│   │   ├── application/
│   │   │   ├── use_cases/        # SubmitCase, ResolveCase, ListCases, GetCaseById
│   │   │   └── agent/            # LangGraph state machine + nodes
│   │   ├── infrastructure/
│   │   │   ├── persistence/notion/
│   │   │   ├── extractors/       # text + PDF vision
│   │   │   ├── decision/         # rule engine + LLM decision maker
│   │   │   └── repos/
│   │   └── api/                  # FastAPI routers + Pydantic schemas
│   ├── policies/
│   └── auth/
└── main.py                       # FastAPI app factory
```

## Phases

- [x] **B0 — Setup**: uv, pyproject, folder structure, `.env.example`, configs.
- [ ] **B1 — Domain core**: entities + ports + rule engine (TDD pytest).
- [ ] **B2 — FastAPI skeleton**: app + auth JWT + Notion adapter (read) + DI + endpoints (mock agent).
- [ ] **B3 — Agent LangGraph**: state machine + DeepSeek adapter + Gemini Vision adapter + integración.

## Principios no negociables

- **Dominio puro**: `domain/` no importa nada de FastAPI, Notion, LangChain, ni httpx.
- **Dependencias hacia adentro**: `api → application → domain ← infrastructure`.
- **Rule engine domina** la lógica regulatoria (carencia, docs). LLM solo extrae y comunica.
- **El agente NUNCA auto-rechaza** — política PRD §3.1.3.
- **Confidence < 0.80 → ESCALATED forzado** por rule engine, no por el LLM.
- **`AgentDecision` siempre incluye** `outcome + rationale + confidence + evidence` (auditoría legal).
