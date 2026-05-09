import { Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { RoleService } from './core/services/role.service';
import { TourService } from './core/services/tour.service';
import { Role } from './core/types/role';
import { ShellLayout } from './layouts/shell-layout/shell-layout';
import { AuthFacade } from './features/auth/application/facades/auth.facade';
import { HttpCaseRepository } from './features/authorization-cases/infrastructure/repos/http-case.repository';
import { HttpPolicyRepository } from './features/policies/infrastructure/repos/http-policy.repository';
import { HttpCoverageRepository } from './features/policies/infrastructure/repos/http-coverage.repository';
import { HttpInsurerRepository } from './features/policies/infrastructure/repos/http-insurer.repository';
import { HttpProcedureRepository } from './shared/infrastructure/repos/http-procedure.repository';

const ROLE_PREFIXES = ['hospital', 'insurer', 'auditor'] as const satisfies readonly Role[];

/**
 * Root de la app. Solo monta el ShellLayout (que contiene topbar + sidenav +
 * router-outlet) y mantiene la sincronización bidireccional entre el RoleService
 * y la URL.
 *
 * - Cuando el rol cambia (vía TopBar), navegamos a `/<role>`.
 * - Cuando la URL cambia (entrada manual o navegación interna), reflejamos
 *   el rol en el RoleService.
 *
 * El loop está cortado por las dos guardas `=== role` antes de cada acción.
 */
@Component({
  selector: 'app-root',
  imports: [ShellLayout],
  templateUrl: './app.html',
})
export class App {
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthFacade);
  private readonly tour = inject(TourService);
  private readonly caseRepo = inject(HttpCaseRepository);
  private readonly policyRepo = inject(HttpPolicyRepository);
  private readonly coverageRepo = inject(HttpCoverageRepository);
  private readonly insurerRepo = inject(HttpInsurerRepository);
  private readonly procedureRepo = inject(HttpProcedureRepository);
  /** Guard para que el auto-tour solo dispare una vez por sesión del componente. */
  private autoTourFired = false;

  constructor() {
    // URL → Role: cuando navegamos, sync el rol activo en el service.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        const segment = event.urlAfterRedirects.split('/')[1];
        if (this.isRole(segment) && this.roleService.role() !== segment) {
          this.roleService.set(segment);
        }
      });

    // Role → URL: cuando el rol cambia (TopBar click), navegamos al rol.
    effect(() => {
      const role = this.roleService.role();
      const currentRolePath = this.router.url.split('/')[1];
      if (currentRolePath !== role) {
        void this.router.navigate(['/', role]);
      }
    });

    // After auth, bootstrap the read-only caches in parallel.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        Promise.all([
          this.caseRepo.loadAll(),
          this.policyRepo.loadAll(),
          this.coverageRepo.loadAll(),
          this.insurerRepo.loadAll(),
          this.procedureRepo.list(),
        ]).catch(() => undefined);
      }
    });

    // Auto-start del tour guiado en la PRIMERA visita post-login. El flag
    // `preauth.tour.seen.<userId>` bloquea las siguientes; el botón `?` del
    // TopBar permite re-abrirlo cuando el usuario quiera. El scope por
    // userId evita que en una shared workstation, el primer login bloquee
    // la auto-tour de los siguientes usuarios.
    effect(() => {
      const user = this.auth.currentUser();
      if (
        !this.autoTourFired &&
        user !== null &&
        !this.tour.hasBeenSeen(user.id)
      ) {
        this.autoTourFired = true;
        // Pequeño delay para que el shell-layout termine de renderizar antes
        // del primer highlight (evita flicker del popover sobre el área vacía).
        setTimeout(() => void this.tour.start({ userId: user.id }), 600);
      }
    });
  }

  private isRole(segment: string | undefined): segment is Role {
    return segment !== undefined && (ROLE_PREFIXES as readonly string[]).includes(segment);
  }
}
