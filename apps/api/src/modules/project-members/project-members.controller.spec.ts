import { Test, TestingModule } from '@nestjs/testing';
import { ProjectMembersController } from './project-members.controller';
import { ProjectMembersService } from './project-members.service';
import { ProjectRole } from '@prisma/client';
import { ProjectMembershipGuard } from '../authorization/guards/project-membership.guard';

describe('ProjectMembersController', () => {
  let controller: ProjectMembersController;
  let service: ProjectMembersService;

  const mockProjectMembersService = {
    getProjectMembers: jest.fn(),
    addMember: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectMembersController],
      providers: [
        {
          provide: ProjectMembersService,
          useValue: mockProjectMembersService,
        },
      ],
    })
      .overrideGuard(ProjectMembershipGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ProjectMembersController>(ProjectMembersController);
    service = module.get<ProjectMembersService>(ProjectMembersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMembers', () => {
    it('should return project members', async () => {
      const projectKey = 'test-project';
      const mockMembers = [
        {
          id: 'member-1',
          userId: 'user-1',
          projectId: 'project-1',
          role: ProjectRole.PROJECT_ADMIN,
          createdAt: new Date().toISOString(),
          user: { id: 'user-1', email: 'admin@example.com' },
        },
      ];

      mockProjectMembersService.getProjectMembers.mockResolvedValue(mockMembers);

      const result = await controller.getMembers(projectKey);

      expect(result).toEqual(mockMembers);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.getProjectMembers).toHaveBeenCalledWith(projectKey);
    });
  });

  describe('addMember', () => {
    it('should add a new member', async () => {
      const projectKey = 'test-project';
      const dto = {
        email: 'newuser@example.com',
        role: ProjectRole.PROJECT_VIEWER,
      };

      const mockMember = {
        id: 'member-2',
        userId: 'user-2',
        projectId: 'project-1',
        role: dto.role,
        createdAt: new Date().toISOString(),
        user: { id: 'user-2', email: dto.email },
      };

      mockProjectMembersService.addMember.mockResolvedValue(mockMember);

      const result = await controller.addMember(projectKey, dto, undefined);

      expect(result).toEqual(mockMember);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.addMember).toHaveBeenCalledWith(projectKey, dto, undefined);
    });
  });

  describe('updateMember', () => {
    it('should update member role', async () => {
      const projectKey = 'test-project';
      const memberId = 'member-1';
      const dto = { role: ProjectRole.PROJECT_MAINTAINER };

      const mockUpdatedMember = {
        id: memberId,
        userId: 'user-1',
        projectId: 'project-1',
        role: dto.role,
        createdAt: new Date().toISOString(),
        user: { id: 'user-1', email: 'user@example.com' },
      };

      mockProjectMembersService.updateMember.mockResolvedValue(mockUpdatedMember);

      const result = await controller.updateMember(projectKey, memberId, dto, undefined);

      expect(result).toEqual(mockUpdatedMember);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.updateMember).toHaveBeenCalledWith(projectKey, memberId, dto, undefined);
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      const projectKey = 'test-project';
      const memberId = 'member-1';

      mockProjectMembersService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember(projectKey, memberId, undefined);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.removeMember).toHaveBeenCalledWith(projectKey, memberId, undefined);
    });
  });
});
