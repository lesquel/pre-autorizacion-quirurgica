"""Composition Root — DI factories de la app.

Único lugar donde se eligen adapters concretos:
- Notion vs in-memory (según `settings.use_notion` y db ids).
- LocalFsAdapter para `FileStorage` (siempre).
- LLMProvider / VisionExtractor → placeholders `_Null*` hasta Phase B3.

Cada factory está cacheada con `lru_cache` keyed sobre el id del settings, así
que durante toda la vida del proceso devuelve la misma instancia.

Las imports de adapters Notion/InMemory las resuelve el sub-agente B2D y los
nombres aquí son los acordados (ver instrucciones del orquestador). Si un
adapter aún no existe, el `get_*` correspondiente sigue importable porque el
fallback in-memory cubre el caso por defecto en demo.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any

from pre_autorizacion.config.settings import Settings, get_settings
from pre_autorizacion.features.auth.application.jwt_service import JwtService
from pre_autorizacion.features.auth.domain.ports import UserRepository
from pre_autorizacion.features.auth.infrastructure.in_memory_user_store import InMemoryUserStore
from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
    CaseRepository,
)
from pre_autorizacion.features.policies.domain.ports.coverage_repository import CoverageRepository
from pre_autorizacion.features.policies.domain.ports.insurer_repository import InsurerRepository
from pre_autorizacion.features.policies.domain.ports.policy_repository import PolicyRepository
from pre_autorizacion.shared.llm.ports.llm_provider import LLMProvider
from pre_autorizacion.shared.storage.ports.file_storage import FileStorage
from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractor

if TYPE_CHECKING:
    from pydantic import BaseModel


# ── Null placeholders (Phase B3 los reemplaza con adapters reales) ─────────


class _NullLLMProvider(LLMProvider):
    """Placeholder hasta Phase B3 — falla explícitamente si se invoca.

    La app levanta sin keys de LLM, pero cualquier path que invoque al LLM
    se va a romper de forma audible. Eso es a propósito: queremos que un
    `/cases/.../resolve` falle ruidosamente en demo si nadie configuró el
    proveedor, no que devuelva un valor silencioso.
    """

    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.0,
        max_tokens: int | None = None,
    ) -> str:
        raise NotImplementedError(
            "LLMProvider not configured. Set DEEPSEEK_API_KEY (or another provider) "
            "and replace this stub via Phase B3."
        )

    async def complete_structured(
        self,
        prompt: str,
        *,
        schema: type[BaseModel],
        system: str | None = None,
        temperature: float = 0.0,
    ) -> Any:  # noqa: ANN401 — generic stub.
        raise NotImplementedError(
            "LLMProvider not configured. Set DEEPSEEK_API_KEY (or another provider) "
            "and replace this stub via Phase B3."
        )


class _NullVisionExtractor(VisionExtractor):
    """Placeholder hasta Phase B3 — idem `_NullLLMProvider`."""

    async def extract_from_pdf(
        self,
        pdf_bytes: bytes,
        *,
        prompt: str | None = None,
    ) -> str:
        raise NotImplementedError(
            "VisionExtractor not configured. Set GOOGLE_API_KEY (or another provider) "
            "and replace this stub via Phase B3."
        )

    async def extract_structured(
        self,
        pdf_bytes: bytes,
        *,
        schema: type[BaseModel],
        prompt: str | None = None,
    ) -> Any:  # noqa: ANN401 — generic stub.
        raise NotImplementedError(
            "VisionExtractor not configured. Set GOOGLE_API_KEY (or another provider) "
            "and replace this stub via Phase B3."
        )


# ── Factories cacheadas ────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def get_user_repository(settings: Settings | None = None) -> UserRepository:
    """Repositorio de usuarios — in-memory en MVP."""
    _ = settings or get_settings()
    return InMemoryUserStore()


@lru_cache(maxsize=1)
def get_jwt_service(settings: Settings | None = None) -> JwtService:
    """JwtService configurado con el secret + TTLs de Settings."""
    s = settings or get_settings()
    return JwtService(
        secret=s.jwt_secret,
        algorithm=s.jwt_algorithm,
        access_ttl_minutes=s.access_token_ttl_minutes,
        refresh_ttl_days=s.refresh_token_ttl_days,
    )


@lru_cache(maxsize=1)
def get_file_storage(settings: Settings | None = None) -> FileStorage:
    """`LocalFsAdapter` apuntando a `settings.uploads_dir`."""
    s = settings or get_settings()
    # El adapter lo crea el sub-agente B2D. Import diferido para tolerar la
    # ventana en la que el archivo aún no existe (la app siempre levanta).
    from pre_autorizacion.shared.storage.adapters.local_fs_adapter import (  # noqa: PLC0415
        LocalFsAdapter,
    )

    adapter: FileStorage = LocalFsAdapter(s.uploads_dir)
    return adapter


@lru_cache(maxsize=1)
def get_policy_repository(settings: Settings | None = None) -> PolicyRepository:
    """Notion si hay token + db id; in-memory en otro caso."""
    s = settings or get_settings()
    if s.use_notion and s.notion_db_policies:
        from pre_autorizacion.features.policies.infrastructure.repos.notion_policy import (  # noqa: PLC0415
            NotionPolicyRepository,
        )
        from pre_autorizacion.shared.notion.client import NotionClient  # noqa: PLC0415

        return NotionPolicyRepository(NotionClient(s.notion_token), s.notion_db_policies)

    from pre_autorizacion.features.policies.infrastructure.repos.in_memory_policy import (  # noqa: PLC0415
        InMemoryPolicyRepository,
    )

    return InMemoryPolicyRepository()


@lru_cache(maxsize=1)
def get_coverage_repository(settings: Settings | None = None) -> CoverageRepository:
    """Notion si hay token + db id; in-memory en otro caso."""
    s = settings or get_settings()
    if s.use_notion and s.notion_db_coverages:
        from pre_autorizacion.features.policies.infrastructure.repos.notion_coverage import (  # noqa: PLC0415
            NotionCoverageRepository,
        )
        from pre_autorizacion.shared.notion.client import NotionClient  # noqa: PLC0415

        return NotionCoverageRepository(NotionClient(s.notion_token), s.notion_db_coverages)

    from pre_autorizacion.features.policies.infrastructure.repos.in_memory_coverage import (  # noqa: PLC0415
        InMemoryCoverageRepository,
    )

    return InMemoryCoverageRepository()


@lru_cache(maxsize=1)
def get_insurer_repository(settings: Settings | None = None) -> InsurerRepository:
    """Notion si hay token + db id; in-memory en otro caso."""
    s = settings or get_settings()
    if s.use_notion and s.notion_db_insurers:
        from pre_autorizacion.features.policies.infrastructure.repos.notion_insurer import (  # noqa: PLC0415
            NotionInsurerRepository,
        )
        from pre_autorizacion.shared.notion.client import NotionClient  # noqa: PLC0415

        return NotionInsurerRepository(NotionClient(s.notion_token), s.notion_db_insurers)

    from pre_autorizacion.features.policies.infrastructure.repos.in_memory_insurer import (  # noqa: PLC0415
        InMemoryInsurerRepository,
    )

    return InMemoryInsurerRepository()


@lru_cache(maxsize=1)
def get_case_repository(settings: Settings | None = None) -> CaseRepository:
    """Notion si hay token + db id; in-memory en otro caso."""
    s = settings or get_settings()
    if s.use_notion and s.notion_db_authorization_cases:
        from pre_autorizacion.features.authorization_cases.infrastructure.persistence.notion.notion_case import (  # noqa: PLC0415
            NotionCaseRepository,
        )
        from pre_autorizacion.shared.notion.client import NotionClient  # noqa: PLC0415

        return NotionCaseRepository(
            NotionClient(s.notion_token),
            s.notion_db_authorization_cases,
            s.notion_db_medical_reports,
        )

    from pre_autorizacion.features.authorization_cases.infrastructure.repos.in_memory_case import (  # noqa: PLC0415
        InMemoryCaseRepository,
    )

    return InMemoryCaseRepository()


@lru_cache(maxsize=1)
def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    """LLM provider — `_NullLLMProvider` hasta Phase B3.

    TODO B3: si `settings.text_provider == "deepseek"` y hay api key, devolver
    `DeepSeekAdapter(settings)`; idem para `openai` y `anthropic`.
    """
    _ = settings or get_settings()
    return _NullLLMProvider()


@lru_cache(maxsize=1)
def get_vision_extractor(settings: Settings | None = None) -> VisionExtractor:
    """Vision extractor — `_NullVisionExtractor` hasta Phase B3.

    TODO B3: si `settings.vision_provider == "gemini"` y hay api key, devolver
    `GeminiVisionAdapter(settings)`.
    """
    _ = settings or get_settings()
    return _NullVisionExtractor()


def reset_container() -> None:
    """Limpia los singletons cacheados (útil en tests)."""
    get_user_repository.cache_clear()
    get_jwt_service.cache_clear()
    get_file_storage.cache_clear()
    get_policy_repository.cache_clear()
    get_coverage_repository.cache_clear()
    get_insurer_repository.cache_clear()
    get_case_repository.cache_clear()
    get_llm_provider.cache_clear()
    get_vision_extractor.cache_clear()


__all__ = [
    "get_case_repository",
    "get_coverage_repository",
    "get_file_storage",
    "get_insurer_repository",
    "get_jwt_service",
    "get_llm_provider",
    "get_policy_repository",
    "get_user_repository",
    "get_vision_extractor",
    "reset_container",
]
