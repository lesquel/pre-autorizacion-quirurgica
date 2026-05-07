import type { components } from '../schema';
import type { Procedure } from '../../domain/entities';

type ProcedureDto = components['schemas']['ProcedureOut'];

export function procedureFromDto(dto: ProcedureDto): Procedure {
  return {
    code: dto.code,
    name: dto.name,
    category: dto.category ?? undefined,
    waitingDaysTypical: dto.waitingDaysTypical ?? undefined,
  };
}
