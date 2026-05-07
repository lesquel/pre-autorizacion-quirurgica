import { inject, Injectable } from '@angular/core';

import { CaseRepository } from '../../domain/ports/case-repository.port';
import type { AgentDecision } from '../../domain/value-objects/agent-decision';

/**
 * ResolveCaseInput — payload del cierre manual por auditor.
 *
 * - `caseId`     : id del caso escalado.
 * - `outcome`    : 'APPROVED' o 'REJECTED' — decisión del auditor.
 *                  En el dominio se materializa como `Outcome: 'DECIDED'` con
 *                  el rationale y la flag `decidedBy: 'auditor'`. El detalle
 *                  approved-vs-rejected vive dentro del rationale + UI.
 * - `message`    : mensaje breve para el hospital (ej. "aprobado con copago $80").
 * - `reasoning`  : explicación clínica/contractual extensa — auditable.
 */
export interface ResolveCaseInput {
  readonly caseId: string;
  readonly outcome: 'APPROVED' | 'REJECTED';
  readonly message: string;
  readonly reasoning: string;
}

/**
 * ResolveCaseUseCase — el auditor cierra un caso escalado.
 *
 * El estado pasa a `DECIDIDO` y se sobrescribe `decision` con un AgentDecision
 * sintético: `outcome: 'DECIDED'`, `decidedBy: 'auditor'`, confianza 1.0
 * (decisión humana = certeza máxima en el dominio).
 */
@Injectable({ providedIn: 'root' })
export class ResolveCaseUseCase {
  private readonly repository = inject(CaseRepository);

  execute(input: ResolveCaseInput): void {
    const decision: AgentDecision = {
      outcome: 'DECIDED',
      rationale: input.reasoning,
      confidence: 1.0,
      evidence: [],
      missingDocs: [],
      escalationReason: null,
      decidedBy: 'auditor',
    };

    this.repository.update(input.caseId, {
      status: 'DECIDIDO',
      decision,
      decidedAt: new Date().toISOString(),
    });
  }
}
