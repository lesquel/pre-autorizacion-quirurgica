import type { components } from '../schema';
import type { Procedure } from '../../domain/entities';

type ProcedureDto = components['schemas']['ProcedureOut'];

/**
 * Body shape for POST/PUT /procedures. Mirrors backend `ProcedureIn`.
 *
 * Defined inline (not pulled from generated `schema.d.ts`) so the frontend
 * can compile against the new endpoints without a pre-build openapi regen.
 * Run `npm run gen:api` to refresh the generated schema once the deployed
 * backend exposes the updated /openapi.json.
 */
export interface ProcedureInBody {
  code: string;
  name: string;
  category?: string | null;
  waitingDaysTypical?: number | null;
}

export function procedureFromDto(dto: ProcedureDto): Procedure {
  return {
    code: dto.code,
    name: dto.name,
    category: dto.category ?? undefined,
    waitingDaysTypical: dto.waitingDaysTypical ?? undefined,
  };
}

export function procedureToBody(p: Procedure): ProcedureInBody {
  return {
    code: p.code,
    name: p.name,
    category: p.category ?? null,
    waitingDaysTypical: p.waitingDaysTypical ?? null,
  };
}
