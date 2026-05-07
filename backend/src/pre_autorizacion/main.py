"""FastAPI app factory para Pre-Autorización Quirúrgica.

El composition root vive en `config/di.py`. Este archivo solo arma el `app`,
registra middlewares globales (CORS, request_id, error handlers) y monta los
routers de cada feature.

Phase B0: solo `/health` y `/ready` para validar que arranca.
Phase B2: routers de auth, cases, policies, procedures.
"""

from fastapi import FastAPI


def create_app() -> FastAPI:
    """Construye la app FastAPI. Punto único de configuración."""
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

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        """Liveness probe: responde 200 si el proceso está vivo."""
        return {"status": "ok"}

    @app.get("/ready", tags=["health"])
    def ready() -> dict[str, str]:
        """Readiness probe. Phase B2 chequea conectividad Notion + LLM."""
        return {"status": "ready"}

    return app


app = create_app()
