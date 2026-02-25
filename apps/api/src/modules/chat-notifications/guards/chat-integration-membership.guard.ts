import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { UserRole } from '@prisma/client';

@Injectable()
export class ChatIntegrationMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthPayload | undefined;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const params = request.params ?? {};
    const rawId = params.id;
    const rawProject = params.key ?? request.body?.projectId ?? request.body?.projectKey;
    let projectId: string | null = null;

    if (rawId) {
      const id = Number(rawId);
      if (!Number.isFinite(id)) {
        throw new BadRequestException('Invalid chat integration id');
      }

      const integration = await this.prisma.chatIntegration.findUnique({
        where: { id },
        select: { projectId: true },
      });

      if (!integration) {
        throw new NotFoundException(`Chat integration ${rawId} not found`);
      }

      projectId = integration.projectId;
    } else if (rawProject) {
      const byId = await this.prisma.project.findUnique({
        where: { id: rawProject },
        select: { id: true },
      });
      if (byId) {
        projectId = byId.id;
      } else {
        const byKey = await this.prisma.project.findUnique({
          where: { key: rawProject },
          select: { id: true },
        });
        if (!byKey) {
          throw new NotFoundException(`Project ${rawProject} not found`);
        }
        projectId = byKey.id;
      }
    }

    if (!projectId) {
      throw new BadRequestException('Project id or key not found in request');
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const membership = await this.prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: user.sub,
          projectId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have permission to access this project');
    }

    return true;
  }
}
