import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LanguageDetectionService } from './language-detection.service';
import { LeakPeriodType, AuditAction } from '@prisma/client';

describe('ProjectsService', () => {
  let service: ProjectsService;

  const mockPrismaService = {
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
    },
    analysisMetric: {
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockLanguageDetectionService = {
    detectLanguages: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: LanguageDetectionService, useValue: mockLanguageDetectionService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a project with default branch and rule profile', async () => {
      const createDto = {
        key: 'TEST_PROJECT',
        name: 'Test Project',
        description: 'A test project',
        organizationId: 'org-123',
      };

      const mockProject = {
        id: 'project-123',
        key: createDto.key,
        name: createDto.name,
        description: createDto.description,
        organizationId: 'org-123',
        leakPeriodType: LeakPeriodType.LAST_ANALYSIS,
        leakPeriodValue: null,
        activeRuleProfileId: 'profile-123',
        createdAt: new Date(),
        branches: [
          {
            id: 'branch-123',
            name: 'main',
            isDefault: true,
            projectId: 'project-123',
            createdAt: new Date(),
          },
        ],
      };

      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        name: 'Test Org',
        slug: 'test-org',
      });

      mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          project: {
            create: jest.fn().mockResolvedValue({
              id: 'project-123',
              key: createDto.key,
              name: createDto.name,
            }),
            update: jest.fn().mockResolvedValue({}),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockProject),
          },
          ruleProfile: {
            create: jest.fn().mockResolvedValue({ id: 'profile-123' }),
          },
          projectMembership: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create(createDto, 'user-123');

      expect(result).toEqual(mockProject);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.PROJECT_CREATE,
        targetType: 'Project',
        targetId: 'project-123',
        metadata: {
          projectKey: createDto.key,
          projectName: createDto.name,
          organizationId: 'org-123',
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all projects with branches and quality gates', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          key: 'PROJ1',
          name: 'Project 1',
          branches: [{ id: 'branch-1', name: 'main', isDefault: true }],
          qualityGates: [{ id: 'qg-1', conditions: [] }],
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'project-2',
          key: 'PROJ2',
          name: 'Project 2',
          branches: [{ id: 'branch-2', name: 'main', isDefault: true }],
          qualityGates: [],
          createdAt: new Date('2024-01-02'),
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const result = await service.findAll();

      expect(result).toEqual(mockProjects);
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: {
          branches: true,
          qualityGates: {
            include: { conditions: true },
          },
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findByKey', () => {
    it('should find a project by key', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        name: 'Test Project',
        branches: [],
        qualityGates: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findByKey('TEST_PROJECT');

      expect(result).toEqual(mockProject);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { key: 'TEST_PROJECT' },
        include: {
          branches: true,
          qualityGates: {
            include: { conditions: true },
          },
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    });

    it('should return null when project is not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      const result = await service.findByKey('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('getByKeyOrThrow', () => {
    it('should return project when found', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        name: 'Test Project',
        branches: [],
        qualityGates: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.getByKeyOrThrow('TEST_PROJECT');

      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project is not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getByKeyOrThrow('NONEXISTENT')).rejects.toThrow(
        new NotFoundException('Project with key "NONEXISTENT" not found'),
      );
    });
  });

  describe('ensureActiveRuleProfile', () => {
    it('should return existing active rule profile', async () => {
      const mockProject = {
        id: 'project-123',
        activeRuleProfileId: 'profile-123',
      };

      const mockProfile = {
        id: 'profile-123',
        name: 'Default',
        projectId: 'project-123',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      const prismaMock = mockPrismaService as typeof mockPrismaService & {
        ruleProfile: { findUnique: jest.Mock };
      };
      prismaMock.ruleProfile = {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
      };

      const result = await service.ensureActiveRuleProfile('project-123');

      expect(result).toEqual(mockProfile);
    });

    it('should create and activate a new rule profile when none exists', async () => {
      const mockProject = {
        id: 'project-123',
        activeRuleProfileId: null,
      };

      const mockProfile = {
        id: 'profile-123',
        name: 'Default',
        projectId: 'project-123',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          ruleProfile: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockProfile),
            findUnique: jest.fn().mockResolvedValue(mockProfile),
          },
          project: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.ensureActiveRuleProfile('project-123');

      expect(result.id).toBe(mockProfile.id);
      expect(result.name).toBe(mockProfile.name);
      expect(result.projectId).toBe(mockProfile.projectId);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.ensureActiveRuleProfile('nonexistent')).rejects.toThrow(
        new NotFoundException('Project nonexistent not found'),
      );
    });
  });

  describe('listRulesWithEnabledState', () => {
    it('should return rules with enabled state from overrides', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      const mockProfile = {
        id: 'profile-123',
        name: 'Default',
        projectId: 'project-123',
      };

      const mockRules = [
        { key: 'rule-1', analyzerKey: 'eslint', name: 'No console' },
        { key: 'rule-2', analyzerKey: 'eslint', name: 'No debugger' },
        { key: 'rule-3', analyzerKey: 'eslint', name: 'No alert' },
      ];

      const mockOverrides = [
        { ruleKey: 'rule-1', enabled: false },
        { ruleKey: 'rule-2', enabled: true },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'project-123', activeRuleProfileId: 'profile-123' });
      const prismaMock = mockPrismaService as typeof mockPrismaService & {
        ruleProfile: { findUnique: jest.Mock; findMany: jest.Mock };
        rule: { findMany: jest.Mock };
        ruleProfileRule: { findMany: jest.Mock };
      };
      prismaMock.ruleProfile = {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
        findMany: jest.fn().mockResolvedValue([]),
      };
      prismaMock.rule = {
        findMany: jest.fn().mockResolvedValue(mockRules),
      };
      prismaMock.ruleProfileRule = {
        findMany: jest.fn().mockResolvedValue(mockOverrides),
      };

      const result = await service.listRulesWithEnabledState('TEST_PROJECT');

      expect(result.profile).toEqual(mockProfile);
      expect(result.rules).toEqual([
        { key: 'rule-1', analyzerKey: 'eslint', name: 'No console', enabled: false },
        { key: 'rule-2', analyzerKey: 'eslint', name: 'No debugger', enabled: true },
        { key: 'rule-3', analyzerKey: 'eslint', name: 'No alert', enabled: true }, // default to true
      ]);
    });

    it('should return empty array when no rules exist', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      const mockProfile = {
        id: 'profile-123',
        name: 'Default',
        projectId: 'project-123',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'project-123', activeRuleProfileId: 'profile-123' });
      const prismaMock2 = mockPrismaService as typeof mockPrismaService & {
        ruleProfile: { findUnique: jest.Mock };
        rule: { findMany: jest.Mock };
      };
      prismaMock2.ruleProfile = {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
      };
      prismaMock2.rule = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result = await service.listRulesWithEnabledState('TEST_PROJECT');

      expect(result.profile).toEqual(mockProfile);
      expect(result.rules).toEqual([]);
    });
  });

  describe('updateActiveRuleProfileRules', () => {
    it('should update rule enabled states', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      const mockProfile = {
        id: 'profile-123',
        name: 'Default',
        projectId: 'project-123',
      };

      const dto = {
        rules: [
          { ruleKey: 'rule-1', enabled: false },
          { ruleKey: 'rule-2', enabled: true },
        ],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'project-123', activeRuleProfileId: 'profile-123' });
      const prismaMock = mockPrismaService as typeof mockPrismaService & {
        ruleProfile: { findUnique: jest.Mock };
        rule: { findMany: jest.Mock };
      };
      prismaMock.ruleProfile = {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
      };
      prismaMock.rule = {
        findMany: jest.fn().mockResolvedValue([{ key: 'rule-1' }, { key: 'rule-2' }]),
      };
      mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          ruleProfileRule: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.updateActiveRuleProfileRules('TEST_PROJECT', dto);

      expect(result.profile).toEqual(mockProfile);
      expect(result.updated).toBe(2);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unknown rule keys', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      const mockProfile = {
        id: 'profile-123',
        name: 'Default',
        projectId: 'project-123',
      };

      const dto = {
        rules: [
          { ruleKey: 'rule-1', enabled: false },
          { ruleKey: 'unknown-rule', enabled: true },
        ],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'project-123', activeRuleProfileId: 'profile-123' });
      const prismaMock3 = mockPrismaService as typeof mockPrismaService & {
        ruleProfile: { findUnique: jest.Mock };
        rule: { findMany: jest.Mock };
      };
      prismaMock3.ruleProfile = {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
      };
      prismaMock3.rule = {
        findMany: jest.fn().mockResolvedValue([{ key: 'rule-1' }]),
      };

      await expect(service.updateActiveRuleProfileRules('TEST_PROJECT', dto)).rejects.toThrow(
        new BadRequestException('Règles inconnues: unknown-rule'),
      );
    });

    it('should return early when no rules provided', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      const mockProfile = {
        id: 'profile-123',
        name: 'Default',
        projectId: 'project-123',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'project-123', activeRuleProfileId: 'profile-123' });
      const prismaMock4 = mockPrismaService as typeof mockPrismaService & {
        ruleProfile: { findUnique: jest.Mock };
      };
      prismaMock4.ruleProfile = {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
      };

      const result = await service.updateActiveRuleProfileRules('TEST_PROJECT', { rules: [] });

      expect(result.profile).toEqual(mockProfile);
      expect(result.updated).toBe(0);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getSettings', () => {
    it('should return project settings', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        leakPeriodType: LeakPeriodType.LAST_ANALYSIS,
        leakPeriodValue: null,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.getSettings('TEST_PROJECT');

      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getSettings('NONEXISTENT')).rejects.toThrow(
        new NotFoundException('Project with key "NONEXISTENT" not found'),
      );
    });
  });

  describe('updateSettings', () => {
    it('should update leak period settings', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        leakPeriodType: LeakPeriodType.LAST_ANALYSIS,
        leakPeriodValue: null,
      };

      const updatedProject = {
        ...mockProject,
        leakPeriodType: LeakPeriodType.DATE,
        leakPeriodValue: '2024-01-01',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(updatedProject);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.updateSettings(
        'TEST_PROJECT',
        {
          leakPeriodType: LeakPeriodType.DATE,
          leakPeriodValue: '2024-01-01',
        },
        'user-123',
      );

      expect(result).toEqual(updatedProject);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.PROJECT_UPDATE,
        targetType: 'Project',
        targetId: 'project-123',
        metadata: {
          projectKey: 'TEST_PROJECT',
          changedFields: ['leakPeriodType', 'leakPeriodValue'],
        },
      });
    });
  });

  describe('getMetrics', () => {
    it('should return metrics ordered chronologically', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      const mockMetrics = [
        {
          createdAt: new Date('2024-01-03'),
          value: '30',
          metricKey: 'coverage',
          branchId: 'branch-123',
          analysisId: 'analysis-3',
        },
        {
          createdAt: new Date('2024-01-02'),
          value: '20',
          metricKey: 'coverage',
          branchId: 'branch-123',
          analysisId: 'analysis-2',
        },
        {
          createdAt: new Date('2024-01-01'),
          value: '10',
          metricKey: 'coverage',
          branchId: 'branch-123',
          analysisId: 'analysis-1',
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.analysisMetric.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getMetrics('TEST_PROJECT', {});

      // Should be reversed to ascending order
      expect(result[0].createdAt).toEqual(new Date('2024-01-01'));
      expect(result[1].createdAt).toEqual(new Date('2024-01-02'));
      expect(result[2].createdAt).toEqual(new Date('2024-01-03'));
    });

    it('should filter metrics by metricKey and branch', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      const mockBranch = {
        id: 'branch-123',
        name: 'main',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockPrismaService.analysisMetric.findMany.mockResolvedValue([]);

      await service.getMetrics('TEST_PROJECT', {
        metricKey: 'coverage',
        branch: 'main',
        limit: 10,
      });

      expect(mockPrismaService.analysisMetric.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          metricKey: 'coverage',
          branchId: 'branch-123',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          createdAt: true,
          value: true,
          metricKey: true,
          branchId: true,
          analysisId: true,
        },
      });
    });

    it('should use default limit of 50 when not specified', async () => {
      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        branches: [],
        qualityGates: [],
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.analysisMetric.findMany.mockResolvedValue([]);

      await service.getMetrics('TEST_PROJECT', {});

      expect(mockPrismaService.analysisMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });
  });
});
