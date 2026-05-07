"""Middlewares globales: request_id + logging estructurado.

`RequestIdMiddleware` propaga / genera el header `X-Request-Id` y lo expone
en `request.state.request_id`. También lo bindea en el contextvar de
structlog para que cualquier log emitido durante el request lo incluya
sin tener que pasar el id manualmente.

`LoggingMiddleware` emite UN log estructurado por request con duración,
método, path y status code.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

REQUEST_ID_HEADER = "X-Request-Id"

_logger = structlog.get_logger("api")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Genera / preserva `X-Request-Id` y lo bindea al contextvar."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming or uuid.uuid4().hex
        request.state.request_id = request_id

        # Limpia y bindea contextvars de structlog para este request.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.clear_contextvars()

        response.headers[REQUEST_ID_HEADER] = request_id
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Loguea cada request en una sola línea estructurada."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = int((time.perf_counter() - start) * 1000)
            _logger.exception(
                "request.error",
                method=request.method,
                path=request.url.path,
                duration_ms=duration_ms,
            )
            raise

        duration_ms = int((time.perf_counter() - start) * 1000)
        _logger.info(
            "request.completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response


__all__ = ["REQUEST_ID_HEADER", "LoggingMiddleware", "RequestIdMiddleware"]
