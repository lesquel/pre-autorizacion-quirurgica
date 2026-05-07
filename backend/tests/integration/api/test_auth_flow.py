"""Integration tests — login, refresh, me, logout."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login


class TestAuthFlow:
    def test_login_with_valid_credentials_returns_tokens(self, client: TestClient) -> None:
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "hospital@demo.com", "password": "hospital"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["accessToken"]
        assert body["refreshToken"]
        assert body["user"]["role"] == "hospital"

    def test_login_with_bad_password_returns_401(self, client: TestClient) -> None:
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "hospital@demo.com", "password": "wrong"},
        )
        assert res.status_code == 401

    def test_me_returns_current_user(self, client: TestClient) -> None:
        token = login(client, "auditor@demo.com", "auditor")
        res = client.get("/api/v1/auth/me", headers=auth_header(token))
        assert res.status_code == 200
        assert res.json()["role"] == "auditor"

    def test_refresh_returns_new_access_token(self, client: TestClient) -> None:
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": "insurer@demo.com", "password": "insurer"},
        )
        refresh_token = login_res.json()["refreshToken"]
        res = client.post(
            "/api/v1/auth/refresh",
            json={"refreshToken": refresh_token},
        )
        assert res.status_code == 200
        assert res.json()["accessToken"]

    def test_logout_returns_204(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post("/api/v1/auth/logout", headers=auth_header(token))
        assert res.status_code == 204
