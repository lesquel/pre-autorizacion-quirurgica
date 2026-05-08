# Pre-Autorización Quirúrgica — workflow root
# Uso: `make <target>`. Ver `make help` para el listado.

.DEFAULT_GOAL := help

# ─── Helpers ───────────────────────────────────────────────────────────

help: ## Lista los targets disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ─── Setup ─────────────────────────────────────────────────────────────

install: install-backend install-frontend ## Instala todas las deps (backend + frontend)
	@echo "✓ install completo"

install-backend: ## Instala deps del backend (uv sync)
	cd backend && uv sync

install-frontend: ## Instala deps del frontend (npm ci)
	cd frontend && npm ci

# ─── Run (dev) ─────────────────────────────────────────────────────────

dev: ## Levanta backend (:8000) y frontend (:4200) en paralelo (Ctrl+C corta los dos)
	@echo "→ backend  http://localhost:8000/docs"
	@echo "→ frontend http://localhost:4200"
	@trap 'kill 0' EXIT INT TERM; \
	  ($(MAKE) -s backend) & \
	  ($(MAKE) -s frontend) & \
	  wait

backend: ## Solo backend (uvicorn --reload, http://localhost:8000)
	cd backend && uv run uvicorn pre_autorizacion.main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Solo frontend (ng serve, http://localhost:4200)
	cd frontend && npm start

# ─── Test ──────────────────────────────────────────────────────────────

test: test-backend ## Corre tests del backend (frontend tests cuando se agreguen)
	@echo "✓ test completo"

test-backend: ## pytest del backend
	cd backend && uv run pytest

test-frontend: ## tests Angular (placeholder — agregar specs primero)
	cd frontend && npm test -- --watch=false --browsers=ChromeHeadless

# ─── Quality (lint + format + typecheck) ───────────────────────────────

lint: lint-backend lint-frontend ## Lint completo

lint-backend: ## ruff check + format check
	cd backend && uv run ruff check . && uv run ruff format --check .

lint-frontend: ## eslint del frontend (si está configurado)
	cd frontend && npm run lint --if-present

format: format-backend ## Formatea código backend (ruff format)

format-backend:
	cd backend && uv run ruff format .

typecheck: typecheck-backend typecheck-frontend ## mypy + tsc

typecheck-backend: ## mypy strict del backend
	cd backend && uv run mypy src/

typecheck-frontend: ## tsc --noEmit del frontend
	cd frontend && npx tsc --noEmit -p tsconfig.app.json

check: lint typecheck test ## Lint + typecheck + tests (lo que correría CI)

# ─── Utilidades ────────────────────────────────────────────────────────

openapi-sync: ## Regenera frontend/openapi.json desde el backend corriendo
	@echo "→ asegurate de que el backend esté corriendo en :8000"
	curl -fsS http://localhost:8000/openapi.json -o frontend/openapi.json
	@echo "✓ frontend/openapi.json actualizado"

typegen: ## Genera tipos TS desde frontend/openapi.json
	cd frontend && npx openapi-typescript openapi.json -o src/app/shared/api/schema.d.ts
	@echo "✓ frontend/src/app/shared/api/schema.d.ts regenerado"

clean: ## Limpia caches y artefactos
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache backend/dist backend/build
	rm -rf frontend/.angular frontend/dist frontend/coverage
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	@echo "✓ clean"

clean-all: clean ## Clean + remueve venvs + node_modules (vas a tener que correr `make install`)
	rm -rf backend/.venv frontend/node_modules
	@echo "✓ clean-all"

.PHONY: help install install-backend install-frontend dev backend frontend \
        test test-backend test-frontend \
        lint lint-backend lint-frontend format format-backend \
        typecheck typecheck-backend typecheck-frontend check \
        openapi-sync typegen clean clean-all
