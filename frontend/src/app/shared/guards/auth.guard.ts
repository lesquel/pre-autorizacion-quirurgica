import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthFacade } from '../../features/auth/application/facades/auth.facade';
import type { Role } from '../../core/types/role';

const ROLE_PREFIXES: readonly Role[] = ['hospital', 'insurer', 'auditor'];

function isRolePrefix(segment: string): segment is Role {
  return (ROLE_PREFIXES as readonly string[]).includes(segment);
}

/**
 * authGuard — exige sesión autenticada Y que el primer segmento de la URL
 * coincida con el rol del usuario logueado.
 *
 * - Sin sesión → redirige a `/login?next=<url>`.
 * - Con sesión, accediendo a un prefijo de otro rol → redirige al home del
 *   rol propio. Esto evita que un usuario Hospital tipee manualmente
 *   `/insurer/dashboard` y vea contenido fuera de su scope.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthFacade);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.parseUrl(`/login?next=${encodeURIComponent(state.url)}`);
  }

  const segment = state.url.split('/')[1]?.split('?')[0] ?? '';
  if (isRolePrefix(segment) && segment !== auth.role()) {
    return router.parseUrl(`/${auth.role()}`);
  }

  return true;
};
