"""Integration test fixtures — FastAPI TestClient + reset DI between tests."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from pre_autorizacion.config.di import reset_container
from pre_autorizacion.main import create_app


@pytest.fixture(autouse=True)
def _reset_di() -> Iterator[None]:
    reset_container()
    yield
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
