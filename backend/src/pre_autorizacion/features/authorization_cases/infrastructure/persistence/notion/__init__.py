"""Adapter Notion del slice authorization_cases."""

from pre_autorizacion.features.authorization_cases.infrastructure.persistence.notion.notion_case import (
    NotionCaseRepository,
)

__all__ = ["NotionCaseRepository"]
