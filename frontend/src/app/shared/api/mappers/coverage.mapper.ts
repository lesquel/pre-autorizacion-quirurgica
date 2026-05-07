import type { components } from '../schema';
import type { Coverage } from '../../../features/policies/domain/entities';

type CoverageDto = components['schemas']['CoverageOut'];
type CoverageInDto = components['schemas']['CoverageIn'];

export function coverageFromDto(dto: CoverageDto): Coverage {
  return {
    policyNumber: dto.policyNumber,
    procedureCode: dto.procedureCode,
    covered: dto.covered,
    waitingDays: dto.waitingDays,
    copay: Number(dto.copay),
    requiredDocs: dto.requiredDocs ?? [],
  };
}

export function coverageToBody(c: Coverage): CoverageInDto {
  return {
    policyNumber: c.policyNumber,
    procedureCode: c.procedureCode,
    covered: c.covered,
    waitingDays: c.waitingDays,
    copay: String(c.copay),
    requiredDocs: c.requiredDocs ? [...c.requiredDocs] : [],
  };
}
