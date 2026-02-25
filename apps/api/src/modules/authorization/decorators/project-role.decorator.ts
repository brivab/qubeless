import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

export const PROJECT_ROLES_KEY = 'project_roles';

/**
 * Decorator to specify required project roles for an endpoint
 * @param roles - Array of ProjectRole that are allowed to access this endpoint
 *
 * @example
 * ```typescript
 * @ProjectRoles(ProjectRole.PROJECT_ADMIN)
 * async deleteProject() { ... }
 * ```
 */
export const ProjectRoles = (...roles: ProjectRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);
