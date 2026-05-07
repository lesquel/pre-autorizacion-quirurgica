import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { formatDuration } from '../../../../../shared/helpers';
import { AGENT_NODES } from '../../../infrastructure/agents/agent-nodes';
import type { TraceStep } from '../../../domain/value-objects/trace-step';

interface ViewStep {
  readonly node: string;
  readonly label: string;
  readonly state: 'running' | 'done' | 'error' | 'pending';
  readonly durationMs?: number;
  readonly modelUsed?: string;
  readonly detail?: string;
  readonly error?: string;
}

/**
 * AgentTraceViewer — visor en vivo de la traza del agente (LangGraph 7 nodos).
 *
 * Render: lista vertical, cada step con ícono de estado a la izquierda
 * (spinner / check / x), label resuelto contra `AGENT_NODES`, durationMs,
 * modelUsed (mono), detail y error si aplican.
 *
 * Si `currentNodeId` viene seteado y NO existe ya un step terminal para él,
 * lo render como `running` para reflejar el "en curso" mientras llegan eventos.
 */
@Component({
  selector: 'app-agent-trace-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex flex-col">
      @for (s of viewSteps(); track s.node + '-' + $index) {
        <li
          class="flex gap-3 px-3 py-3 border-b border-line last:border-b-0"
          [class.bg-bg-2]="s.state === 'running'"
          [class.animate-pulse]="s.state === 'running'"
        >
          <div class="flex-shrink-0 mt-0.5">
            @switch (s.state) {
              @case ('running') {
                <svg
                  class="w-4 h-4 text-info animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-label="ejecutando"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-opacity="0.25"
                  ></circle>
                  <path
                    d="M21 12a9 9 0 0 1-9 9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  ></path>
                </svg>
              }
              @case ('done') {
                <svg
                  class="w-4 h-4 text-ok"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-label="completado"
                >
                  <path
                    d="M5 12.5l4 4 10-10"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
              }
              @case ('error') {
                <svg
                  class="w-4 h-4 text-err"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-label="error"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  ></path>
                </svg>
              }
              @default {
                <span
                  class="block w-4 h-4 border border-line-2 rounded-full"
                  aria-label="pendiente"
                ></span>
              }
            }
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span
                class="text-sm text-ink dark:text-bg leading-tight"
              >
                {{ s.label }}
              </span>
              @if (s.durationMs != null) {
                <span class="font-mono text-[10px] text-ink-4 tabular-nums">
                  {{ formatDuration(s.durationMs) }}
                </span>
              }
            </div>

            @if (s.modelUsed) {
              <div class="font-mono text-[10px] text-ink-4 mt-0.5">
                {{ s.modelUsed }}
              </div>
            }

            @if (s.detail) {
              <div class="text-xs text-ink-3 dark:text-ink-5 mt-1">
                {{ s.detail }}
              </div>
            }

            @if (s.error) {
              <div class="text-xs text-err mt-1 font-mono">
                {{ s.error }}
              </div>
            }
          </div>
        </li>
      } @empty {
        <li class="px-3 py-6 text-center text-sm text-ink-4">
          Esperando primer paso del agente…
        </li>
      }
    </ol>
  `,
})
export class AgentTraceViewer {
  readonly trace = input.required<readonly TraceStep[]>();
  readonly currentNodeId = input<string | undefined>(undefined);

  protected readonly formatDuration = formatDuration;

  protected readonly viewSteps = computed<readonly ViewStep[]>(() => {
    const steps: ViewStep[] = this.trace().map((step) => ({
      node: step.node,
      label: labelFor(step.node),
      state: step.state,
      durationMs: step.durationMs,
      modelUsed: step.modelUsed,
      detail: step.detail,
      error: step.error,
    }));

    const currentId = this.currentNodeId();
    if (currentId && !steps.some((s) => s.node === currentId)) {
      steps.push({
        node: currentId,
        label: labelFor(currentId),
        state: 'running',
      });
    }

    return steps;
  });
}

function labelFor(nodeId: string): string {
  return AGENT_NODES.find((n) => n.id === nodeId)?.label ?? nodeId;
}
