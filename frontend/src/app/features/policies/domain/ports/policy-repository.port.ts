import type { Policy } from '../entities';

/**
 * PolicyRepository — port de acceso a las pólizas (read-only en MVP).
 *
 * Modelado como **clase abstracta** para usarse directamente como token de
 * Angular DI: `provide: PolicyRepository, useClass: InMemoryPolicyRepository`.
 *
 * En el MVP la fuente de verdad es el SEED (snapshot estático), por eso el
 * contrato es puramente sincrónico. Cuando llegue un backend real, el adapter
 * se reemplaza por un `HttpPolicyRepository` y el contrato puede evolucionar
 * sin afectar a los use cases.
 */
export abstract class PolicyRepository {
  /** Lista todas las pólizas conocidas. */
  abstract list(): readonly Policy[];

  /** Busca una póliza por su `number`; `undefined` si no existe. */
  abstract findByNumber(n: string): Policy | undefined;

  abstract create(p: Policy): Promise<Policy>;
  abstract update(p: Policy): Promise<Policy>;
  abstract delete(number: string): Promise<void>;
}
