"""Error handlers globales — RFC 7807 (Problem Details for HTTP APIs).

Cada `DomainError` lanzada en cualquier capa se mapea a una respuesta JSON
del shape:

    {
      "type":     "https://...",
      "title":    "Resource not found",
      "status":   404,
      "detail":   "Case 'foo' not found",
      "instance": "/api/v1/cases/foo",
      "traceId":  "<X-Request-Id>"
    }

`Content-Type` es `application/problem+json` (RFC 7807 §3).
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from pre_autorizacion.shared.domain.errors import (
    DomainError,
    IntegrationError,
    NotionError,
)
from pre_autorizacion.shared.vision.ports.vision_extractor import VisionExtractionError

PROBLEM_JSON = "application/problem+json"
_logger = structlog.get_logger("api.errors")


def _problem_response(
    *,
    status: int,
    title: str,
    type_uri: str,
    detail: str,
    request: Request,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    body: dict[str, Any] = {
        "type": type_uri,
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
    }
    if request_id:
        body["traceId"] = request_id
    if extra:
        body.update(extra)
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_JSON)


async def _handle_domain_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)  # noqa: S101 — guarded by registration.
    _logger.warning(
        "domain.error",
        error_type=type(exc).__name__,
        status=exc.status,
        detail=exc.detail,
    )
    return _problem_response(
        status=exc.status,
        title=exc.title,
        type_uri=exc.type_uri,
        detail=exc.detail,
        request=request,
    )


async def _handle_notion_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, NotionError)  # noqa: S101
    _logger.error("notion.error", detail=exc.detail)
    return _problem_response(
        status=exc.status,
        title=exc.title,
        type_uri=exc.type_uri,
        detail=exc.detail,
        request=request,
    )


async def _handle_vision_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, VisionExtractionError)  # noqa: S101
    _logger.error("vision.error", detail=str(exc))
    return _problem_response(
        status=502,
        title="Vision extraction failed",
        type_uri="https://pre-autorizacion.dev/errors/vision",
        detail=str(exc) or "Vision extractor could not parse the document.",
        request=request,
    )


async def _handle_file_not_found(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, FileNotFoundError)  # noqa: S101
    return _problem_response(
        status=404,
        title="File not found",
        type_uri="https://pre-autorizacion.dev/errors/file-not-found",
        detail=str(exc) or "The requested file does not exist.",
        request=request,
    )


async def _handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)  # noqa: S101
    return _problem_response(
        status=exc.status_code,
        title=exc.detail if isinstance(exc.detail, str) else "HTTP error",
        type_uri="about:blank",
        detail=exc.detail if isinstance(exc.detail, str) else "An HTTP error occurred.",
        request=request,
    )


async def _handle_request_validation(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)  # noqa: S101
    return _problem_response(
        status=422,
        title="Invalid request payload",
        type_uri="https://pre-autorizacion.dev/errors/request-validation",
        detail="One or more fields failed validation.",
        request=request,
        extra={"errors": exc.errors()},
    )


async def _handle_unhandled(request: Request, exc: Exception) -> JSONResponse:
    _logger.exception("unhandled.error", error_type=type(exc).__name__)
    return _problem_response(
        status=500,
        title="Internal server error",
        type_uri="about:blank",
        detail="An unexpected error occurred.",
        request=request,
    )


def register_error_handlers(app: FastAPI) -> None:
    """Registra todos los handlers en el orden correcto (más específico primero)."""
    # Specific integration errors antes de DomainError genérica.
    app.add_exception_handler(NotionError, _handle_notion_error)
    app.add_exception_handler(VisionExtractionError, _handle_vision_error)
    # Base domain.
    app.add_exception_handler(IntegrationError, _handle_domain_error)
    app.add_exception_handler(DomainError, _handle_domain_error)
    # Sistema y framework.
    app.add_exception_handler(FileNotFoundError, _handle_file_not_found)
    app.add_exception_handler(RequestValidationError, _handle_request_validation)
    app.add_exception_handler(HTTPException, _handle_http_exception)
    # Catch-all final.
    app.add_exception_handler(Exception, _handle_unhandled)


__all__ = ["PROBLEM_JSON", "register_error_handlers"]
