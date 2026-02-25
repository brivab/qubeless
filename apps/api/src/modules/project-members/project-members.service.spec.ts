import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectMembersService } from './project-members.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { ProjectRole, AuditAction } from '@prisma/client';

describe('ProjectMembersService', () => {
  let service: ProjectMembersService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    projectMembership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectMembersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProjectMembersService>(ProjectMembersService);

    jest.clearAllMocks();
  });

  describe('getProjectMembers', () => {
    it('should return all project members', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        name: 'Test Project',
      };

      const mockMemberships = [
        {
          id: 'member-1',
          userId: 'user-1',
          projectId: 'project-123',
          role: ProjectRole.PROJECT_ADMIN,
          createdAt: new Date('2024-01-01'),
          user: { id: 'user-1', email: 'admin@example.com' },
        },
        {
          id: 'member-2',
          userId: 'user-2',
          projectId: 'project-123',
          role: ProjectRole.PROJECT_VIEWER,
          createdAt: new Date('2024-01-02'),
          user: { id: 'user-2', email: 'viewer@example.com' },
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectMembership.findMany.mockResolvedValue(mockMemberships);

      const result = await service.getProjectMembers('TEST_PROJECT');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'member-1',
        userId: 'user-1',
        projectId: 'project-123',
        role: ProjectRole.PROJECT_ADMIN,
        createdAt: new Date('2024-01-01').toISOString(),
        user: { id: 'user-1', email: 'admin@example.com' },
      });
      expect(mockPrismaService.projectMembership.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-123' },
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
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectMembers('NONEXISTENT')).rejects.toThrow(
        new NotFoundException('Project with key "NONEXISTENT" not found'),
      );
    });
  });

  describe('addMember', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
    };

    const mockUser = {
      id: 'user-123',
      email: 'newmember@example.com',
    };

    const dto = {
      email: 'newmember@example.com',
      role: ProjectRole.PROJECT_VIEWER,
    };

    it('should add a new member to the project', async () => {
      const mockMembership = {
        id: 'member-123',
        userId: 'user-123',
        projectId: 'project-123',
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date('2024-01-01'),
        user: { id: 'user-123', email: 'newmember@example.com' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMembership.create.mockResolvedValue(mockMembership);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.addMember('TEST_PROJECT', dto, 'actor-123');

      expect(result).toEqual({
        id: 'member-123',
        userId: 'user-123',
        projectId: 'project-123',
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date('2024-01-01').toISOString(),
        user: { id: 'user-123', email: 'newmember@example.com' },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'actor-123',
        action: AuditAction.PROJECT_MEMBER_ADD,
        targetType: 'ProjectMembership',
        targetId: 'member-123',
        metadata: {
          projectKey: 'TEST_PROJECT',
          projectId: 'project-123',
          memberEmail: 'newmember@example.com',
          memberUserId: 'user-123',
          role: ProjectRole.PROJECT_VIEWER,
        },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.addMember('NONEXISTENT', dto)).rejects.toThrow(
        new NotFoundException('Project with key "NONEXISTENT" not found'),
      );
    });

    it('should throw BadRequestException when user does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.addMember('TEST_PROJECT', dto)).rejects.toThrow(
        new BadRequestException(
          'User with email "newmember@example.com" not found. Please ensure the user exists before adding them to the project.',
        ),
      );
    });

    it('should throw ConflictException when membership already exists', async () => {
      const existingMembership = {
        id: 'member-existing',
        userId: 'user-123',
        projectId: 'project-123',
        role: ProjectRole.PROJECT_ADMIN,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(existingMembership);

      await expect(service.addMember('TEST_PROJECT', dto)).rejects.toThrow(
        new ConflictException('User "newmember@example.com" is already a member of this project'),
      );
    });
  });

  describe('updateMember', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
    };

    const dto = {
      role: ProjectRole.PROJECT_MAINTAINER,
    };

    it('should update member role', async () => {
      const existingMembership = {
        id: 'member-123',
        userId: 'user-123',
        projectId: 'project-123',
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date('2024-01-01'),
        user: { id: 'user-123', email: 'member@example.com' },
      };

      const updatedMembership = {
        ...existingMembership,
        role: ProjectRole.PROJECT_MAINTAINER,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(existingMembership);
      mockPrismaService.projectMembership.update.mockResolvedValue(updatedMembership);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.updateMember('TEST_PROJECT', 'member-123', dto, 'actor-123');

      expect(result.role).toBe(ProjectRole.PROJECT_MAINTAINER);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'actor-123',
        action: AuditAction.PROJECT_MEMBER_UPDATE,
        targetType: 'ProjectMembership',
        targetId: 'member-123',
        metadata: {
          projectKey: 'TEST_PROJECT',
          projectId: 'project-123',
          memberEmail: 'member@example.com',
          memberUserId: 'user-123',
          oldRole: ProjectRole.PROJECT_VIEWER,
          newRole: ProjectRole.PROJECT_MAINTAINER,
        },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.updateMember('NONEXISTENT', 'member-123', dto)).rejects.toThrow(
        new NotFoundException('Project with key "NONEXISTENT" not found'),
      );
    });

    it('should throw NotFoundException when member does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(null);

      await expect(service.updateMember('TEST_PROJECT', 'nonexistent-member', dto)).rejects.toThrow(
        new NotFoundException('Member with id "nonexistent-member" not found'),
      );
    });

    it('should throw BadRequestException when member does not belong to project', async () => {
      const membershipFromDifferentProject = {
        id: 'member-123',
        userId: 'user-123',
        projectId: 'different-project-id',
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date('2024-01-01'),
        user: { id: 'user-123', email: 'member@example.com' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(
        membershipFromDifferentProject,
      );

      await expect(service.updateMember('TEST_PROJECT', 'member-123', dto)).rejects.toThrow(
        new BadRequestException('Member does not belong to this project'),
      );
    });
  });

  describe('removeMember', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
    };

    it('should remove a member from the project', async () => {
      const existingMembership = {
        id: 'member-123',
        userId: 'user-123',
        projectId: 'project-123',
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date('2024-01-01'),
        user: { id: 'user-123', email: 'member@example.com' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(existingMembership);
      mockPrismaService.projectMembership.delete.mockResolvedValue(existingMembership);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.removeMember('TEST_PROJECT', 'member-123', 'actor-123');

      expect(mockPrismaService.projectMembership.delete).toHaveBeenCalledWith({
        where: { id: 'member-123' },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'actor-123',
        action: AuditAction.PROJECT_MEMBER_REMOVE,
        targetType: 'ProjectMembership',
        targetId: 'member-123',
        metadata: {
          projectKey: 'TEST_PROJECT',
          projectId: 'project-123',
          memberEmail: 'member@example.com',
          memberUserId: 'user-123',
          role: ProjectRole.PROJECT_VIEWER,
        },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('NONEXISTENT', 'member-123')).rejects.toThrow(
        new NotFoundException('Project with key "NONEXISTENT" not found'),
      );
    });

    it('should throw NotFoundException when member does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('TEST_PROJECT', 'nonexistent-member')).rejects.toThrow(
        new NotFoundException('Member with id "nonexistent-member" not found'),
      );
    });

    it('should throw BadRequestException when member does not belong to project', async () => {
      const membershipFromDifferentProject = {
        id: 'member-123',
        userId: 'user-123',
        projectId: 'different-project-id',
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date('2024-01-01'),
        user: { id: 'user-123', email: 'member@example.com' },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(
        membershipFromDifferentProject,
      );

      await expect(service.removeMember('TEST_PROJECT', 'member-123')).rejects.toThrow(
        new BadRequestException('Member does not belong to this project'),
      );
    });
  });
});
