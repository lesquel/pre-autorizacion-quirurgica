"""Integration tests — multipart PDF upload + file download."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.integration.api.conftest import auth_header, login

# Minimal valid-looking PDF: "%PDF-1.4..." — enough for our magic-byte check.
_FAKE_PDF = b"%PDF-1.4\n%\x80\x80\x80\x80\n1 0 obj <<>> endobj trailer<<>> %%EOF"


class TestCaseUpload:
    def test_upload_pdf_creates_case(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post(
            "/api/v1/cases/upload",
            files={"file": ("informe.pdf", _FAKE_PDF, "application/pdf")},
            data={
                "policy_number": "POL-2024-04812",
                "patient_id": "PAC-00481",
                "procedure_solicited_hint": "K80.20",
            },
            headers=auth_header(token),
        )
        assert res.status_code == 202, res.text
        body = res.json()
        assert body["id"].startswith("CASE-")
        assert body["status"] in {"APROBADO_AUTO", "DOCS_PEDIDOS", "ESCALADO"}

    def test_upload_non_pdf_returns_415(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        res = client.post(
            "/api/v1/cases/upload",
            files={"file": ("notes.txt", b"not a pdf", "text/plain")},
            data={"policy_number": "POL-2024-04812", "patient_id": "PAC-00481"},
            headers=auth_header(token),
        )
        assert res.status_code == 415

    def test_upload_too_large_returns_413(self, client: TestClient) -> None:
        token = login(client, "hospital@demo.com", "hospital")
        # 11 MB of garbage prefixed with PDF magic so the size check fires first.
        big = _FAKE_PDF + b"\x00" * (11 * 1024 * 1024)
        res = client.post(
            "/api/v1/cases/upload",
            files={"file": ("huge.pdf", big, "application/pdf")},
            data={"policy_number": "POL-2024-04812", "patient_id": "PAC-00481"},
            headers=auth_header(token),
        )
        assert res.status_code == 413

    def test_download_file_with_invalid_filename_returns_400(
        self, client: TestClient
    ) -> None:
        # Filenames with path-separator characters or non-alphanum chars are
        # rejected by `_validate_pdf_filename` before any storage access.
        # `evil..pdf` passes Starlette routing but fails the regex.
        token = login(client, "auditor@demo.com", "auditor")
        res = client.get(
            "/api/v1/cases/CASE-XYZ/files/evil..pdf",
            headers=auth_header(token),
        )
        assert res.status_code == 400
