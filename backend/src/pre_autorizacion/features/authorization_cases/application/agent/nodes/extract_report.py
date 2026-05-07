"""Nodo `extract_report` — primer nodo del grafo (PRD §3.1.3).

Llama al `MedicalReportExtractor` (port high-level) que internamente delega
en `LLMProvider` (texto) o `VisionExtractor` (PDF). Persiste el resultado en
el state para que `match_procedure` y `make_decision` lo consuman.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pre_autorizacion.features.authorization_cases.application.agent._trace import (
    trace_node,
)

if TYPE_CHECKING:
    from pre_autorizacion.features.authorization_cases.application.agent.state import (
        AgentGraphState,
    )


async def extract_report_node(state: AgentGraphState) -> dict[str, Any]:
    """Extrae entidades clínicas del informe usando el `MedicalReportExtractor`.

    El extractor concreto (texto vs PDF) lo eligió el orchestrator antes de
    inyectarlo en el state — este nodo es agnóstico al formato.
    """
    extractor = state["extractor"]
    report = state["report"]

    async with trace_node(state, node="extract_report") as set_detail:
        extracted = await extractor.extract(report)
        set_detail(
            f"procedure={extracted.extracted_procedure_name!r} "
            f"confidence={extracted.confidence:.2f}"
        )

    return {
        "extracted": extracted,
        "extraction_confidence": extracted.confidence,
    }


__all__ = ["extract_report_node"]
