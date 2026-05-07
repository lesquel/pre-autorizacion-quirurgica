import type { components } from '../schema';
import type { Policy } from '../../../features/policies/domain/entities';

type PolicyDto = components['schemas']['PolicyOut'];
type PolicyInDto = components['schemas']['PolicyIn'];

export function policyFromDto(dto: PolicyDto): Policy {
  return {
    number: dto.number,
    patientId: dto.patientId,
    plan: dto.plan,
    insurerId: dto.insurerId,
    startDate: dto.startDate,
    endDate: dto.endDate,
    status: dto.status,
  };
}

export function policyToCreateBody(p: Policy): PolicyInDto {
  return {
    number: p.number,
    patientId: p.patientId,
    plan: p.plan,
    insurerId: p.insurerId,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
  };
}
