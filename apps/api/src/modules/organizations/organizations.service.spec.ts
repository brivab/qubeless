import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, OrgRole, UserRole } from '@prisma/client';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prismaService: PrismaService;
  let auditService: AuditService;

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organizationMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    project: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Organization',
      slug: 'test-org',
      description: 'A test organization',
    };

    it('should create organization with creator as OWNER', async () => {
      const creatorUserId = 'user-123';
      const mockOrg = {
        id: 'org-456',
        name: createDto.name,
        slug: createDto.slug,
        description: createDto.description,
        members: [
          {
            userId: creatorUserId,
            role: OrgRole.OWNER,
            user: { id: creatorUserId, email: 'creator@example.com' },
          },
        ],
      };

      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue(mockOrg);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create(createDto, creatorUserId);

      expect(result).toEqual(mockOrg);
      expect(mockPrismaService.organization.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          slug: createDto.slug,
          description: createDto.description,
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
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: creatorUserId,
        action: AuditAction.ORGANIZATION_CREATE,
        targetType: 'Organization',
        targetId: mockOrg.id,
        metadata: { orgSlug: mockOrg.slug, orgName: mockOrg.name },
      });
    });

    it('should throw ConflictException when slug is already taken', async () => {
      const existingOrg = { id: 'existing-org', slug: createDto.slug };
      mockPrismaService.organization.findUnique.mockResolvedValue(existingOrg);

      await expect(service.create(createDto, 'user-123')).rejects.toThrow(
        new ConflictException(`Organization with slug "${createDto.slug}" already exists`),
      );
      expect(mockPrismaService.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all organizations for ADMIN users', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'Org 1', slug: 'org-1', _count: { projects: 5, members: 3 } },
        { id: 'org-2', name: 'Org 2', slug: 'org-2', _count: { projects: 2, members: 1 } },
      ];
      mockPrismaService.organization.findMany.mockResolvedValue(mockOrgs);

      const result = await service.findAll('admin-123', UserRole.ADMIN);

      expect(result).toEqual(mockOrgs);
      expect(mockPrismaService.organization.findMany).toHaveBeenCalledWith({
        include: {
          _count: {
            select: { projects: true, members: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return only user memberships for regular users', async () => {
      const userId = 'user-123';
      const mockOrgs = [
        { id: 'org-1', name: 'User Org', slug: 'user-org', _count: { projects: 2, members: 1 } },
      ];
      mockPrismaService.organization.findMany.mockResolvedValue(mockOrgs);

      const result = await service.findAll(userId, UserRole.USER);

      expect(result).toEqual(mockOrgs);
      expect(mockPrismaService.organization.findMany).toHaveBeenCalledWith({
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
    });
  });

  describe('findBySlug', () => {
    it('should return organization when found', async () => {
      const mockOrg = {
        id: 'org-456',
        name: 'Test Org',
        slug: 'test-org',
        _count: { projects: 3, members: 5, qualityGates: 2, analyzers: 4 },
      };
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await service.findBySlug('test-org');

      expect(result).toEqual(mockOrg);
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-org' },
        include: {
          _count: {
            select: { projects: true, members: true, qualityGates: true, analyzers: true },
          },
        },
      });
    });

    it('should throw NotFoundException when organization not found', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        new NotFoundException('Organization with slug "non-existent" not found'),
      );
    });
  });

  describe('update', () => {
    const mockOrg = {
      id: 'org-456',
      name: 'Original Name',
      slug: 'test-org',
      description: 'Original description',
    };

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
    });

    it('should update organization name and description', async () => {
      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };
      const updatedOrg = { ...mockOrg, ...updateDto };
      mockPrismaService.organization.update.mockResolvedValue(updatedOrg);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('test-org', updateDto, 'user-123');

      expect(result).toEqual(updatedOrg);
      expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrg.id },
        data: {
          name: updateDto.name,
          description: updateDto.description,
        },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.ORGANIZATION_UPDATE,
        targetType: 'Organization',
        targetId: mockOrg.id,
        metadata: { orgSlug: 'test-org', changes: updateDto },
      });
    });

    it('should handle partial update (name only)', async () => {
      const updateDto = { name: 'New Name' };
      const updatedOrg = { ...mockOrg, name: updateDto.name };
      mockPrismaService.organization.update.mockResolvedValue(updatedOrg);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.update('test-org', updateDto, 'user-123');

      expect(mockPrismaService.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrg.id },
        data: {
          name: updateDto.name,
          description: mockOrg.description,
        },
      });
    });
  });

  describe('delete', () => {
    const mockOrg = {
      id: 'org-456',
      name: 'Test Org',
      slug: 'test-org',
    };

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
    });

    it('should delete organization when it has no projects', async () => {
      mockPrismaService.project.count.mockResolvedValue(0);
      mockPrismaService.organization.delete.mockResolvedValue(mockOrg);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.delete('test-org', 'user-123');

      expect(mockPrismaService.organization.delete).toHaveBeenCalledWith({
        where: { id: mockOrg.id },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.ORGANIZATION_DELETE,
        targetType: 'Organization',
        targetId: mockOrg.id,
        metadata: { orgSlug: 'test-org' },
      });
    });

    it('should throw ForbiddenException when organization has projects', async () => {
      mockPrismaService.project.count.mockResolvedValue(5);

      await expect(service.delete('test-org', 'user-123')).rejects.toThrow(
        new ForbiddenException(
          'Cannot delete organization "test-org" with 5 existing project(s). Please delete all projects first.',
        ),
      );
      expect(mockPrismaService.organization.delete).not.toHaveBeenCalled();
    });
  });

  describe('getMembers', () => {
    it('should return organization members', async () => {
      const mockOrg = { id: 'org-456', slug: 'test-org' };
      const mockMembers = [
        {
          organizationId: 'org-456',
          userId: 'user-1',
          role: OrgRole.OWNER,
          user: { id: 'user-1', email: 'owner@example.com' },
        },
        {
          organizationId: 'org-456',
          userId: 'user-2',
          role: OrgRole.MEMBER,
          user: { id: 'user-2', email: 'member@example.com' },
        },
      ];
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrismaService.organizationMembership.findMany.mockResolvedValue(mockMembers);

      const result = await service.getMembers('test-org');

      expect(result).toEqual(mockMembers);
      expect(mockPrismaService.organizationMembership.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrg.id },
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('addMember', () => {
    const mockOrg = { id: 'org-456', slug: 'test-org' };
    const mockUser = { id: 'user-789', email: 'newmember@example.com' };

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(null);
    });

    it('should add new member to organization', async () => {
      const mockMembership = {
        id: 'membership-123',
        organizationId: mockOrg.id,
        userId: mockUser.id,
        role: OrgRole.MEMBER,
        user: mockUser,
      };
      mockPrismaService.organizationMembership.create.mockResolvedValue(mockMembership);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.addMember('test-org', mockUser.email, OrgRole.MEMBER, 'admin-123');

      expect(result).toEqual(mockMembership);
      expect(mockPrismaService.organizationMembership.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrg.id,
          userId: mockUser.id,
          role: OrgRole.MEMBER,
        },
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'admin-123',
        action: AuditAction.ORGANIZATION_MEMBER_ADD,
        targetType: 'OrganizationMembership',
        targetId: mockMembership.id,
        metadata: { orgSlug: 'test-org', memberEmail: mockUser.email, role: OrgRole.MEMBER },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.addMember('test-org', 'nonexistent@example.com', OrgRole.MEMBER, 'admin-123'))
        .rejects.toThrow(new NotFoundException('User with email "nonexistent@example.com" not found'));
    });

    it('should throw ConflictException when user is already a member', async () => {
      const existingMembership = {
        organizationId: mockOrg.id,
        userId: mockUser.id,
        role: OrgRole.MEMBER,
      };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(existingMembership);

      await expect(service.addMember('test-org', mockUser.email, OrgRole.MEMBER, 'admin-123'))
        .rejects.toThrow(new ConflictException(`User "${mockUser.email}" is already a member of this organization`));
    });
  });

  describe('removeMember', () => {
    const mockOrg = { id: 'org-456', slug: 'test-org' };
    const mockMembership = {
      id: 'membership-123',
      organizationId: mockOrg.id,
      userId: 'user-789',
      role: OrgRole.MEMBER,
      user: { id: 'user-789', email: 'member@example.com' },
    };

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
    });

    it('should remove member from organization', async () => {
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockPrismaService.organizationMembership.delete.mockResolvedValue(mockMembership);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.removeMember('test-org', 'user-789', 'admin-123');

      expect(mockPrismaService.organizationMembership.delete).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: mockOrg.id,
            userId: 'user-789',
          },
        },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'admin-123',
        action: AuditAction.ORGANIZATION_MEMBER_REMOVE,
        targetType: 'OrganizationMembership',
        targetId: mockMembership.id,
        metadata: { orgSlug: 'test-org', memberEmail: mockMembership.user.email },
      });
    });

    it('should throw NotFoundException when member does not exist', async () => {
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('test-org', 'non-existent', 'admin-123'))
        .rejects.toThrow(new NotFoundException('Member not found in this organization'));
    });

    it('should throw ForbiddenException when removing last OWNER', async () => {
      const ownerMembership = {
        ...mockMembership,
        role: OrgRole.OWNER,
      };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(ownerMembership);
      mockPrismaService.organizationMembership.count.mockResolvedValue(1); // Only 1 owner

      await expect(service.removeMember('test-org', 'user-789', 'admin-123'))
        .rejects.toThrow(new ForbiddenException('Cannot remove the last OWNER of the organization'));
      expect(mockPrismaService.organizationMembership.delete).not.toHaveBeenCalled();
    });

    it('should allow removing OWNER when there are multiple owners', async () => {
      const ownerMembership = {
        ...mockMembership,
        role: OrgRole.OWNER,
      };
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(ownerMembership);
      mockPrismaService.organizationMembership.count.mockResolvedValue(2); // 2 owners
      mockPrismaService.organizationMembership.delete.mockResolvedValue(ownerMembership);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.removeMember('test-org', 'user-789', 'admin-123');

      expect(mockPrismaService.organizationMembership.delete).toHaveBeenCalled();
    });
  });

  describe('getProjects', () => {
    it('should return organization projects', async () => {
      const mockOrg = { id: 'org-456', slug: 'test-org' };
      const mockProjects = [
        { id: 'project-1', key: 'proj1', name: 'Project 1', branches: [] },
        { id: 'project-2', key: 'proj2', name: 'Project 2', branches: [] },
      ];
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const result = await service.getProjects('test-org');

      expect(result).toEqual(mockProjects);
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrg.id },
        include: {
          branches: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
