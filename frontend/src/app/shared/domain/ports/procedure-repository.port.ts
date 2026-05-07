import type { Procedure } from '../entities/procedure';

export abstract class ProcedureRepository {
  abstract list(): Promise<readonly Procedure[]>;
  abstract search(query: string): Promise<readonly Procedure[]>;
}
