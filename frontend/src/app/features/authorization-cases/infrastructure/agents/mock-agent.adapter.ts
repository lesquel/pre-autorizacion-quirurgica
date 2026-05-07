import { Injectable } from '@angular/core';
import {
  concat,
  concatMap,
  defer,
  from,
  Observable,
  of,
  timer,
} from 'rxjs';
import { map } from 'rxjs/operators';

import type { MedicalReport } from '../../domain/entities/medical-report';
import type {
  AgentEvent,
  AgentRunRequest,
} from '../../domain/ports/agent-orchestrator.port';
import { AgentOrchestrator } from '../../domain/ports/agent-orchestrator.port';
import type { TraceStep } from '../../domain/value-objects/trace-step';

import { decisionFor, type BuildContext } from './decision';
import { buildScenario, type PlannedStep } from './scenario-builder';

/**
 * Default usado cuando no podemos inferir un escenario y el caller no fuerza uno.
 * Alineado al PRD: el agente nunca auto-rechaza, así que el default seguro
 * en demo es la corrida feliz.
 */
const DEFAULT_SCENARIO = 'APPROVED_AUTO';
const DEFAULT_EVALUATION_DATE = '2026-05-06';

/**
 * MockAgentAdapter — implementación del `AgentOrchestrator` que simula el
 * LangGraph determinísticamente, con timing realista para que la UI se
 * sienta "viva" sin un backend LLM detrás.
 *
 * Patrón de la stream:
 *   foreach paso planificado:
 *     emit { kind: 'step', step: { ..., state: 'running' } }   ← inmediato
 *     wait durationMs                                          ← timer
 *     emit { kind: 'step', step: { ..., state: 'done'|'error', durationMs } }
 *   emit { kind: 'done', decision, trace }   o   { kind: 'error', error, trace }
 *
 * Importante: usamos `concatMap` para garantizar orden estricto. `from(steps)`
 * + `concatMap(step => concat(running$, timer(d), done$))` permite que cada
 * paso se complete antes del siguiente — replicando el flujo serial de un
 * LangGraph nodo-a-nodo.
 */
@Injectable({ providedIn: 'root' })
export class MockAgentAdapter extends AgentOrchestrator {
  override run(request: AgentRunRequest): Observable<AgentEvent> {
    return defer(() => {
      const scenarioKey =
        request.scenarioKey ?? inferScenarioKey(request.report);
      const ctx = buildContext(request, scenarioKey);
      const planned = buildScenario(scenarioKey, ctx);
      const accumulated: TraceStep[] = [];

      const stepEvents$ = from(planned).pipe(
        concatMap((planStep) => emitPlannedStep(planStep, accumulated)),
      );

      const terminal$ = defer<Observable<AgentEvent>>(() => {
        // Si algún paso fue `error`, la corrida termina en `error`.
        const failed = accumulated.find((s) => s.state === 'error');
        if (failed) {
          const errorEvent: AgentEvent = {
            kind: 'error',
            error: failed.error ?? 'unknown_error',
            trace: [...accumulated],
          };
          return of(errorEvent);
        }
        const decision = decisionFor(scenarioKey, ctx);
        const doneEvent: AgentEvent = {
          kind: 'done',
          decision,
          trace: [...accumulated],
        };
        return of(doneEvent);
      });

      return concat(stepEvents$, terminal$);
    });
  }
}

/**
 * Emite los dos eventos de un paso (`running` → wait → `done`/`error`)
 * y acumula el step terminal en `accumulated` para construir la traza final.
 */
