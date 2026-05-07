import type { components } from '../schema';
import type { AuthorizationCase } from '../../../features/authorization-cases/domain/entities';
import type { AgentDecision } from '../../../features/authorization-cases/domain/value-objects';
import type { TraceStep } from '../../../features/authorization-cases/domain/value-objects';

type CaseDto = components['schemas']['CaseOut'];
type DecisionDto = components['schemas']['DecisionOut'];
type TraceStepDto = components['schemas']['TraceStepOut'];

function decisionFromDto(d: DecisionDto): AgentDecision {
  return {
    outcome: d.outcome,
    rationale: d.rationale,
    confidence: d.confidence,
    decidedBy: d.decidedBy,
    evidence: (d.evidence ?? []).map((e) => ({
      source: e.source,
      field: e.field,
      quote: e.quote,
    })),
    missingDocs: d.missingDocs ?? [],
    escalationReason: d.escalationReason ?? null,
    modelUsed: d.modelUsed ?? undefined,
  };
}

export function traceStepFromDto(s: TraceStepDto): TraceStep {
  return {
    node: s.node,
    timestamp: s.timestamp,
    state: s.state,
    durationMs: s.durationMs ?? undefined,
    modelUsed: s.modelUsed ?? undefined,
    tokensIn: s.tokensIn ?? undefined,
    tokensOut: s.tokensOut ?? undefined,
    detail: s.detail ?? undefined,
    error: s.error ?? undefined,
  };
}

export function caseFromDto(dto: CaseDto): AuthorizationCase {
  return {
    id: dto.id,
    status: dto.status,
    reportId: dto.reportId,
    policyNumber: dto.policyNumber,
    decision: dto.decision ? decisionFromDto(dto.decision) : undefined,
    createdAt: dto.createdAt,
    decidedAt: dto.decidedAt ?? undefined,
    agentTrace: [], // Filled separately by /trace endpoint
  };
}
