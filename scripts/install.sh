#!/usr/bin/env bash
# Instala todas las deps (backend uv + frontend npm).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ backend deps (uv sync)"
(cd backend && uv sync)

echo ""
echo "→ frontend deps (npm ci)"
(cd frontend && npm ci)

echo ""
echo "✓ install completo"
echo "  Levantá los servicios con:  ./scripts/dev.sh   (o  make dev)"