function emitPlannedStep(
  plan: PlannedStep,
  accumulated: TraceStep[],
): Observable<AgentEvent> {
  const startedAt = new Date().toISOString();
  const runningStep: TraceStep = {
    node: plan.node,
    timestamp: startedAt,
    state: 'running',
    modelUsed: plan.modelUsed,
  };
  const runningEvent: AgentEvent = { kind: 'step', step: runningStep };

  const completed$ = timer(plan.durationMs).pipe(
    map<number, AgentEvent>(() => {
      const finalStep: TraceStep = {
        node: plan.node,
        timestamp: new Date().toISOString(),
        state: plan.state,
        durationMs: plan.durationMs,
        modelUsed: plan.modelUsed,
        tokensIn: plan.tokensIn,
        tokensOut: plan.tokensOut,
        detail: plan.detail,
        error: plan.error,
      };
      accumulated.push(finalStep);
      return { kind: 'step', step: finalStep };
    }),
  );

  return concat(of(runningEvent), completed$);
}

function buildContext(req: AgentRunRequest, _scenarioKey: string): BuildContext {
  return {
    report: req.report,
    policy: req.policy,
    coverage: req.coverage,
    attachedDocs: extractAttachedDocs(req.report),
    procedureName: req.report.diagnosis ?? req.coverage.procedureCode,
    procedureCode: req.report.procedureSolicitedHint ?? req.coverage.procedureCode,
    evaluationDate: DEFAULT_EVALUATION_DATE,
  };
}

/**
 * Inferencia heurística del escenario a partir del contenido del informe.
 * Sólo se usa cuando el caller no pasó `scenarioKey` explícito.
 *
 * Heurísticas (en orden):
 * 1. `format === 'pdf'` con marcador de archivo escaneado → ESCALATED_PDF_FAIL.
 * 2. `procedureSolicitedHint === '?'` o ausente con texto ambiguo → ESCALATED_LOW_CONF.
 * 3. Texto que menciona "carencia" o "gonartrosis" (caso seed) → ESCALATED_WAITING.
 *    (No detectable de forma robusta sin cruzar póliza × hoy — el caller
 *     debería forzar `scenarioKey` para este escenario.)
 * 4. Diagnóstico que menciona "hiperplasia" o "RTUP" → DOCS_REQUESTED.
 * 5. Default → APPROVED_AUTO.
 *
 * TODO: cuando llegue el LLM backend, esta inferencia desaparece — el agente
 * real decide a partir del contenido + cobertura.
 */
function inferScenarioKey(report: MedicalReport): string {
  if (report.format === 'pdf') {
    // Convención del seed: stub `[archivo.pdf · ...]` indica un escaneado fallido.
    if (report.content.startsWith('[') && /escaneado/i.test(report.content)) {
      return 'ESCALATED_PDF_FAIL';
    }
    if (report.content.startsWith('[')) return 'ESCALATED_PDF_FAIL';
  }

  const text = report.content.toLowerCase();

  // Ambigüedad clínica clásica del prototipo.
  if (
    !report.procedureSolicitedHint ||
    report.procedureSolicitedHint === '?' ||
    /apendicitis.*vs|laparoscop[ií]a exploratoria/i.test(report.content)
  ) {
    if (/abdomen agudo|exploratoria|apendicitis/i.test(report.content)) {
      return 'ESCALATED_LOW_CONF';
    }
  }

  if (/gonartrosis|artroplastia.*rodilla/i.test(text)) {
    return 'ESCALATED_WAITING';
  }

  if (/hiperplasia prost[aá]tica|rtup|n40\.1/i.test(text)) {
    return 'DOCS_REQUESTED';
  }

  return DEFAULT_SCENARIO;
}

/**
 * El dominio aún no modela `attachedDocs` como campo de `MedicalReport`.
 * El prototipo los pasa como ctx aparte; en la UI van a venir de un input
 * separado (ej. un `Case` en construcción). Por ahora devolvemos lista vacía
 * y el caller puede pisar el contexto vía `scenarioKey` para los demos.
 *
 * TODO: cuando el form de hospital esté listo, este dato debería viajar
 * dentro del `AgentRunRequest` (campo `attachedDocs: readonly string[]`).
 */
function extractAttachedDocs(_report: MedicalReport): readonly string[] {
  return [];
}
