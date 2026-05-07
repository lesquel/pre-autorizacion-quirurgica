"""Configuración de structlog según el environment.

- `development` → ConsoleRenderer (legible en terminal con colores).
- `staging`/`production` → JSONRenderer (parseable por log shippers).
"""

from __future__ import annotations

import logging
import sys
from typing import Literal

import structlog


def configure_logging(env: Literal["development", "staging", "production"]) -> None:
    """Configura structlog + stdlib logging para FastAPI/Uvicorn."""
    processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    if env == "development":
        processors.append(structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty()))
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )

    # Eleva uvicorn.access a WARNING — el LoggingMiddleware ya emite la línea.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


__all__ = ["configure_logging"]
