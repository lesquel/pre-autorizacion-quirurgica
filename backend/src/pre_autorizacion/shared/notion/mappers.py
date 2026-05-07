"""Helpers genéricos para leer y escribir propiedades de Notion.

La API de Notion devuelve cada propiedad como un dict envuelto en su tipo
(`{"type": "title", "title": [...]}`, etc.). Estos helpers normalizan ese
shape a tipos primitivos del dominio (str, float, date, ...), y los inversos
construyen el shape correcto para `pages.create` / `pages.update`.

Mantener estos helpers tontos y puros: el mapeo entity-specific (entidad ↔
properties) vive en `entities.py`. Acá vivimos en el nivel "property type".
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any


# ─── READERS ───────────────────────────────────────────────────────────────


def read_title(prop: dict[str, Any] | None) -> str:
    """Extrae el plain_text concatenado de una property tipo `title`."""
    if not prop:
        return ""
    parts = prop.get("title", []) or []
    return "".join(p.get("plain_text", "") for p in parts)


def read_rich_text(prop: dict[str, Any] | None) -> str:
    """Extrae el plain_text concatenado de una property tipo `rich_text`."""
    if not prop:
        return ""
    parts = prop.get("rich_text", []) or []
    return "".join(p.get("plain_text", "") for p in parts)


def read_number(prop: dict[str, Any] | None) -> float | None:
    if not prop:
        return None
    n = prop.get("number")
    if n is None:
        return None
    return float(n)


def read_select(prop: dict[str, Any] | None) -> str | None:
    if not prop:
        return None
    sel = prop.get("select")
    if not sel:
        return None
    name = sel.get("name")
    return name if isinstance(name, str) else None


def read_multi_select(prop: dict[str, Any] | None) -> tuple[str, ...]:
    if not prop:
        return ()
    items = prop.get("multi_select", []) or []
    return tuple(i["name"] for i in items if isinstance(i.get("name"), str))


def read_checkbox(prop: dict[str, Any] | None) -> bool:
    if not prop:
        return False
    return bool(prop.get("checkbox", False))


def read_date(prop: dict[str, Any] | None) -> date | None:
    """Lee una property tipo `date` y devuelve el `start` como `date`."""
    if not prop:
        return None
    inner = prop.get("date")
    if not inner:
        return None
    start = inner.get("start")
    if not isinstance(start, str):
        return None
    # Notion devuelve `'YYYY-MM-DD'` o `'YYYY-MM-DDTHH:MM:SS...'` según se
    # haya configurado include_time. Usamos `datetime.fromisoformat` y nos
    # quedamos con la parte de fecha.
    try:
        return datetime.fromisoformat(start.replace("Z", "+00:00")).date()
    except ValueError:
        # fallback: algunos shapes de Notion usan solo 'YYYY-MM-DD'
        return date.fromisoformat(start[:10])


def read_datetime(prop: dict[str, Any] | None) -> datetime | None:
    """Lee una property tipo `date` con tiempo y devuelve `datetime`."""
    if not prop:
        return None
    inner = prop.get("date")
    if not inner:
        return None
    start = inner.get("start")
    if not isinstance(start, str):
        return None
    try:
        return datetime.fromisoformat(start.replace("Z", "+00:00"))
    except ValueError:
        return None


def read_relation(prop: dict[str, Any] | None) -> tuple[str, ...]:
    """Lee una property `relation` y devuelve los page_ids relacionados."""
    if not prop:
        return ()
    rels = prop.get("relation", []) or []
    return tuple(r["id"] for r in rels if isinstance(r.get("id"), str))


def read_email(prop: dict[str, Any] | None) -> str | None:
    if not prop:
        return None
    email = prop.get("email")
    return email if isinstance(email, str) and email else None


def read_people(prop: dict[str, Any] | None) -> tuple[str, ...]:
    """Lee una property `people` y devuelve los user_ids."""
    if not prop:
        return ()
    people = prop.get("people", []) or []
    return tuple(p["id"] for p in people if isinstance(p.get("id"), str))


# ─── WRITERS ───────────────────────────────────────────────────────────────


def make_title(value: str) -> dict[str, Any]:
    return {"title": [{"type": "text", "text": {"content": value}}]}


def make_rich_text(value: str) -> dict[str, Any]:
    if not value:
        return {"rich_text": []}
    return {"rich_text": [{"type": "text", "text": {"content": value}}]}


def make_number(value: float | int | None) -> dict[str, Any]:
    return {"number": float(value) if value is not None else None}


def make_select(value: str | None) -> dict[str, Any]:
    if value is None:
        return {"select": None}
    return {"select": {"name": value}}


def make_multi_select(values: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {"multi_select": [{"name": v} for v in values]}


def make_checkbox(value: bool) -> dict[str, Any]:
    return {"checkbox": bool(value)}


def make_date(value: date | None) -> dict[str, Any]:
    if value is None:
        return {"date": None}
    return {"date": {"start": value.isoformat()}}


def make_datetime(value: datetime | None) -> dict[str, Any]:
    if value is None:
        return {"date": None}
    return {"date": {"start": value.isoformat()}}


def make_relation(page_ids: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {"relation": [{"id": pid} for pid in page_ids]}


def make_email(value: str | None) -> dict[str, Any]:
    return {"email": value}


def make_people(user_ids: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {"people": [{"id": uid} for uid in user_ids]}


__all__ = [
    "make_checkbox",
    "make_date",
    "make_datetime",
    "make_email",
    "make_multi_select",
    "make_number",
    "make_people",
    "make_relation",
    "make_rich_text",
    "make_select",
    "make_title",
    "read_checkbox",
    "read_date",
    "read_datetime",
    "read_email",
    "read_multi_select",
    "read_number",
    "read_people",
    "read_relation",
    "read_rich_text",
    "read_select",
    "read_title",
]
