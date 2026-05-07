import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject, firstValueFrom, type Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { caseFromDto, traceStepFromDto } from '../../../../shared/api/mappers';
import type { components } from '../../../../shared/api/schema';
import {
  AgentOrchestrator,
  type AgentEvent,
  type AgentRunRequest,
} from '../../domain/ports/agent-orchestrator.port';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import type { TraceStep } from '../../domain/value-objects/trace-step';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import { HttpCaseRepository } from '../repos/http-case.repository';

type CaseDto = components['schemas']['CaseOut'];

@Injectable({ providedIn: 'root' })
export class HttpAgentAdapter extends AgentOrchestrator {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly cases = inject(CaseRepository) as HttpCaseRepository;

  override run(request: AgentRunRequest): Observable<AgentEvent> {
    const subject = new Subject<AgentEvent>();
    void this.execute(request, subject);
    return subject.asObservable();
  }

  private async execute(
    request: AgentRunRequest,
    out: Subject<AgentEvent>,
  ): Promise<void> {
    try {
      const body = {
        report: {
          patientId: request.report.patientId,
          format: request.report.format === 'pdf' ? 'PDF' : 'TEXT',
          content: request.report.content,
          procedureSolicitedHint: request.report.procedureSolicitedHint,
          diagnosis: request.report.diagnosis,
          attendingDoctor: request.report.attendingDoctor,
        },
        policyNumber: request.policyNumber,
        scenarioKey: request.scenarioKey,
      };
      const caseDto = await firstValueFrom(
        this.http.post<CaseDto>(`${this.base}/api/v1/cases`, body),
      );

      const fullCase: AuthorizationCase = caseFromDto(caseDto);
      // Pre-seed the local repo so list views see the new case immediately.
      this.cases.create(fullCase);

      const traceBody = await firstValueFrom(
        this.http.get<{ trace: unknown[] }>(
          `${this.base}/api/v1/cases/${encodeURIComponent(fullCase.id)}/trace`,
        ),
      );
      const trace: TraceStep[] = traceBody.trace.map((s) =>
        traceStepFromDto(s as never),
      );

      // Stream steps with timing. First step carries the caseId sentinel.
      for (let i = 0; i < trace.length; i++) {
        const original = trace[i];
        const step: TraceStep =
          i === 0
            ? {
                ...original,
                detail: `caseId:${fullCase.id}${
                  original.detail ? ' ' + original.detail : ''
                }`,
              }
            : original;
        out.next({ kind: 'step', step });
        await delay(environment.agentStepDelayMs);
      }

      // Update the local case with the final trace + decision so live-run
      // viewers see the persisted version.
      this.cases.update(fullCase.id, {
        agentTrace: trace,
        decision: fullCase.decision,
        status: fullCase.status,
        decidedAt: fullCase.decidedAt,
      });

      if (fullCase.decision) {
        out.next({ kind: 'done', decision: fullCase.decision, trace });
      } else {
        out.next({
          kind: 'error',
          error: 'Backend returned no decision',
          trace,
        });
      }
      out.complete();
      // Refresh the case list so cross-role views (auditor tray) see it.
      this.cases.loadAll().catch(() => undefined);
    } catch (err) {
      out.next({
        kind: 'error',
        error: err instanceof Error ? err.message : String(err),
        trace: [],
      });
      out.complete();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
