import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnalyzersService } from './analyzers.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

describe('AnalyzersService', () => {
  let service: AnalyzersService;

  const mockPrismaService = {
    analyzer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    projectAnalyzer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockProjectsService = {
    getByKeyOrThrow: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AnalyzersService>(AnalyzersService);

    jest.clearAllMocks();
  });

  describe('listAllEnabled', () => {
    it('should return all enabled analyzers', async () => {
      const mockAnalyzers = [
        {
          id: 'analyzer-1',
          key: 'eslint',
          name: 'ESLint',
          dockerImage: 'eslint:latest',
          enabled: true,
          createdAt: new Date(),
        },
        {
          id: 'analyzer-2',
          key: 'prettier',
          name: 'Prettier',
          dockerImage: 'prettier:latest',
          enabled: true,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.analyzer.findMany.mockResolvedValue(mockAnalyzers);

      const result = await service.listAllEnabled();

      expect(result).toEqual(mockAnalyzers);
      expect(mockPrismaService.analyzer.findMany).toHaveBeenCalledWith({
        where: { enabled: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('listAll', () => {
    it('should return all analyzers', async () => {
      const mockAnalyzers = [
        {
          id: 'analyzer-1',
          key: 'eslint',
          name: 'ESLint',
          dockerImage: 'eslint:latest',
          enabled: true,
          createdAt: new Date(),
        },
        {
          id: 'analyzer-2',
          key: 'sonar',
          name: 'SonarQube',
          dockerImage: 'sonar:latest',
          enabled: false,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.analyzer.findMany.mockResolvedValue(mockAnalyzers);

      const result = await service.listAll();

      expect(result).toEqual(mockAnalyzers);
      expect(mockPrismaService.analyzer.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('should create an analyzer with default enabled true', async () => {
      const dto = {
        key: 'eslint',
        name: 'ESLint',
        dockerImage: 'eslint:latest',
      };

      const mockAnalyzer = {
        id: 'analyzer-1',
        ...dto,
        enabled: true,
        createdAt: new Date(),
      };

      mockPrismaService.analyzer.create.mockResolvedValue(mockAnalyzer);

      const result = await service.create(dto);

      expect(result).toEqual(mockAnalyzer);
      expect(mockPrismaService.analyzer.create).toHaveBeenCalledWith({
        data: {
          key: 'eslint',
          name: 'ESLint',
          dockerImage: 'eslint:latest',
          enabled: true,
        },
      });
    });

    it('should create an analyzer with specified enabled value', async () => {
      const dto = {
        key: 'sonar',
        name: 'SonarQube',
        dockerImage: 'sonar:latest',
        enabled: false,
      };

      const mockAnalyzer = {
        id: 'analyzer-1',
        ...dto,
        createdAt: new Date(),
      };

      mockPrismaService.analyzer.create.mockResolvedValue(mockAnalyzer);

      const result = await service.create(dto);

      expect(result).toEqual(mockAnalyzer);
      expect(mockPrismaService.analyzer.create).toHaveBeenCalledWith({
        data: dto,
      });
    });
  });

  describe('upsertProjectAnalyzer', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
    };

    const mockAnalyzer = {
      id: 'analyzer-123',
      key: 'eslint',
      name: 'ESLint',
      dockerImage: 'eslint:latest',
      enabled: true,
      createdAt: new Date(),
    };

    it('should create and enable a new project analyzer', async () => {
      const dto = {
        enabled: true,
        configJson: { rules: { 'no-console': 'error' } },
      };

      const mockProjectAnalyzer = {
        id: 'link-123',
        projectId: 'project-123',
        analyzerId: 'analyzer-123',
        enabled: true,
        configJson: dto.configJson,
        analyzer: mockAnalyzer,
        createdAt: new Date(),
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.analyzer.findUnique.mockResolvedValue(mockAnalyzer);
      mockPrismaService.projectAnalyzer.findUnique.mockResolvedValue(null);
      mockPrismaService.projectAnalyzer.upsert.mockResolvedValue(mockProjectAnalyzer);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.upsertProjectAnalyzer('TEST_PROJECT', 'eslint', dto, 'user-123');

      expect(result).toEqual({
        analyzer: mockAnalyzer,
        projectEnabled: true,
        effectiveEnabled: true,
        configJson: dto.configJson,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.ANALYZER_ENABLE,
        targetType: 'ProjectAnalyzer',
        targetId: 'analyzer-123',
        metadata: {
          projectKey: 'TEST_PROJECT',
          projectId: 'project-123',
          analyzerKey: 'eslint',
          analyzerName: 'ESLint',
        },
      });
    });

    it('should update existing project analyzer and log enable action', async () => {
      const existing = {
        id: 'link-123',
        projectId: 'project-123',
        analyzerId: 'analyzer-123',
        enabled: false,
        configJson: null,
        createdAt: new Date(),
      };

      const dto = {
        enabled: true,
      };

      const updated = {
        ...existing,
        enabled: true,
        analyzer: mockAnalyzer,
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.analyzer.findUnique.mockResolvedValue(mockAnalyzer);
      mockPrismaService.projectAnalyzer.findUnique.mockResolvedValue(existing);
      mockPrismaService.projectAnalyzer.upsert.mockResolvedValue(updated);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.upsertProjectAnalyzer('TEST_PROJECT', 'eslint', dto, 'user-123');

      expect(result.effectiveEnabled).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-123',
          action: AuditAction.ANALYZER_ENABLE,
          targetType: 'ProjectAnalyzer',
          targetId: 'analyzer-123',
        }),
      );
    });

    it('should update config and log config update action', async () => {
      const existing = {
        id: 'link-123',
        projectId: 'project-123',
        analyzerId: 'analyzer-123',
        enabled: true,
        configJson: { rules: { 'no-console': 'warn' } },
        createdAt: new Date(),
      };

      const dto = {
        enabled: true,
        configJson: { rules: { 'no-console': 'error' } },
      };

      const updated = {
        ...existing,
        configJson: dto.configJson,
        analyzer: mockAnalyzer,
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.analyzer.findUnique.mockResolvedValue(mockAnalyzer);
      mockPrismaService.projectAnalyzer.findUnique.mockResolvedValue(existing);
      mockPrismaService.projectAnalyzer.upsert.mockResolvedValue(updated);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.upsertProjectAnalyzer('TEST_PROJECT', 'eslint', dto, 'user-123');

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-123',
          action: AuditAction.ANALYZER_CONFIG_UPDATE,
          targetType: 'ProjectAnalyzer',
          targetId: 'analyzer-123',
        }),
      );
    });

    it('should throw NotFoundException when analyzer does not exist', async () => {
      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.analyzer.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertProjectAnalyzer('TEST_PROJECT', 'nonexistent', { enabled: true }),
      ).rejects.toThrow(new NotFoundException('Analyzer with key "nonexistent" not found'));
    });

    it('should calculate effectiveEnabled correctly when analyzer is disabled', async () => {
      const disabledAnalyzer = {
        ...mockAnalyzer,
        enabled: false,
      };

      const dto = {
        enabled: true,
      };

      const mockProjectAnalyzer = {
        id: 'link-123',
        projectId: 'project-123',
        analyzerId: 'analyzer-123',
        enabled: true,
        configJson: null,
        analyzer: disabledAnalyzer,
        createdAt: new Date(),
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.analyzer.findUnique.mockResolvedValue(disabledAnalyzer);
      mockPrismaService.projectAnalyzer.findUnique.mockResolvedValue(null);
      mockPrismaService.projectAnalyzer.upsert.mockResolvedValue(mockProjectAnalyzer);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.upsertProjectAnalyzer('TEST_PROJECT', 'eslint', dto, 'user-123');

      expect(result.effectiveEnabled).toBe(false); // False because analyzer.enabled = false
    });
  });

  describe('listForProject', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
    };

    const mockAnalyzers = [
      {
        id: 'analyzer-1',
        key: 'eslint',
        name: 'ESLint',
        dockerImage: 'eslint:latest',
        enabled: true,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'analyzer-2',
        key: 'prettier',
        name: 'Prettier',
        dockerImage: 'prettier:latest',
        enabled: true,
        createdAt: new Date('2024-01-02'),
      },
      {
        id: 'analyzer-3',
        key: 'sonar',
        name: 'SonarQube',
        dockerImage: 'sonar:latest',
        enabled: false,
        createdAt: new Date('2024-01-03'),
      },
    ];

    it('should list analyzers with project overrides', async () => {
      const mockOverrides = [
        {
          id: 'override-1',
          projectId: 'project-123',
          analyzerId: 'analyzer-1',
          enabled: false, // Disabled for this project
          configJson: { rules: {} },
          createdAt: new Date(),
        },
        {
          id: 'override-2',
          projectId: 'project-123',
          analyzerId: 'analyzer-2',
          enabled: true,
          configJson: null,
          createdAt: new Date(),
        },
      ];

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.analyzer.findMany.mockResolvedValue(mockAnalyzers);
      mockPrismaService.projectAnalyzer.findMany.mockResolvedValue(mockOverrides);

      const result = await service.listForProject('TEST_PROJECT');

      expect(result).toHaveLength(3);

      // ESLint - enabled globally but disabled for project
      expect(result[0]).toEqual({
        analyzer: mockAnalyzers[0],
        projectEnabled: false,
        effectiveEnabled: false, // true && false = false
        configJson: { rules: {} },
      });

      // Prettier - enabled globally and for project
      expect(result[1]).toEqual({
        analyzer: mockAnalyzers[1],
        projectEnabled: true,
        effectiveEnabled: true, // true && true = true
        configJson: null,
      });

      // SonarQube - disabled globally, no override
      expect(result[2]).toEqual({
        analyzer: mockAnalyzers[2],
        projectEnabled: null,
        effectiveEnabled: false, // false && true = false (default project enabled is true)
        configJson: null,
      });
    });

    it('should handle no overrides', async () => {
      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.analyzer.findMany.mockResolvedValue(mockAnalyzers);
      mockPrismaService.projectAnalyzer.findMany.mockResolvedValue([]);

      const result = await service.listForProject('TEST_PROJECT');

      expect(result).toHaveLength(3);

      // All should use defaults (analyzer.enabled && true)
      expect(result[0].effectiveEnabled).toBe(true);
      expect(result[1].effectiveEnabled).toBe(true);
      expect(result[2].effectiveEnabled).toBe(false); // SonarQube is disabled globally
    });
  });
});
