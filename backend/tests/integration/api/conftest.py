"""Integration test fixtures — FastAPI TestClient + reset DI between tests.

Forzamos InMemory adapters (sin Notion ni LLM real) limpiando las env vars
relevantes vía `monkeypatch`. Esto aísla los tests del `.env` local del dev:
si el dev tiene `NOTION_TOKEN` o `DEEPSEEK_API_KEY` configuradas para correr
la app de verdad, los tests igual usan los stubs in-memory determinísticos.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from pre_autorizacion.config.di import reset_container
from pre_autorizacion.config.settings import get_settings
from pre_autorizacion.main import create_app

_ENV_VARS_TO_CLEAR = (
    "NOTION_TOKEN",
    # NOTION_DB_PATIENTS y NOTION_DB_PROCEDURES removidas en issue #4 (no
    # tenían repo ni factory consumiéndolas). Si en post-v1 se implementan
    # los adapters Notion correspondientes, volver a agregarlas acá.
    "NOTION_DB_INSURERS",
    "NOTION_DB_POLICIES",
    "NOTION_DB_COVERAGES",
    "NOTION_DB_MEDICAL_REPORTS",
    "NOTION_DB_AUTHORIZATION_CASES",
    "DEEPSEEK_API_KEY",
    "GOOGLE_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
)


@pytest.fixture(autouse=True)
def _reset_di(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    for var in _ENV_VARS_TO_CLEAR:
        monkeypatch.setenv(var, "")
    # `get_settings` está lru_cached y `reset_container()` solo limpia
    # las factories — si no clean acá, Settings queda con valores de
    # `.env` cargados al primer import.
    get_settings.cache_clear()
    reset_container()
    yield
    get_settings.cache_clear()
    reset_container()


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def login(client: TestClient, email: str, password: str) -> str:
    """Helper: returns the access token from a successful login."""
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
