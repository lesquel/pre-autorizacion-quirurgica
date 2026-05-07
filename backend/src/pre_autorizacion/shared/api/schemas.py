"""Base Pydantic schemas — convención camelCase para el contrato JSON.

Todos los DTOs de la capa API heredan de `CamelModel` para alinear el
contrato JSON con el frontend Angular (que usa camelCase).

`populate_by_name=True` permite construir el modelo tanto desde snake_case
(en código Python) como desde camelCase (en JSON entrante).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base de todos los schemas de API. Aliases camelCase, populate_by_name."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


__all__ = ["CamelModel"]
