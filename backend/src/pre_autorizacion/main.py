"""FastAPI app factory para Pre-Autorización Quirúrgica.

Composition root: `config/di.py`. Este archivo arma el `app`, configura
logging structlog según el environment, registra middlewares globales
(CORS, request_id, logging), error handlers RFC 7807, y monta los routers
de cada feature.
"""

from __future__ import annotations

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pre_autorizacion.config.di import get_case_repository
from pre_autorizacion.config.settings import Settings, get_settings
from pre_autorizacion.features.auth.api import router as auth_router
from pre_autorizacion.shared.api.error_handlers import register_error_handlers
from pre_autorizacion.shared.api.logging_config import configure_logging
from pre_autorizacion.shared.api.middleware import LoggingMiddleware, RequestIdMiddleware

_logger = structlog.get_logger("api.bootstrap")


def _register_feature_routers(app: FastAPI) -> None:
    """Monta los routers de cada feature.

    Auth está garantizado (lo dueño de este archivo). Los routers de
    `authorization_cases` y `policies` los crea otro sub-agente — los
    importamos defensivamente para que la app levante incluso durante la
    ventana en la que esos archivos aún no existen.
    """
    app.include_router(auth_router)

    try:
        from pre_autorizacion.features.authorization_cases.api.routers import (  # noqa: PLC0415
            router as cases_router,
        )

        app.include_router(cases_router)
    except ImportError as exc:
        _logger.warning(
            "router.cases.unavailable",
            reason=str(exc),
            note="cases router not yet wired.",
        )

    try:
        from pre_autorizacion.features.policies.api.routers import (  # noqa: PLC0415
            router as policies_router,
        )

        app.include_router(policies_router)
    except ImportError as exc:
        _logger.warning(
            "router.policies.unavailable",
            reason=str(exc),
            note="policies router not yet wired.",
        )

    try:
        from pre_autorizacion.features.procedures.api.routers import (  # noqa: PLC0415
            router as procedures_router,
        )
        app.include_router(procedures_router)
    except ImportError as exc:
        _logger.warning(
            "router.procedures.unavailable",
            reason=str(exc),
            note="procedures router not yet wired.",
        )

    try:
        from pre_autorizacion.features.patients.api.routers import (  # noqa: PLC0415
            router as patients_router,
        )
        app.include_router(patients_router)
    except ImportError as exc:
        _logger.warning(
            "router.patients.unavailable",
            reason=str(exc),
            note="patients router not yet wired.",
        )


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construye la app FastAPI. Punto único de configuración."""
    cfg = settings or get_settings()
    configure_logging(cfg.app_env)

    app = FastAPI(
        title="Pre-Autorización Quirúrgica",
        version="0.1.0",
        description=(
            "API del agente de pre-autorización quirúrgica en tiempo real. "
            "Recibe informes médicos + pólizas, valida cobertura/carencia/docs, "
            "y emite pre-aprobación, solicitud de docs faltantes o escalamiento "
            "al auditor médico humano. NUNCA auto-rechaza por diseño."
        ),
    )

    # ── Middlewares (orden: outer → inner) ──────────────────────────────
    # Starlette aplica los middlewares en orden inverso al de registro,
    # entonces:
    #   1) registramos primero `LoggingMiddleware` (corre tras CORS/RequestId)
    #   2) después `RequestIdMiddleware` (envuelve a Logging)
    #   3) por último `CORSMiddleware` (más externo)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Error handlers ──────────────────────────────────────────────────
    register_error_handlers(app)

    # ── Health ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        """Liveness probe: responde 200 si el proceso está vivo."""
        return {"status": "ok"}

    @app.get("/ready", tags=["health"])
    async def ready() -> dict[str, object]:
        """Readiness probe — best-effort check de adapters críticos."""
        checks: dict[str, object] = {"app": "ready"}
        if cfg.use_notion:
            try:
                # Probe barato: instanciar el repo de cases. Si las creds están
                # mal, esto explota acá y no en el primer request real.
                _ = get_case_repository(cfg)
                checks["notion"] = "configured"
            except Exception as exc:  # noqa: BLE001 — best-effort.
                checks["notion"] = f"error: {exc}"
        else:
            checks["notion"] = "disabled (in-memory adapters)"
        return {"status": "ready", "checks": checks}

    # ── Routers ─────────────────────────────────────────────────────────
    _register_feature_routers(app)

    # cors_origins COUNT en INFO; la lista completa solo a DEBUG. Sin esto,
    # la topología del service mesh (qué frontends llegan a este backend)
    # se shippea a cada SIEM/log aggregator innecesariamente.
    _logger.info(
        "app.started",
        env=cfg.app_env,
        use_notion=cfg.use_notion,
        cors_origins_count=len(cfg.cors_origins),
    )
    _logger.debug("app.started.cors_origins", cors_origins=cfg.cors_origins)
    return app


app = create_app()
