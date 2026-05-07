"""Ports compartidos del subsistema de almacenamiento de archivos.

Re-exporta `FileStorage`. El adapter v1 es `LocalFsAdapter` y vive en
`shared/storage/adapters/`.
"""

from pre_autorizacion.shared.storage.ports.file_storage import FileStorage

__all__ = ["FileStorage"]
