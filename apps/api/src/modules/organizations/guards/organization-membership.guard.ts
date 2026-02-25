import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgRole, UserRole } from '@prisma/client';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';
import { AuthPayload } from '../../auth/auth.types';

@Injectable()
export class OrganizationMembershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthPayload = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Global ADMINs bypass org membership checks
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const orgSlug = request.params?.slug;
    if (!orgSlug) {
      throw new NotFoundException('Organization slug not found in request');
    }

    // Resolve organization
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) {
      throw new NotFoundException(`Organization "${orgSlug}" not found`);
    }

    // Check membership
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.sub,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // Check required roles (if decorator is used)
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(membership.role)) {
        throw new ForbiddenException(
          `Requires one of the following roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    return true;
  }
}
