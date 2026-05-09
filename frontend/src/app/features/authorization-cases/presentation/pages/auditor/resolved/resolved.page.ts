import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';

import { PageHeader } from '../../../../../../core/components';
import { AuthorizationCasesFacade } from '../../../../application/facades/authorization-cases.facade';
import { CaseTable } from '../../../components';

/**
 * AuditorResolvedPage — histórico de casos resueltos (status DECIDIDO).
 *
 * Muestra todos los casos cerrados (por agente o auditor) en modo `auditor`
 * de la tabla compartida. El click en una fila abre el detalle (read-only
 * cuando el status ya es DECIDIDO).
 */
@Component({
  selector: 'app-auditor-resolved-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, CaseTable],
  template: `
    <div class="flex flex-col gap-5">
      <app-page-header
        title="Casos resueltos"
        subtitle="Histórico de decisiones de auditores"
      />

      <section class="px-0 lg:px-7">
        <app-case-table
          [cases]="resolvedCases()"
          mode="auditor"
          (caseClicked)="openCase($event)"
        />
      </section>
    </div>
  `,
})
export class AuditorResolvedPage {
  private readonly facade = inject(AuthorizationCasesFacade);
  private readonly router = inject(Router);

  protected readonly resolvedCases = computed(() =>
    this.facade.cases().filter((c) => c.status === 'DECIDIDO'),
  );

  protected openCase(caseId: string): void {
    void this.router.navigate(['/auditor/case', caseId]);
  }
}
