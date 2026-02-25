import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthzMode, ProjectRole, UserRole } from './authorization.types';

@Injectable()
export class AuthorizationService {
  private readonly authzMode: AuthzMode;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.authzMode = (this.config.get<string>('AUTHZ_MODE') || 'COMPAT') as AuthzMode;
  }

  getAuthzMode(): AuthzMode {
    return this.authzMode;
  }

  isStrictMode(): boolean {
    return this.authzMode === 'STRICT';
  }

  isCompatMode(): boolean {
    return this.authzMode === 'COMPAT';
  }

  /**
   * Resolve project ID from either ID or key
   * @param idOrKey - Project ID (UUID) or project key (string)
   * @returns Project ID or null if not found
   */
  async resolveProjectId(idOrKey: string): Promise<string | null> {
    // First, try to find by ID (if it's a UUID)
    const byId = await this.prisma.project.findUnique({
      where: { id: idOrKey },
      select: { id: true },
    });
    if (byId) {
      return byId.id;
    }

    // Otherwise, try to find by key
    const byKey = await this.prisma.project.findUnique({
      where: { key: idOrKey },
      select: { id: true },
    });
    if (byKey) {
      return byKey.id;
    }

    return null;
  }

  /**
   * Check if user has access to a project
   * @param userId - User ID
   * @param projectId - Project ID
   * @param globalRole - User's global role
   * @param requiredRoles - Optional required project roles (if not specified, any membership is ok)
   * @returns true if user has access, false otherwise
   */
  async canAccessProject(
    userId: string,
    projectId: string,
    globalRole: UserRole,
    requiredRoles?: ProjectRole[],
  ): Promise<boolean> {
    // ADMIN users always have access
    if (globalRole === UserRole.ADMIN) {
      return true;
    }

    // In COMPAT mode, all authenticated users can access projects (backward compatibility)
    if (this.isCompatMode()) {
      return true;
    }

    // In STRICT mode, check for project membership
    const membership = await this.prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    if (!membership) {
      return false;
    }

    // If specific roles are required, check if user has one of them
    if (requiredRoles && requiredRoles.length > 0) {
      return requiredRoles.includes(membership.role);
    }

    return true;
  }

  /**
   * Get user's project membership
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns ProjectMembership or null
   */
  async getProjectMembership(userId: string, projectId: string) {
    return this.prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });
  }

  /**
   * Check if user has specific role on project
   * @param userId - User ID
   * @param projectId - Project ID
   * @param role - Required role
   * @returns true if user has the role, false otherwise
   */
  async hasProjectRole(
    userId: string,
    projectId: string,
    role: ProjectRole,
  ): Promise<boolean> {
    const membership = await this.getProjectMembership(userId, projectId);
    return membership?.role === role;
  }
}
