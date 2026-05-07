"""Integration tests — policy CRUD + RBAC + replace coverages."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login

NEW_POLICY = {
    "number": "POL-NEW-0001",
    "patientId": "PAC-00481",
    "plan": "Plan Test",
    "insurerId": "INS-ANDINA",
    "startDate": "2026-01-01",
    "endDate": "2027-01-01",
    "status": "ACTIVE",
}


class TestPolicyCrud:
    def test_create_policy_as_insurer(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        res = client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        assert res.status_code == 201
        assert res.json()["number"] == "POL-NEW-0001"

    def test_create_policy_as_hospital_is_forbidden(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        assert res.status_code == 403

    def test_update_policy(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        updated = {**NEW_POLICY, "plan": "Plan Updated"}
        res = client.put(
            f"/api/v1/policies/{NEW_POLICY['number']}",
            json=updated,
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert res.json()["plan"] == "Plan Updated"

    def test_update_policy_path_body_mismatch_returns_400(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        res = client.put(
            "/api/v1/policies/POL-OTHER",
            json=NEW_POLICY,
            headers=auth_header(token),
        )
        assert res.status_code == 400

    def test_delete_policy(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        res = client.delete(
            f"/api/v1/policies/{NEW_POLICY['number']}",
            headers=auth_header(token),
        )
        assert res.status_code == 204
        get_res = client.get(
            f"/api/v1/policies/{NEW_POLICY['number']}",
            headers=auth_header(token),
        )
        assert get_res.status_code == 404

    def test_replace_coverages(self, client: TestClient) -> None:
        token = login(client, "insurer@demo.com", "insurer")
        client.post("/api/v1/policies", json=NEW_POLICY, headers=auth_header(token))
        coverages = [
            {
                "policyNumber": NEW_POLICY["number"],
                "procedureCode": "K80.20",
                "covered": True,
                "waitingDays": 90,
                "copay": "80",
                "requiredDocs": ["Informe médico", "Eco abdominal"],
            }
        ]
        res = client.put(
            f"/api/v1/policies/{NEW_POLICY['number']}/coverages",
            json=coverages,
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["procedureCode"] == "K80.20"
