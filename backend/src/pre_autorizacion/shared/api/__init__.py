"""Shared API utilities — middlewares, error handlers, dependencies."""

from pre_autorizacion.shared.api.error_handlers import register_error_handlers
from pre_autorizacion.shared.api.middleware import (
    REQUEST_ID_HEADER,
    LoggingMiddleware,
    RequestIdMiddleware,
)

__all__ = [
    "REQUEST_ID_HEADER",
    "LoggingMiddleware",
    "RequestIdMiddleware",
    "register_error_handlers",
]
