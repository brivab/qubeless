import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QualityGatesService } from './quality-gates.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

describe('QualityGatesService', () => {
  let service: QualityGatesService;

  const mockPrismaService = {
    qualityGate: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    qualityGateCondition: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
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
        QualityGatesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<QualityGatesService>(QualityGatesService);

    jest.clearAllMocks();
  });

  describe('createForProject', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
      branches: [],
      qualityGates: [],
    };

    const dto = {
      name: 'My Quality Gate',
    };

    it('should create a new quality gate when none exists', async () => {
      const mockQualityGate = {
        id: 'qg-123',
        name: 'My Quality Gate',
        projectId: 'project-123',
        conditions: [],
        createdAt: new Date(),
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.qualityGate.findFirst.mockResolvedValue(null);
      mockPrismaService.qualityGate.create.mockResolvedValue(mockQualityGate);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createForProject('TEST_PROJECT', dto, 'user-123');

      expect(result).toEqual(mockQualityGate);
      expect(mockPrismaService.qualityGate.create).toHaveBeenCalledWith({
        data: {
          name: 'My Quality Gate',
          projectId: 'project-123',
        },
        include: { conditions: true },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.QUALITY_GATE_CREATE,
        targetType: 'QualityGate',
        targetId: 'qg-123',
        metadata: {
          projectKey: 'TEST_PROJECT',
          projectId: 'project-123',
          gateName: 'My Quality Gate',
        },
      });
    });

    it('should update existing quality gate when one exists', async () => {
      const existingQG = {
        id: 'qg-existing',
        name: 'Old Name',
        projectId: 'project-123',
        conditions: [],
        createdAt: new Date(),
      };

      const updatedQG = {
        ...existingQG,
        name: 'My Quality Gate',
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.qualityGate.findFirst.mockResolvedValue(existingQG);
      mockPrismaService.qualityGate.update.mockResolvedValue(updatedQG);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createForProject('TEST_PROJECT', dto, 'user-123');

      expect(result).toEqual(updatedQG);
      expect(mockPrismaService.qualityGate.update).toHaveBeenCalledWith({
        where: { id: 'qg-existing' },
        data: { name: 'My Quality Gate' },
        include: { conditions: true },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.QUALITY_GATE_UPDATE,
        targetType: 'QualityGate',
        targetId: 'qg-existing',
        metadata: {
          projectKey: 'TEST_PROJECT',
          projectId: 'project-123',
          gateName: 'My Quality Gate',
        },
      });
    });

    it('should work without userId', async () => {
      const mockQualityGate = {
        id: 'qg-123',
        name: 'My Quality Gate',
        projectId: 'project-123',
        conditions: [],
        createdAt: new Date(),
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.qualityGate.findFirst.mockResolvedValue(null);
      mockPrismaService.qualityGate.create.mockResolvedValue(mockQualityGate);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createForProject('TEST_PROJECT', dto);

      expect(result).toEqual(mockQualityGate);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: undefined,
        }),
      );
    });
  });

  describe('findForProject', () => {
    const mockProject = {
      id: 'project-123',
      key: 'TEST_PROJECT',
      name: 'Test Project',
      branches: [],
      qualityGates: [],
    };

    it('should find quality gate for project', async () => {
      const mockQualityGate = {
        id: 'qg-123',
        name: 'My Quality Gate',
        projectId: 'project-123',
        conditions: [
          {
            id: 'cond-1',
            metric: 'coverage',
            operator: 'GT',
            threshold: '80',
          },
        ],
        createdAt: new Date(),
      };

      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.qualityGate.findFirst.mockResolvedValue(mockQualityGate);

      const result = await service.findForProject('TEST_PROJECT');

      expect(result).toEqual(mockQualityGate);
      expect(mockPrismaService.qualityGate.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'project-123' },
        include: { conditions: true },
      });
    });

    it('should throw NotFoundException when quality gate does not exist', async () => {
      mockProjectsService.getByKeyOrThrow.mockResolvedValue(mockProject);
      mockPrismaService.qualityGate.findFirst.mockResolvedValue(null);

      await expect(service.findForProject('TEST_PROJECT')).rejects.toThrow(
        new NotFoundException('Quality gate for project TEST_PROJECT not found'),
      );
    });
  });

  describe('addCondition', () => {
    const dto = {
      metric: 'coverage',
      operator: 'GT' as const,
      threshold: '80',
    };

    const mockGate = {
      id: 'qg-123',
      name: 'My Quality Gate',
      projectId: 'project-123',
      createdAt: new Date(),
    };

    it('should add condition to quality gate', async () => {
      const mockCondition = {
        id: 'cond-123',
        qualityGateId: 'qg-123',
        metric: 'coverage',
        operator: 'GT',
        threshold: '80',
        createdAt: new Date(),
      };

      const mockGateWithConditions = {
        ...mockGate,
        conditions: [mockCondition],
      };

      mockPrismaService.qualityGate.findUnique
        .mockResolvedValueOnce(mockGate)
        .mockResolvedValueOnce(mockGateWithConditions);
      mockPrismaService.qualityGateCondition.create.mockResolvedValue(mockCondition);

      const result = await service.addCondition('qg-123', dto);

      expect(result).toEqual(mockGateWithConditions);
      expect(mockPrismaService.qualityGateCondition.create).toHaveBeenCalledWith({
        data: {
          qualityGateId: 'qg-123',
          metric: 'coverage',
          operator: 'GT',
          threshold: '80',
          scope: 'ALL',
        },
      });
    });

    it('should throw NotFoundException when quality gate does not exist', async () => {
      mockPrismaService.qualityGate.findUnique.mockResolvedValue(null);

      await expect(service.addCondition('nonexistent', dto)).rejects.toThrow(
        new NotFoundException('Quality gate nonexistent not found'),
      );
    });
  });
});
