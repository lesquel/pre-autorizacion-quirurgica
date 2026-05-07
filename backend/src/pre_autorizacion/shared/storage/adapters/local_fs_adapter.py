"""LocalFsAdapter — adapter de `FileStorage` sobre el filesystem local.

PRD §4.1.1 / §4.4.3: en v1 los PDFs viven en `var/uploads/<case_id>/<filename>`
del filesystem del servidor. Este adapter materializa ese contrato detrás del
port `FileStorage` para que la migración a S3 / MinIO post-v1 sea swap puro
sin tocar dominio.

Reglas de seguridad (PRD §5.2 — path traversal / file enumeration):
- `key` NO puede contener `..`, ni empezar con `/` (path absoluto), ni
  contener bytes nulos. Las violaciones levantan `ValueError`.
- Si `key` es vacío, el adapter genera un UUID4 hex como nombre.
- La ruta resuelta (`base_dir / key`) DEBE quedar dentro de `base_dir` —
  re-validamos con `resolve()` para defendernos de symlinks fuera del root.
- El I/O usa `asyncio.to_thread` para no bloquear el event loop con la
  syscall `write_bytes` / `read_bytes`.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from uuid import uuid4

from pre_autorizacion.shared.storage.ports.file_storage import FileStorage


class LocalFsAdapter(FileStorage):
    """Adapter v1 de `FileStorage` que persiste en el filesystem local.

    Args:
        base_dir: directorio raíz donde se guardan TODOS los archivos.
                  El adapter crea el directorio si no existe.
    """

    def __init__(self, base_dir: Path) -> None:
        self._base_dir = base_dir.resolve()
        self._base_dir.mkdir(parents=True, exist_ok=True)

    # ─── API pública (port FileStorage) ─────────────────────────────────

    async def save(
        self,
        key: str,
        content: bytes,
        *,
        content_type: str | None = None,
    ) -> str:
        # `content_type` se ignora en local (no hay metadato de MIME en disco).
        # Se mantiene en la firma por contrato del port.
        del content_type
        sanitized = self._sanitize_key(key)
        target = self._resolve(sanitized)
        target.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(target.write_bytes, content)
        return sanitized

    async def read(self, key: str) -> bytes:
        sanitized = self._sanitize_key(key)
        target = self._resolve(sanitized)
        if not target.is_file():
            raise FileNotFoundError(f"No such file in storage: {sanitized!r}")
        return await asyncio.to_thread(target.read_bytes)

    async def delete(self, key: str) -> None:
        # Idempotente: borramos solo si existe; no levantamos si no existe.
        try:
            sanitized = self._sanitize_key(key)
        except ValueError:
            # Si la key no es válida tampoco existe — silencioso.
            return
        target = self._resolve(sanitized)
        if target.is_file():
            await asyncio.to_thread(target.unlink)

    async def exists(self, key: str) -> bool:
        try:
            sanitized = self._sanitize_key(key)
        except ValueError:
            return False
        target = self._resolve(sanitized)
        return target.is_file()

    # ─── Helpers privados ───────────────────────────────────────────────

    @staticmethod
    def _sanitize_key(key: str) -> str:
        """Valida y normaliza la `key` antes de usarla en el filesystem.

        Genera un UUID si la key es vacía. Levanta `ValueError` si la key
        contiene componentes peligrosos.
        """
        if not key:
            return uuid4().hex
        # Bloqueo defensivo: bytes nulos pueden truncar la ruta en algunas
        # syscalls.
        if "\x00" in key:
            raise ValueError("File key must not contain null bytes.")
        # Path traversal: cualquier componente `..` o ruta absoluta queda fuera.
        if key.startswith(("/", "\\")):
            raise ValueError("File key must be a relative path.")
        parts = Path(key).parts
        for part in parts:
            if part in {"..", ""}:
                raise ValueError(f"File key {key!r} contains forbidden component.")
        return key

    def _resolve(self, key: str) -> Path:
        """Resuelve `key` contra `base_dir` y verifica que NO escape del root.

        Defensa adicional contra symlinks que apunten fuera del root: aunque
        el `_sanitize_key` ya rechaza `..`, un symlink dentro de `base_dir`
        podría apuntar a `/etc`. Re-resolvemos y comparamos prefijo.
        """
        candidate = (self._base_dir / key).resolve()
        try:
            candidate.relative_to(self._base_dir)
        except ValueError as exc:
            raise ValueError(f"File key {key!r} resolves outside base_dir.") from exc
        return candidate
