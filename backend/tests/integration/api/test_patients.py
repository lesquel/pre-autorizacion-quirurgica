"""Integration tests — patients listing + get-by-id.

Cubren los 2 endpoints expuestos en commit `642e1d4`:
- GET /api/v1/patients (list, ?dni filter)
- GET /api/v1/patients/{patient_id}

Conftest fuerza InMemoryPatientRepository (sin Notion real). Los seed
ids `PAC-00481`, `PAC-00622`, etc vienen de `shared/fixtures/seed.py`.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login


class TestListPatients:
    def test_list_returns_seed_patients(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get("/api/v1/patients", headers=auth_header(token))
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body, list)
        assert len(body) >= 4  # seed.py tiene >= 4 pacientes
        ids = [p["id"] for p in body]
        assert "PAC-00481" in ids

    def test_list_filter_by_dni_returns_one(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        # DNI de María Elena Vásquez Romero (PAC-00481).
        res = client.get(
            "/api/v1/patients?dni=1714592083", headers=auth_header(token)
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["dni"] == "1714592083"
        assert body[0]["id"] == "PAC-00481"

    def test_list_filter_by_unknown_dni_returns_empty(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get(
            "/api/v1/patients?dni=9999999999", headers=auth_header(token)
        )
        assert res.status_code == 200
        assert res.json() == []

    def test_list_unauthenticated_returns_401(self, client: TestClient) -> None:
        res = client.get("/api/v1/patients")
        assert res.status_code == 401


class TestGetPatientById:
    def test_get_by_id_returns_patient(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get(
            "/api/v1/patients/PAC-00481", headers=auth_header(token)
        )
        assert res.status_code == 200
        body = res.json()
        assert body["id"] == "PAC-00481"
        assert body["dni"] == "1714592083"
        # Aseguramos camelCase serialization (CamelModel base).
        assert "dob" in body or "dateOfBirth" in body

    def test_get_by_id_not_found_returns_404_problem(
        self, client: TestClient
    ) -> None:
        """404 RFC 7807 — type/title/status/detail/instance + traceId."""
        token = login(client, "hospital@demo.com", "hospital")
        res = client.get(
            "/api/v1/patients/PAC-DOES-NOT-EXIST", headers=auth_header(token)
        )
        assert res.status_code == 404
        # Content-Type debe ser application/problem+json (RFC 7807).
        assert "application/problem+json" in res.headers["content-type"]
        body = res.json()
        assert body["status"] == 404
        assert body["title"] == "Resource not found"
        assert "PAC-DOES-NOT-EXIST" in body["detail"]
        assert body["instance"] == "/api/v1/patients/PAC-DOES-NOT-EXIST"
        # traceId siempre presente vía X-Request-Id middleware.
        assert "traceId" in body

    def test_get_by_id_unauthenticated_returns_401(self, client: TestClient) -> None:
        res = client.get("/api/v1/patients/PAC-00481")
        assert res.status_code == 401
