import type { Procedure } from '../entities/procedure';

export abstract class ProcedureRepository {
  abstract list(): Promise<readonly Procedure[]>;
  abstract search(query: string): Promise<readonly Procedure[]>;
  abstract create(procedure: Procedure): Promise<Procedure>;
  abstract update(procedure: Procedure): Promise<Procedure>;
  abstract delete(code: string): Promise<void>;
}
