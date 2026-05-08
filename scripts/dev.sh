#!/usr/bin/env bash
# Levanta backend (:8000) + frontend (:4200) en paralelo.
# Ctrl+C corta los dos.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ backend  http://localhost:8000/docs"
echo "→ frontend http://localhost:4200"
echo ""

trap 'echo ""; echo "→ stopping..."; kill 0' EXIT INT TERM

(cd backend && uv run uvicorn pre_autorizacion.main:app --reload --host 0.0.0.0 --port 8000) &
(cd frontend && npm start) &

wait
