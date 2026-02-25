import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, OrgRole, UserRole } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateOrganizationDto, creatorUserId: string) {
    // Check if slug is taken
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Organization with slug "${dto.slug}" already exists`);
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        members: {
          create: {
            userId: creatorUserId,
            role: OrgRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });

    await this.auditService.log({
      actorUserId: creatorUserId,
      action: AuditAction.ORGANIZATION_CREATE,
      targetType: 'Organization',
      targetId: organization.id,
      metadata: { orgSlug: organization.slug, orgName: organization.name },
    });

    return organization;
  }

  async findAll(userId: string, userGlobalRole: UserRole) {
    // ADMINs see all organizations
    if (userGlobalRole === UserRole.ADMIN) {
      return this.prisma.organization.findMany({
        include: {
          _count: {
            select: { projects: true, members: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Regular users see only organizations they belong to
    return this.prisma.organization.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        _count: {
          select: { projects: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { projects: true, members: true, qualityGates: true, analyzers: true },
        },
      },
    });
    if (!org) {
      throw new NotFoundException(`Organization with slug "${slug}" not found`);
    }
    return org;
  }

  async update(slug: string, dto: UpdateOrganizationDto, userId: string) {
    const org = await this.findBySlug(slug);

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        name: dto.name ?? org.name,
        description: dto.description !== undefined ? dto.description : org.description,
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.ORGANIZATION_UPDATE,
      targetType: 'Organization',
      targetId: org.id,
      metadata: { orgSlug: slug, changes: dto },
    });

    return updated;
  }

  async delete(slug: string, userId: string) {
    const org = await this.findBySlug(slug);

    // Check if organization has projects
    const projectCount = await this.prisma.project.count({
      where: { organizationId: org.id },
    });

    if (projectCount > 0) {
      throw new ForbiddenException(
        `Cannot delete organization "${slug}" with ${projectCount} existing project(s). Please delete all projects first.`
      );
    }

    await this.prisma.organization.delete({
      where: { id: org.id },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.ORGANIZATION_DELETE,
      targetType: 'Organization',
      targetId: org.id,
      metadata: { orgSlug: slug },
    });
  }

  async getMembers(slug: string) {
    const org = await this.findBySlug(slug);
    return this.prisma.organizationMembership.findMany({
      where: { organizationId: org.id },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(slug: string, email: string, role: OrgRole, actorUserId: string) {
    const org = await this.findBySlug(slug);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException(`User with email "${email}" not found`);
    }

    const existing = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException(`User "${email}" is already a member of this organization`);
    }

    const membership = await this.prisma.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    await this.auditService.log({
      actorUserId,
      action: AuditAction.ORGANIZATION_MEMBER_ADD,
      targetType: 'OrganizationMembership',
      targetId: membership.id,
      metadata: { orgSlug: slug, memberEmail: email, role },
    });

    return membership;
  }

  async removeMember(slug: string, userId: string, actorUserId: string) {
    const org = await this.findBySlug(slug);

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId,
        },
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Prevent removing last OWNER
    if (membership.role === OrgRole.OWNER) {
      const ownerCount = await this.prisma.organizationMembership.count({
        where: {
          organizationId: org.id,
          role: OrgRole.OWNER,
        },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Cannot remove the last OWNER of the organization');
      }
    }

    await this.prisma.organizationMembership.delete({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId,
        },
      },
    });

    await this.auditService.log({
      actorUserId,
      action: AuditAction.ORGANIZATION_MEMBER_REMOVE,
      targetType: 'OrganizationMembership',
      targetId: membership.id,
      metadata: { orgSlug: slug, memberEmail: membership.user.email },
    });
  }

  async getProjects(slug: string) {
    const org = await this.findBySlug(slug);
    return this.prisma.project.findMany({
      where: { organizationId: org.id },
      include: {
        branches: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
