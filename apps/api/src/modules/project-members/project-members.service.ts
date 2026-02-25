import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberNotificationsDto } from './dto/update-member-notifications.dto';
import { ProjectRole, AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export interface MemberDto {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
}

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async getProjectMembers(projectKey: string): Promise<MemberDto[]> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      throw new NotFoundException(`Project with key "${projectKey}" not found`);
    }

    const memberships = await this.prisma.projectMembership.findMany({
      where: { projectId: project.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      projectId: m.projectId,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    }));
  }

  async addMember(
    projectKey: string,
    dto: CreateMemberDto,
    actorUserId?: string,
  ): Promise<MemberDto> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      throw new NotFoundException(`Project with key "${projectKey}" not found`);
    }

    // Find user by email
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException(
        `User with email "${dto.email}" not found. Please ensure the user exists before adding them to the project.`,
      );
    }

    // Check if membership already exists
    const existing = await this.prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: project.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `User "${dto.email}" is already a member of this project`,
      );
    }

    // Create membership
    const membership = await this.prisma.projectMembership.create({
      data: {
        userId: user.id,
        projectId: project.id,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorUserId,
      action: AuditAction.PROJECT_MEMBER_ADD,
      targetType: 'ProjectMembership',
      targetId: membership.id,
      metadata: {
        projectKey,
        projectId: project.id,
        memberEmail: user.email,
        memberUserId: user.id,
        role: dto.role,
      },
    });

    return {
      id: membership.id,
      userId: membership.userId,
      projectId: membership.projectId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
      user: membership.user,
    };
  }

  async updateMember(
    projectKey: string,
    memberId: string,
    dto: UpdateMemberDto,
    actorUserId?: string,
  ): Promise<MemberDto> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      throw new NotFoundException(`Project with key "${projectKey}" not found`);
    }

    // Verify membership exists and belongs to this project
    const existing = await this.prisma.projectMembership.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Member with id "${memberId}" not found`);
    }

    if (existing.projectId !== project.id) {
      throw new BadRequestException(
        'Member does not belong to this project',
      );
    }

    // Update membership
    const membership = await this.prisma.projectMembership.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorUserId,
      action: AuditAction.PROJECT_MEMBER_UPDATE,
      targetType: 'ProjectMembership',
      targetId: membership.id,
      metadata: {
        projectKey,
        projectId: project.id,
        memberEmail: membership.user.email,
        memberUserId: membership.userId,
        oldRole: existing.role,
        newRole: dto.role,
      },
    });

    return {
      id: membership.id,
      userId: membership.userId,
      projectId: membership.projectId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
      user: membership.user,
    };
  }

  async removeMember(projectKey: string, memberId: string, actorUserId?: string): Promise<void> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      throw new NotFoundException(`Project with key "${projectKey}" not found`);
    }

    // Verify membership exists and belongs to this project
    const existing = await this.prisma.projectMembership.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Member with id "${memberId}" not found`);
    }

    if (existing.projectId !== project.id) {
      throw new BadRequestException(
        'Member does not belong to this project',
      );
    }

    // Delete membership
    await this.prisma.projectMembership.delete({
      where: { id: memberId },
    });

    await this.auditService.log({
      actorUserId,
      action: AuditAction.PROJECT_MEMBER_REMOVE,
      targetType: 'ProjectMembership',
      targetId: memberId,
      metadata: {
        projectKey,
        projectId: project.id,
        memberEmail: existing.user.email,
        memberUserId: existing.userId,
        role: existing.role,
      },
    });
  }

  async updateMemberNotifications(
    projectKey: string,
    userId: string,
    dto: UpdateMemberNotificationsDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (!project) {
      throw new NotFoundException(`Project with key "${projectKey}" not found`);
    }

    const membership = await this.prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(
        `User is not a member of project "${projectKey}"`,
      );
    }

    return this.prisma.projectMembership.update({
      where: { id: membership.id },
      data: {
        emailNotifyAnalysisFailed: dto.emailNotifyAnalysisFailed,
        emailNotifyQualityGateFailed: dto.emailNotifyQualityGateFailed,
        emailAddress: dto.emailAddress,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }
}
