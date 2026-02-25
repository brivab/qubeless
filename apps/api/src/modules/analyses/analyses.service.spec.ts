import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AnalyzersService } from '../analyzers/analyzers.service';
import { AnalysisQueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CoverageService } from '../coverage/coverage.service';
import { TechnicalDebtService } from './technical-debt.service';
import { AnalysisStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-unused-vars */
describe('AnalysesService - Quota Management', () => {
  let service: AnalysesService;
  let _prismaService: PrismaService;
  let _projectsService: ProjectsService;
  let _analyzersService: AnalyzersService;
  let _queueService: AnalysisQueueService;

  const mockPrismaService = {
    analysis: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
  };

  const mockProjectsService = {
    getByKeyOrThrow: jest.fn(),
  };

  const mockAnalyzersService = {
    listForProject: jest.fn(),
  };

  const mockQueueService = {
    enqueueAnalysis: jest.fn(),
  };

  const mockStorageService = {
    uploadBuffer: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockCoverageService = {
    processCoverageFile: jest.fn(),
  };

  const mockTechnicalDebtService = {
    calculateDebtRatio: jest.fn(),
    formatTime: jest.fn(),
  };

  beforeEach(async () => {
    // Set environment variables for testing
    process.env.MAX_RUNNING_ANALYSES = '5';
    process.env.MAX_RUNNING_PER_PROJECT = '2';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: AnalyzersService, useValue: mockAnalyzersService },
        { provide: AnalysisQueueService, useValue: mockQueueService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CoverageService, useValue: mockCoverageService },
        { provide: TechnicalDebtService, useValue: mockTechnicalDebtService },
      ],
    }).compile();

    service = module.get<AnalysesService>(AnalysesService);
    _prismaService = module.get<PrismaService>(PrismaService);
    _projectsService = module.get<ProjectsService>(ProjectsService);
    _analyzersService = module.get<AnalyzersService>(AnalyzersService);
    _queueService = module.get<AnalysisQueueService>(AnalysisQueueService);

    jest.clearAllMocks();
  });

  describe('Quota validation', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
      description: null,
      leakPeriodType: 'LAST_ANALYSIS',
      leakPeriodValue: null,
      activeRuleProfileId: null,
      createdAt: new Date(),
    };

    const mockBranch = {
      id: 'branch-123',
      name: 'main',
      isDefault: true,
      projectId: 'project-123',
      createdAt: new Date(),
    };

    const mockAnalysis = {
      id: 'analysis-123',
      projectId: 'project-123',
      branchId: 'branch-123',
      pullRequestId: null,
      baselineAnalysisId: null,
      commitSha: 'abc123',
      status: AnalysisStatus.PENDING,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      branch: mockBranch,
      project: mockProject,
      pullRequest: null,
    };

    const createAnalysisDto = {
      commitSha: 'abc123',
      branch: 'main',
    };

    beforeEach(() => {
      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockPrismaService.analysis.create.mockResolvedValue(mockAnalysis);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockAnalyzersService.listForProject.mockResolvedValue([]);
      mockQueueService.enqueueAnalysis.mockResolvedValue(undefined);
    });

    it('should allow analysis creation when quotas are not exceeded', async () => {
      // No running analyses
      mockPrismaService.analysis.count.mockResolvedValue(0);

      const result = await service.createForProject('TEST_PROJECT', createAnalysisDto);

      expect(result).toEqual(mockAnalysis);
      expect(mockPrismaService.analysis.count).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.analysis.count).toHaveBeenNthCalledWith(1, {
        where: { status: AnalysisStatus.RUNNING },
      });
      expect(mockPrismaService.analysis.count).toHaveBeenNthCalledWith(2, {
        where: { projectId: 'project-123', status: AnalysisStatus.RUNNING },
      });
    });

    it('should throw 429 when global quota is exceeded', async () => {
      // 5 running analyses globally (at limit)
      mockPrismaService.analysis.count.mockResolvedValueOnce(5);

      await expect(service.createForProject('TEST_PROJECT', createAnalysisDto)).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Maximum concurrent analyses limit reached (5 running). Please wait for some analyses to complete.',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      expect(mockPrismaService.analysis.count).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.analysis.create).not.toHaveBeenCalled();
    });

    it('should throw 429 when project quota is exceeded', async () => {
      // 3 running analyses globally (under global limit)
      mockPrismaService.analysis.count.mockResolvedValueOnce(3);
      // 2 running analyses for this project (at project limit)
      mockPrismaService.analysis.count.mockResolvedValueOnce(2);

      await expect(service.createForProject('TEST_PROJECT', createAnalysisDto)).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Maximum concurrent analyses per project limit reached (2 running for this project). Please wait for some analyses to complete.',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      expect(mockPrismaService.analysis.count).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.analysis.create).not.toHaveBeenCalled();
    });

    it('should allow analysis when just under global quota', async () => {
      // 4 running analyses globally (just under limit of 5)
      mockPrismaService.analysis.count.mockResolvedValueOnce(4);
      // 1 running analysis for this project (under project limit of 2)
      mockPrismaService.analysis.count.mockResolvedValueOnce(1);

      const result = await service.createForProject('TEST_PROJECT', createAnalysisDto);

      expect(result).toEqual(mockAnalysis);
      expect(mockPrismaService.analysis.create).toHaveBeenCalled();
    });

    it('should allow analysis when just under project quota', async () => {
      // 2 running analyses globally (under global limit)
      mockPrismaService.analysis.count.mockResolvedValueOnce(2);
      // 1 running analysis for this project (just under limit of 2)
      mockPrismaService.analysis.count.mockResolvedValueOnce(1);

      const result = await service.createForProject('TEST_PROJECT', createAnalysisDto);

      expect(result).toEqual(mockAnalysis);
      expect(mockPrismaService.analysis.create).toHaveBeenCalled();
    });

    it('should check quotas for different projects independently', async () => {
      const project2 = { ...mockProject, id: 'project-456', key: 'OTHER_PROJECT' };

      // Global: 4 running (under limit)
      mockPrismaService.analysis.count.mockResolvedValueOnce(4);
      // Project 1: 0 running (under limit)
      mockPrismaService.analysis.count.mockResolvedValueOnce(0);

      mockProjectsService.getByKeyOrThrow.mockResolvedValueOnce(mockProject);

      const result1 = await service.createForProject('TEST_PROJECT', createAnalysisDto);
      expect(result1).toEqual(mockAnalysis);

      // Reset for second call
      jest.clearAllMocks();
      mockProjectsService.getByKeyOrThrow.mockResolvedValueOnce(project2);
      mockPrismaService.branch.findFirst.mockResolvedValue({
        ...mockBranch,
        projectId: 'project-456',
      });
      mockPrismaService.analysis.create.mockResolvedValue({
        ...mockAnalysis,
        projectId: 'project-456',
      });
      mockPrismaService.project.findUnique.mockResolvedValue(project2);
      mockAnalyzersService.listForProject.mockResolvedValue([]);

      // Global: 5 running (at limit)
      mockPrismaService.analysis.count.mockResolvedValueOnce(5);

      await expect(service.createForProject('OTHER_PROJECT', createAnalysisDto)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('Default quota values', () => {
    it('should use default values when env vars are not set', async () => {
      delete process.env.MAX_RUNNING_ANALYSES;
      delete process.env.MAX_RUNNING_PER_PROJECT;

      // Create a new service instance to pick up the defaults
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AnalysesService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ProjectsService, useValue: mockProjectsService },
          { provide: AnalyzersService, useValue: mockAnalyzersService },
          { provide: AnalysisQueueService, useValue: mockQueueService },
          { provide: StorageService, useValue: mockStorageService },
          { provide: AuditService, useValue: mockAuditService },
          { provide: CoverageService, useValue: mockCoverageService },
          { provide: TechnicalDebtService, useValue: mockTechnicalDebtService },
        ],
      }).compile();

      const newService = module.get<AnalysesService>(AnalysesService);

      // Access private properties for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const maxRunningAnalyses = (newService as any).maxRunningAnalyses;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const maxRunningPerProject = (newService as any).maxRunningPerProject;

      expect(maxRunningAnalyses).toBe(5);
      expect(maxRunningPerProject).toBe(2);
    });
  });

  describe('Analyzer filtering', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
      description: null,
      leakPeriodType: 'LAST_ANALYSIS',
      leakPeriodValue: null,
      activeRuleProfileId: null,
      createdAt: new Date(),
    };

    const mockBranch = {
      id: 'branch-123',
      name: 'main',
      isDefault: true,
      projectId: 'project-123',
      createdAt: new Date(),
    };

    const mockAnalysis = {
      id: 'analysis-123',
      projectId: 'project-123',
      branchId: 'branch-123',
      pullRequestId: null,
      baselineAnalysisId: null,
      commitSha: 'abc123',
      status: AnalysisStatus.PENDING,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      branch: mockBranch,
      project: mockProject,
      pullRequest: null,
    };

    const mockAnalyzers = [
      {
        analyzer: {
          id: 'analyzer-1',
          key: 'eslint',
          name: 'ESLint',
          dockerImage: 'qubeless/eslint:latest',
          enabled: true,
        },
        effectiveEnabled: true,
        projectEnabled: true,
        configJson: null,
      },
      {
        analyzer: {
          id: 'analyzer-2',
          key: 'semgrep',
          name: 'Semgrep',
          dockerImage: 'qubeless/semgrep:latest',
          enabled: true,
        },
        effectiveEnabled: true,
        projectEnabled: true,
        configJson: null,
      },
      {
        analyzer: {
          id: 'analyzer-3',
          key: 'trivy',
          name: 'Trivy',
          dockerImage: 'qubeless/trivy:latest',
          enabled: true,
        },
        effectiveEnabled: true,
        projectEnabled: true,
        configJson: null,
      },
    ];

    beforeEach(() => {
      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockPrismaService.analysis.create.mockResolvedValue(mockAnalysis);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.analysis.count.mockResolvedValue(0);
      mockAnalyzersService.listForProject.mockResolvedValue(mockAnalyzers);
      mockQueueService.enqueueAnalysis.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
    });

    it('should use all active analyzers when analyzerIds is not provided', async () => {
      const createAnalysisDto = {
        commitSha: 'abc123',
        branch: 'main',
      };

      await service.createForProject('TEST_PROJECT', createAnalysisDto);

      expect(mockQueueService.enqueueAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          analyzers: [
            { key: 'eslint', dockerImage: 'qubeless/eslint:latest', configJson: undefined },
            { key: 'semgrep', dockerImage: 'qubeless/semgrep:latest', configJson: undefined },
            { key: 'trivy', dockerImage: 'qubeless/trivy:latest', configJson: undefined },
          ],
        }),
      );
    });

    it('should filter analyzers when analyzerIds is provided', async () => {
      const createAnalysisDto = {
        commitSha: 'abc123',
        branch: 'main',
        analyzerIds: ['analyzer-1', 'analyzer-3'],
      };

      await service.createForProject('TEST_PROJECT', createAnalysisDto);

      expect(mockQueueService.enqueueAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          analyzers: [
            { key: 'eslint', dockerImage: 'qubeless/eslint:latest', configJson: undefined },
            { key: 'trivy', dockerImage: 'qubeless/trivy:latest', configJson: undefined },
          ],
        }),
      );
    });

    it('should throw error when invalid analyzerIds are provided', async () => {
      const createAnalysisDto = {
        commitSha: 'abc123',
        branch: 'main',
        analyzerIds: ['analyzer-1', 'invalid-id'],
      };

      await expect(service.createForProject('TEST_PROJECT', createAnalysisDto)).rejects.toThrow(
        'The following analyzer IDs are not found or not active for this project: invalid-id',
      );

      expect(mockQueueService.enqueueAnalysis).not.toHaveBeenCalled();
    });

    it('should throw error when all provided analyzerIds are invalid', async () => {
      const createAnalysisDto = {
        commitSha: 'abc123',
        branch: 'main',
        analyzerIds: ['invalid-1', 'invalid-2'],
      };

      await expect(service.createForProject('TEST_PROJECT', createAnalysisDto)).rejects.toThrow(
        'The following analyzer IDs are not found or not active for this project: invalid-1, invalid-2',
      );

      expect(mockQueueService.enqueueAnalysis).not.toHaveBeenCalled();
    });
  });
});
