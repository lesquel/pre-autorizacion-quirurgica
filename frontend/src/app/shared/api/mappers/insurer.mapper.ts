import type { components } from '../schema';
import type { Insurer } from '../../../features/policies/domain/entities';

type InsurerDto = components['schemas']['InsurerOut'];

export function insurerFromDto(dto: InsurerDto): Insurer {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email ?? undefined,
  };
}
