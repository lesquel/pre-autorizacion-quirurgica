import { Injectable, computed, effect, inject, signal } from '@angular/core';

import type { Role } from '../types/role';
import { AuthFacade } from '../../features/auth/application/facades/auth.facade';

const STORAGE_KEY = 'role';
const VALID_ROLES: readonly Role[] = ['hospital', 'insurer', 'auditor'];

function isRole(value: string | null): value is Role {
  return value !== null && (VALID_ROLES as readonly string[]).includes(value);
}

function loadInitial(): Role | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isRole(stored) ? stored : null;
}

/**
 * RoleService — exposes the active role to the UI.
 *
 * Source of truth is `AuthFacade.role` (derived from the JWT). The local
 * `_override` signal exists so the existing topbar role switcher and any
 * unauthenticated dev session keep working — when set, it wins over the
 * facade. Calling `set(role)` only updates the override; logging in or out
 * leaves the override intact unless the consumer clears it explicitly.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly auth = inject(AuthFacade);
  private readonly _override = signal<Role | null>(loadInitial());

  readonly role = computed<Role>(() => this._override() ?? this.auth.role());

  constructor() {
    effect(() => {
      if (typeof window === 'undefined') return;
      const ov = this._override();
      if (ov) {
        window.localStorage.setItem(STORAGE_KEY, ov);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    });
  }

  set(role: Role): void {
    this._override.set(role);
  }

  clearOverride(): void {
    this._override.set(null);
  }
}
