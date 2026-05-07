/**
 * Metadata de los 7 nodos del LangGraph (porteado de `preatuomatizacion/agent.js`).
 *
 * El `id` coincide con `TraceStep.node` para poder cruzar metadata ↔ traza
 * en la UI sin lookups adicionales.
 */
export interface AgentNodeMeta {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly model?: string;
}

export const AGENT_NODES: readonly AgentNodeMeta[] = [
  {
    id: 'extract_report',
    label: 'Extracción del informe',
    description:
      'Extracción estructurada del informe (texto plano o PDF vía Vision).',
    model: 'deepseek-chat / gemini-2.5-flash',
  },
  {
    id: 'match_procedure',
    label: 'Matching de procedimiento CIE-10',
    description:
      'Resolución del código CIE-10 propuesto contra el catálogo (rule + embeddings).',
    model: 'rule + embeddings',
  },
  {
    id: 'load_policy_coverage',
    label: 'Lectura de cobertura desde Notion',
    description: 'Carga de la fila póliza × procedimiento desde Notion.',
    model: 'notion_api',
  },
  {
    id: 'check_waiting_period',
    label: 'Validación de carencia',
    description: 'Cálculo determinístico de días transcurridos vs. carencia configurada.',
    model: 'deterministic',
  },
  {
    id: 'check_required_docs',
    label: 'Verificación de documentos requeridos',
    description: 'Diff entre documentos adjuntos y requeridos por la cobertura.',
    model: 'deterministic',
  },
  {
    id: 'make_decision',
    label: 'Decisión final (structured output)',
    description:
      'Síntesis de la decisión auditable (outcome + rationale + evidence).',
    model: 'deepseek-chat',
  },
  {
    id: 'persist_case',
    label: 'Persistencia del caso',
    description: 'Persistencia del caso y traza en Notion + filesystem.',
    model: 'notion_api + filesystem',
  },
] as const;
