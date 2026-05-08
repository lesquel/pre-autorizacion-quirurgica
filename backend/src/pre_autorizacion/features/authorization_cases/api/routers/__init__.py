"""Routers FastAPI del feature `authorization_cases`."""

from fastapi import APIRouter

from pre_autorizacion.features.authorization_cases.api.routers.cases import router as cases_router
from pre_autorizacion.features.authorization_cases.api.routers.extract import router as extract_router

router = APIRouter()
router.include_router(cases_router)
router.include_router(extract_router)

__all__ = ["router"]
