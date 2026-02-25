import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthorizationService } from './authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, ProjectRole } from '@prisma/client';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    projectMembership: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default to COMPAT mode
    mockConfigService.get.mockReturnValue('COMPAT');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('canAccessProject', () => {
    const userId = 'user-123';
    const projectId = 'project-456';

    it('should allow access for ADMIN users in COMPAT mode', async () => {
      mockConfigService.get.mockReturnValue('COMPAT');
      const result = await service.canAccessProject(userId, projectId, UserRole.ADMIN);
      expect(result).toBe(true);
    });

    it('should allow access for ADMIN users in STRICT mode', async () => {
      mockConfigService.get.mockReturnValue('STRICT');
      const result = await service.canAccessProject(userId, projectId, UserRole.ADMIN);
      expect(result).toBe(true);
      expect(mockPrismaService.projectMembership.findUnique).not.toHaveBeenCalled();
    });

    it('should allow access for any authenticated user in COMPAT mode', async () => {
      mockConfigService.get.mockReturnValue('COMPAT');
      const result = await service.canAccessProject(userId, projectId, UserRole.USER);
      expect(result).toBe(true);
    });

    it('should require membership in STRICT mode for non-admin users', async () => {
      // Create a new service instance with STRICT mode
      mockConfigService.get.mockReturnValue('STRICT');
      const strictModule = await Test.createTestingModule({
        providers: [
          AuthorizationService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const strictService = strictModule.get<AuthorizationService>(AuthorizationService);

      mockPrismaService.projectMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
        userId,
        projectId,
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date(),
      });

      const result = await strictService.canAccessProject(userId, projectId, UserRole.USER);

      expect(result).toBe(true);
      expect(mockPrismaService.projectMembership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      });
    });

    it('should deny access in STRICT mode when no membership exists', async () => {
      mockConfigService.get.mockReturnValue('STRICT');
      const strictModule = await Test.createTestingModule({
        providers: [
          AuthorizationService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const strictService = strictModule.get<AuthorizationService>(AuthorizationService);

      mockPrismaService.projectMembership.findUnique.mockResolvedValue(null);

      const result = await strictService.canAccessProject(userId, projectId, UserRole.USER);

      expect(result).toBe(false);
    });

    it('should check required roles when specified in STRICT mode', async () => {
      mockConfigService.get.mockReturnValue('STRICT');
      const strictModule = await Test.createTestingModule({
        providers: [
          AuthorizationService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const strictService = strictModule.get<AuthorizationService>(AuthorizationService);

      mockPrismaService.projectMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
        userId,
        projectId,
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date(),
      });

      const resultAllowed = await strictService.canAccessProject(userId, projectId, UserRole.USER, [
        ProjectRole.PROJECT_VIEWER,
        ProjectRole.PROJECT_ADMIN,
      ]);
      expect(resultAllowed).toBe(true);

      const resultDenied = await strictService.canAccessProject(userId, projectId, UserRole.USER, [
        ProjectRole.PROJECT_ADMIN,
      ]);
      expect(resultDenied).toBe(false);
    });
  });

  describe('mode checks', () => {
    it('should return COMPAT mode by default', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const newService = new AuthorizationService(prismaService, configService);
      expect(newService.getAuthzMode()).toBe('COMPAT');
      expect(newService.isCompatMode()).toBe(true);
      expect(newService.isStrictMode()).toBe(false);
    });

    it('should return STRICT mode when configured', () => {
      mockConfigService.get.mockReturnValue('STRICT');
      const newService = new AuthorizationService(prismaService, configService);
      expect(newService.getAuthzMode()).toBe('STRICT');
      expect(newService.isStrictMode()).toBe(true);
      expect(newService.isCompatMode()).toBe(false);
    });
  });

  describe('getProjectMembership', () => {
    it('should return membership when it exists', async () => {
      const userId = 'user-123';
      const projectId = 'project-456';
      const mockMembership = {
        id: 'membership-1',
        userId,
        projectId,
        role: ProjectRole.PROJECT_ADMIN,
        createdAt: new Date(),
      };

      mockPrismaService.projectMembership.findUnique.mockResolvedValue(mockMembership);

      const result = await service.getProjectMembership(userId, projectId);
      expect(result).toEqual(mockMembership);
    });

    it('should return null when membership does not exist', async () => {
      mockPrismaService.projectMembership.findUnique.mockResolvedValue(null);
      const result = await service.getProjectMembership('user-123', 'project-456');
      expect(result).toBeNull();
    });
  });

  describe('hasProjectRole', () => {
    it('should return true when user has the specified role', async () => {
      mockPrismaService.projectMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
        userId: 'user-123',
        projectId: 'project-456',
        role: ProjectRole.PROJECT_ADMIN,
        createdAt: new Date(),
      });

      const result = await service.hasProjectRole(
        'user-123',
        'project-456',
        ProjectRole.PROJECT_ADMIN,
      );
      expect(result).toBe(true);
    });

    it('should return false when user has a different role', async () => {
      mockPrismaService.projectMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
        userId: 'user-123',
        projectId: 'project-456',
        role: ProjectRole.PROJECT_VIEWER,
        createdAt: new Date(),
      });

      const result = await service.hasProjectRole(
        'user-123',
        'project-456',
        ProjectRole.PROJECT_ADMIN,
      );
      expect(result).toBe(false);
    });
  });
});
