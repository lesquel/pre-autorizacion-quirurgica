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
    # Solo se declaran las DBs que el backend USA hoy. `NOTION_DB_PATIENTS` y
    # `NOTION_DB_PROCEDURES` fueron removidas (issue #4): no había repo Notion
    # ni factory en DI consumiéndolas — se cuelan en Settings era "config
    # fantasma" para el operador. Si en post-v1 se implementan, volver a
    # declararlas acá. `extra="ignore"` (model_config) permite que `.env`
    # tenga vars desconocidas sin romper la app.
    notion_token: str = ""
    notion_db_insurers: str = ""
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
