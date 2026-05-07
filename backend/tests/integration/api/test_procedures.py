"""Integration tests — procedures listing + search."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login


class TestProcedures:
    def test_list_returns_seed_catalog(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get("/api/v1/procedures", headers=auth_header(token))
        assert res.status_code == 200
        assert len(res.json()) >= 6

    def test_search_filters_results(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get("/api/v1/procedures?q=catarata", headers=auth_header(token))
        assert res.status_code == 200
        body = res.json()
        assert all("catarata" in p["name"].lower() for p in body)
        assert len(body) >= 1

    def test_unauthenticated_request_returns_401(self, client: TestClient) -> None:
        res = client.get("/api/v1/procedures")
        assert res.status_code == 401
