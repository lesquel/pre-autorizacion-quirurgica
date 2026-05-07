import type { Insurer } from '../entities';

/**
 * InsurerRepository — port de acceso al catálogo de aseguradoras.
 *
 * En el MVP hay una única aseguradora (INS-ANDINA), pero modelamos el catálogo
 * como repositorio para no quemar el id en la UI y soportar multi-tenant en
 * iteraciones futuras.
 */
export abstract class InsurerRepository {
  /** Lista todas las aseguradoras conocidas. */
  abstract list(): readonly Insurer[];

  /** Busca una aseguradora por su `id`; `undefined` si no existe. */
  abstract findById(id: string): Insurer | undefined;
}
