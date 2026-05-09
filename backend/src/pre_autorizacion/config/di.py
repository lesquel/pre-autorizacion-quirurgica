"""Composition Root — DI factories de la app.

Único lugar donde se eligen adapters concretos:
- Notion vs in-memory (según `settings.use_notion` y db ids).
- LocalFsAdapter para `FileStorage` (siempre).
- LLMProvider / VisionExtractor → DeepSeek / Gemini cuando hay api keys, y
  placeholders `_Null*` que fallan ruidosamente cuando no.

Las factories singleton usan `lru_cache(maxsize=1)` **sin** pasar `Settings` como
argumento (Pydantic `BaseSettings` no es hashable — rompería la caché). Quien
necesita config llama a `get_settings()` dentro del cuerpo o usa el default
`settings=None`.

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
from pre_autorizacion.features.authorization_cases.domain.ports.agent_orchestrator import (
    AgentOrchestrator,
)
from pre_autorizacion.features.authorization_cases.domain.ports.authorization_decision_maker import (
    AuthorizationDecisionMaker,
)
from pre_autorizacion.features.authorization_cases.domain.ports.case_repository import (
    CaseRepository,
)
from pre_autorizacion.features.authorization_cases.domain.ports.medical_report_extractor import (
    MedicalReportExtractor,
)
from pre_autorizacion.features.authorization_cases.domain.ports.response_generator import (
    ResponseGenerator,
)
from pre_autorizacion.features.policies.domain.ports.coverage_repository import CoverageRepository
from pre_autorizacion.features.procedures.domain.ports import ProcedureRepository
from pre_autorizacion.features.policies.domain.ports.insurer_repository import InsurerRepository
from pre_autorizacion.features.policies.domain.ports.policy_repository import PolicyRepository
from pre_autorizacion.shared.domain.ports import PatientRepository
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
    """JwtService configurado con el secret + TTLs + issuer/audience de Settings."""
    s = settings or get_settings()
    return JwtService(
        secret=s.jwt_secret,
        algorithm=s.jwt_algorithm,
        access_ttl_minutes=s.access_token_ttl_minutes,
        refresh_ttl_days=s.refresh_token_ttl_days,
        issuer=s.jwt_issuer,
        audience=s.jwt_audience,
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
def get_patient_repository(settings: Settings | None = None) -> PatientRepository:
    """Notion si hay token + db id; in-memory en otro caso."""
    s = settings or get_settings()
    if s.use_notion and s.notion_db_patients:
        from pre_autorizacion.shared.infrastructure.repos.notion_patient import (  # noqa: PLC0415
            NotionPatientRepository,
        )
        from pre_autorizacion.shared.notion.client import NotionClient  # noqa: PLC0415

        return NotionPatientRepository(NotionClient(s.notion_token), s.notion_db_patients)

    from pre_autorizacion.shared.infrastructure.repos.in_memory_patient import (  # noqa: PLC0415
        InMemoryPatientRepository,
    )

    return InMemoryPatientRepository()


@lru_cache(maxsize=1)
def get_procedure_repository(settings: Settings | None = None) -> ProcedureRepository:
    """Notion si hay token + db id; in-memory en otro caso."""
    s = settings or get_settings()
    if s.use_notion and s.notion_db_procedures:
        from pre_autorizacion.features.procedures.infrastructure.repos.notion_procedure import (  # noqa: PLC0415
            NotionProcedureRepository,
        )
        from pre_autorizacion.shared.notion.client import NotionClient  # noqa: PLC0415

        return NotionProcedureRepository(NotionClient(s.notion_token), s.notion_db_procedures)

    from pre_autorizacion.features.procedures.infrastructure.repos.in_memory_procedure import (  # noqa: PLC0415
        InMemoryProcedureRepository,
    )

    return InMemoryProcedureRepository()


@lru_cache(maxsize=1)
def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    """LLM provider — DeepSeek (default) cuando hay API key, sino `_NullLLMProvider`.

    Wired in B3: si `settings.text_provider == "deepseek"` y hay api key,
    devuelve `DeepSeekLLMAdapter`. OpenAI/Anthropic quedan pendientes hasta
    que haya adapters concretos para ellos.
    """
    s = settings or get_settings()
    if s.text_provider == "deepseek" and s.deepseek_api_key:
        from pre_autorizacion.shared.llm.adapters.deepseek_adapter import (  # noqa: PLC0415
            DeepSeekLLMAdapter,
        )

        return DeepSeekLLMAdapter(
            api_key=s.deepseek_api_key,
            model=s.text_model,
            base_url=s.deepseek_base_url,
        )
    return _NullLLMProvider()


@lru_cache(maxsize=1)
def get_vision_extractor(settings: Settings | None = None) -> VisionExtractor:
    """Vision extractor — Gemini (default) cuando hay API key, sino `_NullVisionExtractor`.

    Wired in B3: si `settings.vision_provider == "gemini"` y hay
    `google_api_key`, devuelve `GeminiVisionAdapter`.
    """
    s = settings or get_settings()
    if s.vision_provider == "gemini" and s.google_api_key:
        from pre_autorizacion.shared.vision.adapters.gemini_adapter import (  # noqa: PLC0415
            GeminiVisionAdapter,
        )

        return GeminiVisionAdapter(
            api_key=s.google_api_key,
            model=s.vision_model,
        )
    return _NullVisionExtractor()


@lru_cache(maxsize=1)
def get_text_extractor(settings: Settings | None = None) -> MedicalReportExtractor:
    """Extractor high-level para informes en TEXTO (compone `LLMProvider`)."""
    _ = settings or get_settings()
    from pre_autorizacion.features.authorization_cases.infrastructure.extractors.text_extractor import (  # noqa: PLC0415
        TextMedicalReportExtractor,
    )

    return TextMedicalReportExtractor(get_llm_provider())


@lru_cache(maxsize=1)
def get_pdf_extractor(settings: Settings | None = None) -> MedicalReportExtractor:
    """Extractor high-level para informes en PDF (compone `VisionExtractor` + storage)."""
    s = settings or get_settings()
    from pre_autorizacion.features.authorization_cases.infrastructure.extractors.pdf_extractor import (  # noqa: PLC0415
        PdfMedicalReportExtractor,
    )

    try_structured_vision = bool(
        str(s.google_api_key or "").strip() and s.vision_provider == "gemini"
    )
    return PdfMedicalReportExtractor(
        get_vision_extractor(),
        storage=get_file_storage(),
        text_pipeline=get_text_extractor(),
        try_structured_vision=try_structured_vision,
    )


@lru_cache(maxsize=1)
def get_decision_maker(settings: Settings | None = None) -> AuthorizationDecisionMaker:
    """`AuthorizationDecisionMaker` LLM-based (compone `LLMProvider`)."""
    s = settings or get_settings()
    from pre_autorizacion.features.authorization_cases.infrastructure.decision.llm_decision_maker import (  # noqa: PLC0415
        LlmAuthorizationDecisionMaker,
    )

    return LlmAuthorizationDecisionMaker(
        get_llm_provider(),
        model_name=s.text_model,
    )


@lru_cache(maxsize=1)
def get_response_generator(settings: Settings | None = None) -> ResponseGenerator:
    """`ResponseGenerator` LLM-based (compone `LLMProvider`)."""
    s = settings or get_settings()
    from pre_autorizacion.features.authorization_cases.infrastructure.decision.llm_response_generator import (  # noqa: PLC0415
        LlmResponseGenerator,
    )

    return LlmResponseGenerator(get_llm_provider())


@lru_cache(maxsize=1)
def get_agent_orchestrator(settings: Settings | None = None) -> AgentOrchestrator | None:
    """`AgentOrchestrator` LangGraph-based.

    Devuelve `None` cuando NO hay credenciales LLM/Vision configuradas — el
    `SubmitCaseUseCase` cae al flow MOCK determinístico en ese caso.

    Política:
    - Si NO hay `deepseek_api_key` (o key del provider de texto) → `None`.
      No tiene sentido armar el grafo si el LLM va a fallar en cada corrida.
    - Si hay key de texto pero NO hay `google_api_key`, igual armamos el
      orchestrator: el grafo solo invoca al pdf_extractor cuando llega un
      report PDF. Reports en texto siguen funcionando con texto solo.
    """
    s = settings or get_settings()

    # Sin LLM de texto el grafo no puede correr el nodo `make_decision`.
    has_text_key = bool(
        (s.text_provider == "deepseek" and s.deepseek_api_key)
        or (s.text_provider == "openai" and s.openai_api_key)
        or (s.text_provider == "anthropic" and s.anthropic_api_key)
    )
    if not has_text_key:
        return None

    from pre_autorizacion.features.authorization_cases.application.agent.graph import (  # noqa: PLC0415
        build_graph,
    )
    from pre_autorizacion.features.authorization_cases.infrastructure.agents.langgraph_orchestrator import (  # noqa: PLC0415
        LangGraphAgentOrchestrator,
    )

    return LangGraphAgentOrchestrator(
        graph=build_graph(),
        extractor_text=get_text_extractor(),
        extractor_pdf=get_pdf_extractor(),
        decision_maker=get_decision_maker(),
    )


def reset_container() -> None:
    """Limpia los singletons cacheados (útil en tests).

    Incluye `get_settings` — sin esto, una test fixture que recarga el
    container hereda el `Settings` cacheado del primer import (con `.env`
    real), pisando los overrides via `monkeypatch.setenv` y filtrando
    creds reales (NOTION_TOKEN, DEEPSEEK_API_KEY) hacia tests offline.
    """
    get_settings.cache_clear()
    get_user_repository.cache_clear()
    get_jwt_service.cache_clear()
    get_file_storage.cache_clear()
    get_policy_repository.cache_clear()
    get_coverage_repository.cache_clear()
    get_insurer_repository.cache_clear()
    get_case_repository.cache_clear()
    get_llm_provider.cache_clear()
    get_vision_extractor.cache_clear()
    get_text_extractor.cache_clear()
    get_pdf_extractor.cache_clear()
    get_patient_repository.cache_clear()
    get_procedure_repository.cache_clear()
    get_decision_maker.cache_clear()
    get_response_generator.cache_clear()
    get_agent_orchestrator.cache_clear()


__all__ = [
    "get_agent_orchestrator",
    "get_case_repository",
    "get_coverage_repository",
    "get_decision_maker",
    "get_file_storage",
    "get_insurer_repository",
    "get_jwt_service",
    "get_llm_provider",
    "get_patient_repository",
    "get_pdf_extractor",
    "get_policy_repository",
    "get_procedure_repository",
    "get_response_generator",
    "get_text_extractor",
    "get_user_repository",
    "get_vision_extractor",
    "reset_container",
]
