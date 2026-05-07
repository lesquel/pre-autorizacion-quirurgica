import type { Signal } from '@angular/core';

import type { AuthorizationCase } from '../entities/authorization-case';

/**
 * CaseRepository — port del repositorio de casos de autorización.
 *
 * Modelado como **clase abstracta** para que Angular DI la use directamente
 * como token: `provide: CaseRepository, useClass: InMemoryCaseRepository`.
 *
 * Contrato:
 * - `cases`         : Signal reactivo con la lista completa (la UI se suscribe acá).
 * - `listSnapshot()`: snapshot sincrónico para casos donde no querés reactividad
 *                     (ej. dentro de un use case que sólo lee una vez).
 * - `findById(id)`  : búsqueda por id, O(n) sobre el array actual.
 * - `create(case_)` : agrega un caso nuevo (immutable spread).
 * - `update(id, p)` : reemplaza el caso con id por { ...current, ...patch }.
 *
 * Toda mutación debe ser inmutable — el adapter usa `signal.update(...)` y
 * NUNCA muta in-place el array ni el caso.
 */
export abstract class CaseRepository {
  /** Reactive signal con todos los casos. */
  abstract readonly cases: Signal<readonly AuthorizationCase[]>;

  /** Snapshot sincrónico. */
  abstract listSnapshot(): readonly AuthorizationCase[];

  /** Busca un caso por id; `undefined` si no existe. */
  abstract findById(id: string): AuthorizationCase | undefined;

  /** Crea un caso nuevo (no valida duplicados — el caller asegura ids únicos). */
  abstract create(case_: AuthorizationCase): void;

  /** Actualiza inmutablemente el caso `id` con `patch`. No-op si no existe. */
  abstract update(id: string, patch: Partial<AuthorizationCase>): void;
}
