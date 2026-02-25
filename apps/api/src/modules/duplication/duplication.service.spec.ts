import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DuplicationService } from './duplication.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DuplicationService', () => {
  let service: DuplicationService;

  const mockPrismaService = {
    analysis: {
      findUnique: jest.fn(),
    },
    duplicationBlock: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DuplicationService>(DuplicationService);
    jest.clearAllMocks();
  });

  describe('getDuplicationForAnalysis', () => {
    it('should throw NotFoundException when analysis does not exist', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue(null);

      await expect(service.getDuplicationForAnalysis('analysis-404')).rejects.toThrow(
        new NotFoundException('Analysis analysis-404 not found'),
      );
    });

    it('should return aggregated duplication data', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-1',
        duplicationPercent: '12.5',
        duplicationBlocks: 2,
      });
      const blocks = [
        {
          id: 'block-1',
          analysisId: 'analysis-1',
          file1Path: 'src/a.ts',
          file2Path: 'src/b.ts',
          startLine1: 1,
          endLine1: 10,
          startLine2: 20,
          endLine2: 29,
          lines: 10,
          tokens: 50,
          codeSnippet: 'snippet 1',
        },
        {
          id: 'block-2',
          analysisId: 'analysis-1',
          file1Path: 'src/b.ts',
          file2Path: 'src/c.ts',
          startLine1: 3,
          endLine1: 8,
          startLine2: 40,
          endLine2: 45,
          lines: 6,
          tokens: 30,
          codeSnippet: 'snippet 2',
        },
      ];
      mockPrismaService.duplicationBlock.findMany.mockResolvedValue(blocks);

      const result = await service.getDuplicationForAnalysis('analysis-1');

      expect(mockPrismaService.duplicationBlock.findMany).toHaveBeenCalledWith({
        where: { analysisId: 'analysis-1' },
        orderBy: { lines: 'desc' },
      });
      expect(result).toEqual({
        duplicationPercent: 12.5,
        duplicationBlocks: 2,
        duplicatedLines: 16,
        totalSources: 3,
        totalClones: 2,
        blocks,
      });
    });

    it('should fallback to zero values when analysis duplication fields are null', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-2',
        duplicationPercent: null,
        duplicationBlocks: null,
      });
      mockPrismaService.duplicationBlock.findMany.mockResolvedValue([]);

      const result = await service.getDuplicationForAnalysis('analysis-2');

      expect(result).toEqual({
        duplicationPercent: 0,
        duplicationBlocks: 0,
        duplicatedLines: 0,
        totalSources: 0,
        totalClones: 0,
        blocks: [],
      });
    });
  });

  describe('getDuplicationBlocks', () => {
    it('should throw NotFoundException when analysis does not exist', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue(null);

      await expect(service.getDuplicationBlocks('analysis-404')).rejects.toThrow(
        new NotFoundException('Analysis analysis-404 not found'),
      );
    });

    it('should return duplication blocks ordered by lines desc', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({ id: 'analysis-1' });
      const blocks = [
        { id: 'block-1', analysisId: 'analysis-1', lines: 10 },
        { id: 'block-2', analysisId: 'analysis-1', lines: 5 },
      ];
      mockPrismaService.duplicationBlock.findMany.mockResolvedValue(blocks);

      const result = await service.getDuplicationBlocks('analysis-1');

      expect(mockPrismaService.duplicationBlock.findMany).toHaveBeenCalledWith({
        where: { analysisId: 'analysis-1' },
        orderBy: { lines: 'desc' },
      });
      expect(result).toEqual(blocks);
    });
  });
});
