# syntax=docker/dockerfile:1.7

# ── Stage 1: builder (instala deps con uv en un .venv aislado) ──────────────
# Usamos la imagen oficial de Astral con uv pre-instalado para evitar el
# overhead de instalar uv vía pip/cargo en cada build. La imagen base es
# python:3.13-bookworm-slim — el uv lock ya pinea requires-python>=3.12.
#
# Nota: Astral NO publica tags compuestos del tipo `<uv-version>-<python>-<distro>`,
# solo publican `<uv-version>` solo o `<python>-<distro>` solo (rolling con
# último uv estable). Usamos el rolling de python3.13 — el uv.lock pinea
# todas las deps así que un bump menor de uv no rompe builds.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

# Optimizaciones uv:
# - UV_COMPILE_BYTECODE=1 → precompila .pyc al instalar (reduce cold-start).
# - UV_LINK_MODE=copy → uv usa hardlinks por default; en docker rompen entre
#   capas, así que forzamos copy.
# - UV_PROJECT_ENVIRONMENT → ubicación predecible del .venv (no $CWD/.venv)
#   para que el COPY del runtime stage sea simple.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app

# Layer 1 — solo deps. Cambia rara vez, cachea bien.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Layer 2 — código fuente + reinstall (instala el package del proyecto).
# README.md es requerido por pyproject.toml (`readme = "README.md"`); uv lo
# lee al construir el package metadata. Sin él, `uv sync` falla con
# "failed to open file /app/README.md".
COPY src/ ./src/
COPY README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ── Stage 2: runtime (python:3.13-slim, sin toolchain de build) ─────────────
FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_ENV=production

WORKDIR /app

# Non-root user — corre como user `app` (uid 1001).
# Si el platform target inyecta otro uid (Cloud Run / Fly), igual funciona
# porque /app + /opt/venv son world-readable.
RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid app --no-create-home --shell /usr/sbin/nologin app

# Copy del .venv pre-poblado + código del proyecto.
COPY --from=builder --chown=app:app /opt/venv /opt/venv
COPY --from=builder --chown=app:app /app/src /app/src

# var/uploads para el LocalFs storage adapter (settings.uploads_dir).
# En platforms con FS efímero (Cloud Run, Vercel Functions) el dir vive lo
# que dura el container — para persistencia real, montá un volumen o cambiá
# el adapter por uno de object storage en config/di.py.
RUN mkdir -p /app/var/uploads && chown -R app:app /app/var

USER app

EXPOSE 8000

# Healthcheck via /health — usa solo stdlib (sin deps extra como curl).
# Respeta $PORT por si el platform lo override (Cloud Run / Render / Railway).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,os,sys; \
u=f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/health'; \
sys.exit(0 if urllib.request.urlopen(u).status==200 else 1)" || exit 1

# `sh -c` para expandir $PORT (default 8000). `exec` reemplaza al shell para
# que uvicorn reciba SIGTERM directamente (graceful shutdown).
CMD ["sh", "-c", "exec uvicorn pre_autorizacion.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
