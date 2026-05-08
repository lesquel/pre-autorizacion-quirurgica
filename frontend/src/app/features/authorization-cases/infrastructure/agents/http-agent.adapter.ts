import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Subject, firstValueFrom as firstPromise, type Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { caseFromDto } from '../../../../shared/api/mappers';
import type { components } from '../../../../shared/api/schema';
import {
  AgentOrchestrator,
  type AgentEvent,
  type AgentRunRequest,
} from '../../domain/ports/agent-orchestrator.port';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import type { TraceStep } from '../../domain/value-objects/trace-step';
import { CaseRepository } from '../../domain/ports/case-repository.port';

type CaseDto = components['schemas']['CaseOut'];

@Injectable({ providedIn: 'root' })
export class HttpAgentAdapter extends AgentOrchestrator {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  // Inyectamos el port abstracto — el contrato `loadAll()` está en el port,
  // así que no necesitamos castear a `HttpCaseRepository` (eso rompía LSP
  // y crasheaba si en tests bindeábamos el InMemoryCaseRepository).
  private readonly cases = inject(CaseRepository);

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
      const caseDto = request.file
        ? await this.uploadPdf(request)
        : await this.submitText(request);

      const fullCase: AuthorizationCase = caseFromDto(caseDto);
      // Pre-seed the local repo so list views see the new case immediately.
      this.cases.create(fullCase);

      // Reusamos el repo: ya parsea el wrapper `{ trace }` y blinda el
      // edge case donde el backend devuelva `null/undefined` (defensive
      // `?? []`). Antes este path tenía su propio `http.get` con el mismo
      // mapeo, lo que dejó el fix de defensa en un solo lado.
      const traceReadonly = await this.cases.loadTrace(fullCase.id);
      const trace: TraceStep[] = [...traceReadonly];

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

  private async submitText(request: AgentRunRequest): Promise<CaseDto> {
    // JSON body → Pydantic schema con `alias_generator=to_camel` y
    // `populate_by_name=True`. Acepta camelCase tal como sale acá; el
    // OpenAPI generated schema también es camelCase, así que mantenemos
    // coherencia con `components['schemas']['CaseIn']`.
    const body = {
      report: {
        patientId: request.report.patientId,
        // Backend ReportFormat StrEnum es lowercase ('text' | 'pdf').
        // Anteriormente acá había 'TEXT' hardcodeado → 422 validation error.
        format: 'text',
        content: request.report.content,
        procedureSolicitedHint: request.report.procedureSolicitedHint,
        diagnosis: request.report.diagnosis,
        attendingDoctor: request.report.attendingDoctor,
      },
      policyNumber: request.policyNumber,
      scenarioKey: request.scenarioKey,
    };
    return await firstPromise(
      this.http.post<CaseDto>(`${this.base}/api/v1/cases`, body),
    );
  }

  private async uploadPdf(request: AgentRunRequest): Promise<CaseDto> {
    // multipart/form-data → FastAPI `Form(...)` — los nombres de field son
    // los identificadores Python del endpoint y por convención van en
    // snake_case (no pasan por `alias_generator`). Por eso este método
    // usa snake_case mientras `submitText` (JSON Pydantic) usa camelCase.
    const fd = new FormData();
    fd.set('policy_number', request.policyNumber);
    fd.set('patient_id', request.report.patientId);
    if (request.report.procedureSolicitedHint) {
      fd.set('procedure_solicited_hint', request.report.procedureSolicitedHint);
    }
    if (request.report.diagnosis) {
      fd.set('diagnosis', request.report.diagnosis);
    }
    if (request.report.attendingDoctor) {
      fd.set('attending_doctor', request.report.attendingDoctor);
    }
    if (request.scenarioKey) {
      fd.set('scenario_key', request.scenarioKey);
    }
    fd.set('file', request.file as Blob);
    return await firstPromise(
      this.http.post<CaseDto>(`${this.base}/api/v1/cases/upload`, fd),
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
