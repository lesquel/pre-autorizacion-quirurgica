"""PII hashing helper para defense-in-depth en logs.

ATENCIÓN: NO sustituye compliance HIPAA / Habeas Data para PHI.

- Para campos de **alta entropía** (texto libre, rationale clínico) preserva
  privacidad razonablemente: la inversa requiere conocer ya el contenido.
- Para campos de **baja entropía** (códigos CIE-10 con ~70K valores, enums,
  nombres de procedimientos de catálogo cerrado) es trivialmente reversible
  vía rainbow table — un atacante con acceso a logs y al catálogo CIE-10
  reconstruye el código en segundos. En esos casos OMITIR del log o usar
  HMAC con secret persistente server-side (TODO arquitectónico).

Uso correcto:
    >>> from pre_autorizacion.shared.logging import hash_pii
    >>> _logger.info("event", rationale_hash=hash_pii(rationale))   # OK
    >>> _logger.info("event", procedure_code_hash=hash_pii(code))   # ANTI-PATTERN
"""

from __future__ import annotations

import hashlib
from typing import Final

# 8 chars de SHA-256 → ~32 bits de entropía: alcanza para correlacionar
# observaciones del mismo dato sin reconstruirlo (cuando el dato tiene
# entropía suficiente, ver caveat arriba).
PII_HASH_LEN: Final[int] = 8


def hash_pii(value: str | None) -> str | None:
    """SHA-256 truncado a 8 chars. Solo defense-in-depth contra `grep` casual.

    Ver módulo docstring para cuándo es seguro y cuándo NO usar.
    """
    if value is None:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:PII_HASH_LEN]


__all__ = ["PII_HASH_LEN", "hash_pii"]
