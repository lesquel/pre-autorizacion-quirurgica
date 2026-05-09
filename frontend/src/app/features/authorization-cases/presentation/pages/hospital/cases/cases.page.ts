import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';

import { PageHeader } from '../../../../../../core/components/page-header/page-header';
import { AuthorizationCasesFacade } from '../../../../application/facades/authorization-cases.facade';
import { CaseTable } from '../../../components/case-table/case-table';

/**
 * HospitalCasesPage — bandeja completa de casos del hospital.
 *
 * Lista todos los casos via `facade.cases()`. Click en una fila selecciona
 * el caso (para que la siguiente vista lo lea de la facade) y navega al
 * live-run, donde se va a ver la traza completa + decisión persistida.
 */
@Component({
  selector: 'app-hospital-cases-page',
  standalone: true,
  imports: [PageHeader, CaseTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Casos enviados"
      subtitle="Bandeja de pre-autorizaciones — última actividad primero."
      [breadcrumbs]="['Hospital', 'Casos']"
    />

    <section class="px-0 py-4 lg:px-7 lg:py-6">
      <app-case-table
        [cases]="facade.cases()"
        mode="hospital"
        (caseClicked)="onCaseClicked($event)"
      />
    </section>
  `,
})
export class HospitalCasesPage {
  protected readonly facade = inject(AuthorizationCasesFacade);
  private readonly router = inject(Router);

  protected onCaseClicked(caseId: string): void {
    this.facade.selectCase(caseId);
    void this.router.navigate(['/hospital/live-run']);
  }
}
