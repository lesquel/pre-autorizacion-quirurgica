"""Nodo `match_procedure` — segundo nodo del grafo (PRD §3.1.3).

Matchea el procedimiento extraído por el LLM contra el `Coverage.procedure_code`
ya seleccionado por el use case. En MVP el matching es determinístico:

1. Si el `extracted_procedure_code` es exactamente igual al `coverage.procedure_code`
   → score 1.0.
2. Si no, fuzzy match por nombre con `difflib.SequenceMatcher.ratio`.

`procedure_match_score < procedure_match_threshold` (default 0.85) marca el
`procedure_covered = False` así el nodo `persist_case` final puede escalar con
`LOW_CONFIDENCE_PROCEDURE_MATCH`.

TODO MVP+: reemplazar fuzzy matching por embeddings (vector search) cuando
crezca el catálogo de procedimientos.
"""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import TYPE_CHECKING, Any

from pre_autorizacion.features.authorization_cases.application.agent._trace import (
    trace_node,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


# Threshold por defecto para considerar un match aceptable. Idéntico al de
# `Settings.procedure_match_threshold`; lo duplicamos acá para que el nodo
# sea puro y no dependa de leer Settings global. El orchestrator puede pasarlo
# por DI cuando lo necesitemos (TODO MVP+).
_DEFAULT_MATCH_THRESHOLD: float = 0.85


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _name_similarity(extracted_name: str | None, coverage_code: str) -> float:
    """Ratio de similaridad entre el nombre extraído y el código de cobertura.

    En el MVP el catálogo Notion usa códigos auto-explicativos (`COL-LAP`,
    `LAS-MIO`) — comparar contra el código suele bastar para una demo.
    Cuando exista un catálogo de procedimientos con `name + code`, el match
    se hace sobre el `name`.
    """
    a = _normalize(extracted_name)
    b = _normalize(coverage_code)
    if not a or not b:
        return 0.0
    return SequenceMatcher(a=a, b=b).ratio()


async def match_procedure_node(state: AgentGraphState) -> dict[str, Any]:
    """Calcula el `procedure_match_score` y derivado `procedure_covered`."""
    coverage = state["coverage"]
    extracted = state.get("extracted")

    async with trace_node(state, node="match_procedure") as set_detail:
        if extracted is None:
            # Sin extracción no hay forma de matchear — caemos en False.
            score = 0.0
            set_detail("no extraction available")
        elif (
            extracted.extracted_procedure_code
            and _normalize(extracted.extracted_procedure_code)
            == _normalize(coverage.procedure_code)
        ):
            score = 1.0
            set_detail(f"exact code match {coverage.procedure_code!r}")
        else:
            score = _name_similarity(
                extracted.extracted_procedure_name,
                coverage.procedure_code,
            )
            set_detail(
                f"fuzzy similarity={score:.2f} vs {coverage.procedure_code!r}"
            )

    procedure_covered = bool(coverage.covered) and score >= _DEFAULT_MATCH_THRESHOLD

    return {
        "procedure_match_score": score,
        "procedure_covered": procedure_covered,
    }


__all__ = ["match_procedure_node"]
