import type { Role } from '../../../../core/types/role';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}
