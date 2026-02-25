import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DuplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async getDuplicationForAnalysis(analysisId: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        duplicationPercent: true,
        duplicationBlocks: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    // Get all duplication blocks
    const allBlocks = await this.prisma.duplicationBlock.findMany({
      where: { analysisId },
      orderBy: { lines: 'desc' },
    });

    const duplicatedLines = allBlocks.reduce((sum, block) => sum + block.lines, 0);
    const totalClones = allBlocks.length;

    // Count unique source files
    const uniqueFiles = new Set<string>();
    allBlocks.forEach((block) => {
      uniqueFiles.add(block.file1Path);
      uniqueFiles.add(block.file2Path);
    });

    return {
      duplicationPercent: analysis.duplicationPercent ? Number(analysis.duplicationPercent) : 0,
      duplicationBlocks: analysis.duplicationBlocks || 0,
      duplicatedLines,
      totalSources: uniqueFiles.size,
      totalClones,
      blocks: allBlocks,
    };
  }

  async getDuplicationBlocks(analysisId: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { id: true },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    return this.prisma.duplicationBlock.findMany({
      where: { analysisId },
      orderBy: { lines: 'desc' },
    });
  }
}
