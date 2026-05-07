"""FileStorage — port que abstrae la persistencia de archivos binarios.

PRD §4.1.1 — Storage de archivos: filesystem local del servidor (`var/uploads/...`)
detrás de este port en v1. Migración a S3 / MinIO prevista post-v1 sin tocar el
dominio.

Casos de uso:
- Persistir el PDF original que sube el hospital (PRD §4.1.3, paso 2).
- Guardar artefactos grandes de traza del agente (debug post-mortem).
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class FileStorage(ABC):
    """Port para persistencia de archivos (PDFs adjuntos, traces grandes, etc.).

    Adapter v1: `LocalFsAdapter` (filesystem local del servidor).
    Adapters futuros: `S3Adapter`, `MinIOAdapter` — sin tocar dominio.

    Los adapters DEBEN sanitizar `key` para prevenir path traversal (PRD §4.4.3 /
    §5.2 "Path traversal / file enumeration"). El dominio asume que el adapter
    ya hizo esa validación.
    """

    @abstractmethod
    async def save(
        self,
        key: str,
        content: bytes,
        *,
        content_type: str | None = None,
    ) -> str:
        """Guarda `content` bajo `key` y devuelve un identificador estable.

        Args:
            key: clave lógica (ej: `cases/<case_id>/informe.pdf`). El adapter
                la mapea al backend físico (path en disco, S3 key, etc.).
            content: bytes del archivo.
            content_type: MIME opcional, útil para adapters cloud que lo persisten
                como metadato. El filesystem local lo ignora.

        Returns:
            Identificador estable del archivo guardado (path absoluto, URL, etc.).
            Usable luego en `read`, `delete`, `exists`.
        """

    @abstractmethod
    async def read(self, key: str) -> bytes:
        """Lee y devuelve los bytes del archivo identificado por `key`.

        Args:
            key: clave lógica usada en `save`.

        Returns:
            Contenido binario del archivo.

        Raises:
            FileNotFoundError: si `key` no existe en el backend.
        """

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Elimina el archivo identificado por `key`.

        Idempotente: NO debe fallar si la clave no existe (silencioso).
        """

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Indica si existe un archivo bajo `key`."""
