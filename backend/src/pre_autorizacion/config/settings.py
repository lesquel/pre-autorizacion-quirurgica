"""Settings — Pydantic v2 + pydantic-settings.

Carga configuración tipada desde variables de entorno y `.env`. El archivo
`.env` en la raíz de `backend/` (NUNCA commiteado) sirve para desarrollo;
en producción se inyectan via env vars del proceso/container.

Decisiones:
- Todas las variables tienen default razonable o vacío para permitir que la
  app levante en modo demo aún sin Notion ni LLM keys.
- `jwt_secret` tiene un default flagrante; un validator levanta error en
  `production` y warning en cualquier otro env si sigue siendo el default.
- `cors_origins` se parsea de un string CSV en env (`a,b,c`) o ya como lista
  si se monta programáticamente. Se usa `NoDecode` para que pydantic-settings
  no intente `json.loads` en el `.env` (solo JSON tipo `["http://a"]` sería válido
  sin eso).
- `use_notion` es un computed_field — `True` si hay `notion_token`. Los
  factories en `config/di.py` lo consultan para decidir adapters Notion vs
  in-memory.
"""

from __future__ import annotations

import warnings
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEFAULT_JWT_SECRET = "changeme-please-very-secret-and-long-at-least-32-chars"


class Settings(BaseSettings):
    """Settings tipados de la app. Singleton vía `get_settings()`."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ───────────────────────────────────────────────────────────
    app_host: str = "0.0.0.0"  # noqa: S104 — bind explícito documentado.
    app_port: int = 8000
    app_env: Literal["development", "staging", "production"] = "development"

    # ── Auth (JWT) ───────────────────────────────────────────────────────
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    # `iss` / `aud` evitan replay cross-service cuando varios deployments
    # comparten el mismo secret (típico cuando todos heredan el default).
    # PyJWT silencia el check si los claims no están en el token + no se
    # piden en `decode()`, así que tenemos que forzarlos en ambos lados.
    jwt_issuer: str = "pre-autorizacion-quirurgica"
    jwt_audience: str = "pre-autorizacion-api"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7

    # ── LLM (texto) ──────────────────────────────────────────────────────
    text_provider: Literal["deepseek", "openai", "anthropic"] = "deepseek"
    text_model: str = "deepseek-chat"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # ── Vision (PDFs) ────────────────────────────────────────────────────
    vision_provider: Literal["gemini", "openai", "anthropic"] = "gemini"
    vision_model: str = "gemini-2.5-flash"
    google_api_key: str = ""

    # ── Thresholds ───────────────────────────────────────────────────────
    confidence_threshold: float = 0.80
    procedure_match_threshold: float = 0.85

    # ── Notion ───────────────────────────────────────────────────────────
    # Las 7 DBs del PRD §4.2.2 ya tienen repo Notion + factory en DI; cada
    # `NOTION_DB_*` es opcional y, si está vacío, esa DB cae al adapter
    # InMemory equivalente (ver `config/di.py` y la tabla en `README.md`).
    # `extra="ignore"` (model_config) permite que `.env` tenga vars
    # desconocidas sin romper la app.
    notion_token: str = ""
    notion_db_patients: str = ""
    notion_db_insurers: str = ""
    notion_db_procedures: str = ""
    notion_db_policies: str = ""
    notion_db_coverages: str = ""
    notion_db_medical_reports: str = ""
    notion_db_authorization_cases: str = ""

    # ── Storage ──────────────────────────────────────────────────────────
    uploads_dir: Path = Path("./var/uploads")
    max_upload_mb: int = 10

    # ── CORS ─────────────────────────────────────────────────────────────
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:4200"]
    )

    # ── Validators ───────────────────────────────────────────────────────

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: object) -> object:
        """Permite CSV en env (`a,b,c`) o JSON list-like.

        Pydantic-settings parsea env vars como str. Si el valor llega como
        string lo dividimos por coma. Si ya es list/tuple, se devuelve tal cual.
        """
        if isinstance(v, str):
            stripped = v.strip()
            if not stripped:
                return []
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def _check_jwt_secret(self) -> Settings:
        """En producción, el default JWT secret es un fail-stop."""
        if self.jwt_secret == DEFAULT_JWT_SECRET:
            if self.app_env == "production":
                raise ValueError(
                    "JWT_SECRET is using the default value in production. "
                    "Generate a strong secret: openssl rand -hex 32"
                )
            warnings.warn(
                "JWT_SECRET is using the default value — OK for dev/demo, "
                "MUST be replaced in staging/production.",
                stacklevel=2,
            )
        return self

    @model_validator(mode="after")
    def _check_cors_wildcard_with_credentials(self) -> Settings:
        """`CORS_ORIGINS=*` + `allow_credentials=True` es self-DoS.

        El CORSMiddleware se monta SIEMPRE con `allow_credentials=True` en
        `main.py` (las cookies de auth dependen de eso). Si además
        `cors_origins` incluye `"*"`, el navegador rechaza TODA respuesta
        CORS por la spec — el frontend queda desconectado del backend sin
        ningún error visible del lado server. Stop esto en producción y
        warn en dev.
        """
        if "*" in self.cors_origins:
            msg = (
                "CORS_ORIGINS contiene '*' pero la app monta CORSMiddleware con "
                "allow_credentials=True. Los browsers rechazan esa combinación "
                "(spec CORS). Listá orígenes explícitos en CORS_ORIGINS."
            )
            if self.app_env == "production":
                raise ValueError(msg)
            warnings.warn(msg, stacklevel=2)
        return self

    # ── Computed ─────────────────────────────────────────────────────────

    @computed_field  # type: ignore[prop-decorator]
    @property
    def use_notion(self) -> bool:
        """`True` si el token de Notion está set; usado por DI para elegir adapters."""
        return bool(self.notion_token.strip())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Devuelve el singleton de Settings (cacheado)."""
    return Settings()


__all__ = ["DEFAULT_JWT_SECRET", "Settings", "get_settings"]
