import { Routes } from '@angular/router';

import { authGuard } from './shared/guards/auth.guard';

/**
 * Rutas de la app. Lazy load por feature para mantener el bundle inicial chico.
 * Cada rol tiene su prefijo (/hospital, /insurer, /auditor) y un default que
 * redirige a la pantalla principal del rol.
 *
 * El default '/' redirige a '/hospital' (rol por defecto). El sync rol↔URL
 * vive en `App` (ver app.ts) — cuando el RoleService cambia, navega al rol.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/presentation/pages/login/login.page').then((m) => m.LoginPage),
  },

  // Hospital
  {
    path: 'hospital',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'submit' },
      {
        path: 'submit',
        loadComponent: () =>
          import(
            './features/authorization-cases/presentation/pages/hospital/submit/submit.page'
          ).then((m) => m.HospitalSubmitPage),
      },
      {
        path: 'live-run',
        loadComponent: () =>
          import(
            './features/authorization-cases/presentation/pages/hospital/live-run/live-run.page'
          ).then((m) => m.HospitalLiveRunPage),
      },
      {
        path: 'cases',
        loadComponent: () =>
          import(
            './features/authorization-cases/presentation/pages/hospital/cases/cases.page'
          ).then((m) => m.HospitalCasesPage),
      },
      {
        path: 'procedures',
        loadComponent: () =>
          import(
            './features/authorization-cases/presentation/pages/hospital/procedures/procedures.page'
          ).then((m) => m.HospitalProceduresPage),
      },
    ],
  },

  // Insurer (Aseguradora)
  {
    path: 'insurer',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import(
            './features/policies/presentation/pages/insurer/dashboard/dashboard.page'
          ).then((m) => m.InsurerDashboardPage),
      },
      {
        path: 'cases',
        loadComponent: () =>
          import(
            './features/policies/presentation/pages/insurer/cases/cases.page'
          ).then((m) => m.InsurerCasesPage),
      },
      {
        path: 'policies',
        loadComponent: () =>
          import(
            './features/policies/presentation/pages/insurer/policies/policies.page'
          ).then((m) => m.InsurerPoliciesPage),
      },
      {
        path: 'coverages',
        loadComponent: () =>
          import(
            './features/policies/presentation/pages/insurer/coverages/coverages.page'
          ).then((m) => m.InsurerCoveragesPage),
      },
    ],
  },

  // Auditor médico
  {
    path: 'auditor',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tray' },
      {
        path: 'tray',
        loadComponent: () =>
          import(
            './features/authorization-cases/presentation/pages/auditor/tray/tray.page'
          ).then((m) => m.AuditorTrayPage),
      },
      {
        path: 'case/:id',
        loadComponent: () =>
          import(
            './features/authorization-cases/presentation/pages/auditor/case-detail/case-detail.page'
          ).then((m) => m.AuditorCaseDetailPage),
      },
      {
        path: 'resolved',
        loadComponent: () =>
          import(
            './features/authorization-cases/presentation/pages/auditor/resolved/resolved.page'
          ).then((m) => m.AuditorResolvedPage),
      },
    ],
  },

  // Default redirect → hospital. El sync rol↔URL en App ajusta si el localStorage
  // tiene otro rol persistido.
  { path: '', pathMatch: 'full', redirectTo: 'hospital' },
  { path: '**', redirectTo: '' },
];
