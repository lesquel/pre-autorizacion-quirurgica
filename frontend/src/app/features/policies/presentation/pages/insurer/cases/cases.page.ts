import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { PageHeader } from '../../../../../../core/components';
import { AuthorizationCasesFacade } from '../../../../../authorization-cases/application/facades/authorization-cases.facade';
import { CaseTable } from '../../../../../authorization-cases/presentation/components';

/**
 * InsurerCasesPage — bandeja read-only de casos para la aseguradora.
 *
 * El `CaseTable` recibe `mode='insurer'` (vista global, sin acción de open
 * porque el rol Aseguradora no resuelve casos). El `(openCase)` queda sin
 * handler — la tabla decide internamente si lo expone para insurer o no.
 */
@Component({
  selector: 'app-insurer-cases-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, CaseTable],
  template: `
    <app-page-header
      title="Casos"
      subtitle="Vista global de pre-autorizaciones"
    />

    <section class="px-0 py-4 lg:px-7 lg:py-6">
      <app-case-table mode="insurer" [cases]="cases()" />
    </section>
  `,
})
export class InsurerCasesPage {
  private readonly facade = inject(AuthorizationCasesFacade);

  protected readonly cases = this.facade.cases;
}
