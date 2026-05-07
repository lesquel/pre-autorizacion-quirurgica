import type { Coverage, Policy } from '../../../features/policies/domain/entities';
import type { Patient, Procedure } from '../entities';

/**
 * Finders — funciones puras para resolver entidades en memoria contra colecciones
 * (típicamente el SEED). Cero acoplamiento con Angular: sólo TS puro.
 *
 * Todas devuelven `undefined` si no encuentran match — el caller decide qué hacer.
 */

export function findPatient(
  id: string,
  patients: readonly Patient[],
): Patient | undefined {
  return patients.find((p) => p.id === id);
}

export function findPolicy(
  number: string,
  policies: readonly Policy[],
): Policy | undefined {
  return policies.find((p) => p.number === number);
}

export function findProcedure(
  code: string,
  procedures: readonly Procedure[],
): Procedure | undefined {
  return procedures.find((p) => p.code === code);
}

export interface CoverageQuery {
  readonly policyNumber: string;
  readonly procedureCode: string;
}

export function findCoverage(
  query: CoverageQuery,
  coverages: readonly Coverage[],
): Coverage | undefined {
  return coverages.find(
    (c) =>
      c.policyNumber === query.policyNumber &&
      c.procedureCode === query.procedureCode,
  );
}
