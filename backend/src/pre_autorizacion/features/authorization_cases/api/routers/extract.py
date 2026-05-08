"""Endpoints de extracción previa (PDF hospital / PDF póliza) sin crear caso."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from pre_autorizacion.features.auth.domain.entities import User
from pre_autorizacion.features.authorization_cases.api.schemas.extract import (
    MedicalPdfExtractOut,
    PolicyPdfExtractOut,
)
from pre_autorizacion.shared.api.deps import SettingsDep, VisionExtractorDep, require_authenticated
from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractionError

_PDF_MAGIC = b"%PDF-"

MEDICAL_EXTRACT_PROMPT = """Sos un asistente clínico. Analizá este PDF de INFORME MÉDICO (hospital)
y extraé únicamente datos que aparezcan explícitamente en el documento.
Normas:
- No inventes: si un campo no está, devolvé null.
- patient_id: número de paciente, historia clínica o ID si figura.
- policy_number: sólo si el informe menciona número de póliza.
- diagnosis_code / procedure_code: códigos CIE-10 si constan.
- report_text_summary: hasta ~800 caracteres del fragmento más relevante del informe (opcional).
- confidence: qué tan legible y completo está el PDF para extraer estos datos (0–1).
Respondé en el schema solicitado."""

POLICY_EXTRACT_PROMPT = """Sos un asistente de seguros. Analizá este PDF de PÓLIZA o CERTIFICADO DE COBERTURA
del paciente y extraé datos explícitos del documento.
Normas:
- No inventes: campos ausentes → null.
- policy_number: número de póliza tal como aparece.
- patient_id: documento de identidad o ID del paciente cubierto si aparece.
- insurer_name y plan_name si constan.
- confidence: claridad del PDF (0–1).
Respondé en el schema solicitado."""

router = APIRouter(prefix="/api/v1/extract", tags=["extract"])


async def _read_pdf(file: UploadFile, max_mb: int) -> bytes:
    content = await file.read()
    if len(content) > max_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo supera {max_mb} MB",
        )
    if not content.startswith(_PDF_MAGIC):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="No es un PDF válido")
    return content


@router.post(
    "/medical-report-pdf",
    response_model=MedicalPdfExtractOut,
    summary="Extraer campos del informe médico (PDF) para autocompletar el formulario",
)
async def extract_medical_report_pdf(
    settings: SettingsDep,
    vision: VisionExtractorDep,
    _user: Annotated[User, Depends(require_authenticated)],
    file: Annotated[UploadFile, File(..., description="PDF del informe médico (hospital)")],
) -> MedicalPdfExtractOut:
    raw = await _read_pdf(file, settings.max_upload_mb)
    try:
        return await vision.extract_structured(
            raw,
            schema=MedicalPdfExtractOut,
            prompt=MEDICAL_EXTRACT_PROMPT,
        )
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Extracción por IA no configurada. Definí GOOGLE_API_KEY en el backend.",
        ) from None
    except VisionExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post(
    "/policy-pdf",
    response_model=PolicyPdfExtractOut,
    summary="Extraer campos de la póliza del paciente (PDF) para autocompletar el formulario",
)
async def extract_policy_pdf(
    settings: SettingsDep,
    vision: VisionExtractorDep,
    _user: Annotated[User, Depends(require_authenticated)],
    file: Annotated[UploadFile, File(..., description="PDF de póliza / certificado aseguradora")],
) -> PolicyPdfExtractOut:
    raw = await _read_pdf(file, settings.max_upload_mb)
    try:
        return await vision.extract_structured(
            raw,
            schema=PolicyPdfExtractOut,
            prompt=POLICY_EXTRACT_PROMPT,
        )
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Extracción por IA no configurada. Definí GOOGLE_API_KEY en el backend.",
        ) from None
    except VisionExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


__all__ = ["router"]
