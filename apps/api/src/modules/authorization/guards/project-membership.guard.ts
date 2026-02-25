import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '@prisma/client';
import { AuthorizationService } from '../authorization.service';
import { PROJECT_ROLES_KEY } from '../decorators/project-role.decorator';
import { AuthPayload } from '../../auth/auth.types';

/**
 * Guard to check project membership and roles
 * - In COMPAT mode: allows all authenticated users (backward compatible)
 * - In STRICT mode: requires project membership (or ADMIN global role)
 * - Can optionally enforce specific project roles via @ProjectRoles decorator
 */
@Injectable()
export class ProjectMembershipGuard implements CanActivate {
  constructor(
    private readonly authzService: AuthorizationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthPayload | undefined = request.user;
    const apiToken = request.apiToken as { projectId?: string | null } | undefined;

    if (!user && !apiToken) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract projectId or projectKey from request (params, query, or body)
    const projectIdOrKey =
      request.params?.projectId ||
      request.params?.id || // For routes like /projects/:id
      request.params?.key || // For routes like /projects/:key
      request.query?.projectId ||
      request.body?.projectId;

    if (!projectIdOrKey) {
      throw new BadRequestException('Project ID or key not found in request');
    }

    // Resolve projectId from key if necessary
    const projectId = await this.authzService.resolveProjectId(projectIdOrKey);

    if (!projectId) {
      if (apiToken) {
        // Allow API tokens to pass so the downstream handler can return 404 if needed
        return true;
      }
      throw new BadRequestException('Project not found');
    }

    // Get required roles from decorator (if any)
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (apiToken && !user) {
      if (requiredRoles && requiredRoles.length > 0) {
        throw new ForbiddenException('Access denied');
      }
      // Global tokens can access any project; scoped tokens must match the project
      if (apiToken.projectId && apiToken.projectId !== projectId) {
        throw new ForbiddenException('Access denied');
      }
      return true;
    }

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check access
    const hasAccess = await this.authzService.canAccessProject(
      user.sub,
      projectId,
      user.role,
      requiredRoles,
    );

    if (!hasAccess) {
      if (this.authzService.isStrictMode()) {
        throw new ForbiddenException(
          'You do not have permission to access this project',
        );
      } else {
        // In COMPAT mode, this should not happen (all authenticated users have access)
        throw new ForbiddenException('Access denied');
      }
    }

    return true;
  }
}
