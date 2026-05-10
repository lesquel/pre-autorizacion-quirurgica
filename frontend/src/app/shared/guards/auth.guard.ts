import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthFacade } from '../../features/auth/application/facades/auth.facade';

/**
 * authGuard — exige sesión autenticada para acceder a rutas privadas.
 *
 * Para el demo/MVP no validamos el rol del JWT vs el prefijo de la URL:
 * cualquier usuario autenticado puede saltar entre /hospital, /insurer y
 * /auditor usando el role-switcher de la topbar. Esto facilita las demos.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.parseUrl(`/login?next=${encodeURIComponent(state.url)}`);
};
