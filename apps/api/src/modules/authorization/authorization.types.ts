import { ProjectRole, UserRole } from '@prisma/client';

export { ProjectRole, UserRole };

export type AuthzMode = 'COMPAT' | 'STRICT';

export interface ProjectMembershipContext {
  userId: string;
  projectId: string;
  role?: ProjectRole;
  globalRole: UserRole;
}
