import { Test, TestingModule } from '@nestjs/testing';
import { CoverageService } from './coverage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParserFactoryService } from './parsers/parser-factory.service';
import { CoverageFormat } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';

describe('CoverageService', () => {
  let service: CoverageService;
  let prismaService: PrismaService;
  let parserFactory: ParserFactoryService;

  const mockPrismaService = {
    coverageReport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    fileCoverage: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    analysisMetric: {
      createMany: jest.fn(),
    },
    analysis: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ParserFactoryService,
          useValue: {
            getParser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CoverageService>(CoverageService);
    prismaService = module.get<PrismaService>(PrismaService);
    parserFactory = module.get<ParserFactoryService>(ParserFactoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processCoverageFile', () => {
    it('should parse and store LCOV coverage', async () => {
      const analysisId = 'test-analysis-id';
      const lcovBuffer = readFileSync(
        join(__dirname, '../../../test/fixtures/coverage/sample.lcov'),
      );

      const mockParser = {
        parse: jest.fn().mockResolvedValue({
          totalLines: 16,
          coveredLines: 13,
          totalBranches: 6,
          coveredBranches: 4,
          coveragePercent: 81.25,
          files: [
            {
              filePath: 'src/utils/math.ts',
              lines: 10,
              coveredLines: 10,
              branches: 2,
              coveredBranches: 2,
              lineHits: { '1': 1, '2': 10 },
            },
          ],
        }),
      };

      jest.spyOn(parserFactory, 'getParser').mockReturnValue(mockParser);

      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: analysisId,
        projectKey: 'test-project',
        branchId: 1,
      });

      mockPrismaService.coverageReport.create.mockResolvedValue({
        id: 1,
        analysisId,
        format: CoverageFormat.LCOV,
        totalLines: 16,
        coveredLines: 13,
        totalBranches: 6,
        coveredBranches: 4,
        coveragePercent: 81.25,
      });

      mockPrismaService.analysisMetric.createMany.mockResolvedValue({ count: 2 });

      await service.processCoverageFile(analysisId, CoverageFormat.LCOV, lcovBuffer);

      expect(parserFactory.getParser).toHaveBeenCalledWith(CoverageFormat.LCOV);
      expect(mockParser.parse).toHaveBeenCalledWith(lcovBuffer);
      expect(mockPrismaService.coverageReport.create).toHaveBeenCalled();
      expect(mockPrismaService.analysisMetric.createMany).toHaveBeenCalled();
    });

    it('should throw error if analysis not found', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue(null);

      await expect(
        service.processCoverageFile('invalid-id', CoverageFormat.LCOV, Buffer.from('')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCoverageForAnalysis', () => {
    it('should return coverage report with files', async () => {
      const analysisId = 'test-analysis-id';

      mockPrismaService.coverageReport.findUnique.mockResolvedValue({
        id: 1,
        analysisId,
        format: CoverageFormat.LCOV,
        totalLines: 16,
        coveredLines: 13,
        totalBranches: 6,
        coveredBranches: 4,
        coveragePercent: 81.25,
        files: [
          {
            filePath: 'src/utils/math.ts',
            lines: 10,
            coveredLines: 10,
            branches: 2,
            coveredBranches: 2,
            lineHits: { '1': 1, '2': 10 },
          },
        ],
      });

      const result = await service.getCoverageForAnalysis(analysisId);

      expect(result).toBeDefined();
      expect(result.totalLines).toBe(16);
      expect(result.files).toHaveLength(1);
    });

    it('should throw error if coverage not found', async () => {
      mockPrismaService.coverageReport.findUnique.mockResolvedValue(null);

      await expect(service.getCoverageForAnalysis('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCoverageTrend', () => {
    it('should return coverage trend for project', async () => {
      const projectKey = 'test-project';

      mockPrismaService.analysis.findMany.mockResolvedValue([
        {
          id: 'analysis-1',
          createdAt: new Date('2024-01-01'),
          coverageReport: {
            coveragePercent: 80.0,
          },
        },
        {
          id: 'analysis-2',
          createdAt: new Date('2024-01-02'),
          coverageReport: {
            coveragePercent: 85.0,
          },
        },
      ]);

      const result = await service.getCoverageTrend(projectKey);

      expect(result).toHaveLength(2);
      expect(result[0].analysisId).toBe('analysis-2');
      expect(result[0].coveragePercent).toBe(85.0);
      expect(result[1].coveragePercent).toBe(80.0);
    });

    it('should filter by branch when provided', async () => {
      const projectKey = 'test-project';
      const branchId = 1;

      mockPrismaService.analysis.findMany.mockResolvedValue([]);

      await service.getCoverageTrend(projectKey, branchId);

      expect(mockPrismaService.analysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId,
          }),
        }),
      );
    });

    it('should respect limit parameter', async () => {
      const projectKey = 'test-project';
      const limit = 5;

      mockPrismaService.analysis.findMany.mockResolvedValue([]);

      await service.getCoverageTrend(projectKey, undefined, limit);

      expect(mockPrismaService.analysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: limit,
        }),
      );
    });
  });

  describe('getFileCoverage', () => {
    it('should return file coverage details', async () => {
      const analysisId = 'test-analysis-id';
      const filePath = 'src/utils/math.ts';

      mockPrismaService.coverageReport.findUnique.mockResolvedValue({
        id: 1,
        analysisId,
      });

      mockPrismaService.fileCoverage.findFirst.mockResolvedValue({
        id: 1,
        coverageReportId: 1,
        filePath,
        lines: 10,
        coveredLines: 10,
        branches: 2,
        coveredBranches: 2,
        lineHits: { '1': 1, '2': 10 },
      });

      const result = await service.getFileCoverage(analysisId, filePath);

      expect(result).toBeDefined();
      expect(result.filePath).toBe(filePath);
      expect(result.lineHits).toBeDefined();
    });

    it('should throw error if file not found', async () => {
      mockPrismaService.coverageReport.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.fileCoverage.findFirst.mockResolvedValue(null);

      await expect(service.getFileCoverage('analysis-id', 'invalid.ts')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

});
