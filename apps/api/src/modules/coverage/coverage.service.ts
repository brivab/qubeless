import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CoverageFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParserFactoryService } from './parsers/parser-factory.service';
import { ParsedCoverage } from './parsers/base-parser.interface';

@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parserFactory: ParserFactoryService,
  ) {}

  async processCoverageFile(
    analysisId: string,
    format: CoverageFormat,
    fileBuffer: Buffer,
  ): Promise<void> {
    this.logger.log({ analysisId, format }, 'Processing coverage file');

    // Verify analysis exists
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { id: true, baselineAnalysisId: true },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    // Parse coverage file
    const parser = this.parserFactory.getParser(format);
    const parsedCoverage = await parser.parse(fileBuffer);

    // Store coverage report
    const coverageReport = await this.prisma.coverageReport.create({
      data: {
        analysisId,
        format,
        totalLines: parsedCoverage.totalLines,
        coveredLines: parsedCoverage.coveredLines,
        totalBranches: parsedCoverage.totalBranches,
        coveredBranches: parsedCoverage.coveredBranches,
        coveragePercent: parsedCoverage.coveragePercent,
        files: {
          create: parsedCoverage.files.map((file) => ({
            filePath: file.filePath,
            lines: file.lines,
            coveredLines: file.coveredLines,
            branches: file.branches,
            coveredBranches: file.coveredBranches,
            lineHits: file.lineHits,
          })),
        },
      },
    });

    this.logger.log(
      { analysisId, reportId: coverageReport.id, coverage: parsedCoverage.coveragePercent },
      'Coverage report stored',
    );

    // Save coverage metrics
    await this.saveCoverageMetrics(analysis, parsedCoverage);
  }

  async getCoverageForAnalysis(analysisId: string) {
    const coverageReport = await this.prisma.coverageReport.findUnique({
      where: { analysisId },
      include: {
        files: {
          orderBy: { filePath: 'asc' },
        },
      },
    });

    if (!coverageReport) {
      throw new NotFoundException(`Coverage report for analysis ${analysisId} not found`);
    }

    return {
      format: coverageReport.format,
      totalLines: coverageReport.totalLines,
      coveredLines: coverageReport.coveredLines,
      totalBranches: coverageReport.totalBranches,
      coveredBranches: coverageReport.coveredBranches,
      coveragePercent: Number(coverageReport.coveragePercent),
      createdAt: coverageReport.createdAt,
      files: coverageReport.files.map((file) => ({
        filePath: file.filePath,
        lines: file.lines,
        coveredLines: file.coveredLines,
        branches: file.branches,
        coveredBranches: file.coveredBranches,
        coveragePercent: file.lines > 0 ? (file.coveredLines / file.lines) * 100 : 0,
      })),
    };
  }

  async getFileCoverage(analysisId: string, filePath: string) {
    const coverageReport = await this.prisma.coverageReport.findUnique({
      where: { analysisId },
      select: { id: true },
    });

    if (!coverageReport) {
      throw new NotFoundException(`Coverage report for analysis ${analysisId} not found`);
    }

    const fileCoverage = await this.prisma.fileCoverage.findFirst({
      where: {
        coverageReportId: coverageReport.id,
        filePath,
      },
    });

    if (!fileCoverage) {
      throw new NotFoundException(`File coverage for ${filePath} not found`);
    }

    return {
      filePath: fileCoverage.filePath,
      lines: fileCoverage.lines,
      coveredLines: fileCoverage.coveredLines,
      branches: fileCoverage.branches,
      coveredBranches: fileCoverage.coveredBranches,
      coveragePercent: fileCoverage.lines > 0 ? (fileCoverage.coveredLines / fileCoverage.lines) * 100 : 0,
      lineHits: fileCoverage.lineHits as Record<string, number>,
    };
  }

  async getCoverageTrend(projectId: string, branchId?: string, limit: number = 20) {
    const analyses = await this.prisma.analysis.findMany({
      where: {
        projectId,
        ...(branchId ? { branchId } : {}),
        coverageReport: {
          isNot: null,
        },
      },
      include: {
        coverageReport: {
          select: {
            coveragePercent: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return analyses
      .map((analysis) => ({
        analysisId: analysis.id,
        commitSha: analysis.commitSha,
        createdAt: analysis.createdAt,
        coveragePercent: analysis.coverageReport ? Number(analysis.coverageReport.coveragePercent) : 0,
      }))
      .reverse(); // Oldest first for chart display
  }

  private async saveCoverageMetrics(
    analysis: { id: string; baselineAnalysisId: string | null },
    coverage: ParsedCoverage,
  ): Promise<void> {
    const analysisRecord = await this.prisma.analysis.findUnique({
      where: { id: analysis.id },
      select: { projectId: true, branchId: true },
    });

    if (!analysisRecord) {
      return;
    }

    const metrics: Array<{ key: string; value: number }> = [
      { key: 'coverage', value: coverage.coveragePercent },
      { key: 'coverage_lines', value: coverage.totalLines > 0 ? (coverage.coveredLines / coverage.totalLines) * 100 : 0 },
      {
        key: 'coverage_branches',
        value: coverage.totalBranches > 0 ? (coverage.coveredBranches / coverage.totalBranches) * 100 : 0,
      },
    ];

    // Calculate new_coverage as delta from baseline
    if (analysis.baselineAnalysisId) {
      const baselineCoverage = await this.prisma.coverageReport.findUnique({
        where: { analysisId: analysis.baselineAnalysisId },
        select: { coveragePercent: true },
      });

      if (baselineCoverage) {
        const newCoverage = coverage.coveragePercent - Number(baselineCoverage.coveragePercent);
        metrics.push({ key: 'new_coverage', value: newCoverage });
      }
    }

    // Store metrics
    // Prisma client typing may lag during CI; cast to any to avoid compile-time mismatch.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as any).analysisMetric.createMany({
      data: metrics.map((m) => ({
        analysisId: analysis.id,
        projectId: analysisRecord.projectId,
        branchId: analysisRecord.branchId ?? null,
        metricKey: m.key,
        value: m.value,
      })),
    });

    this.logger.log({ analysisId: analysis.id, metricsCount: metrics.length }, 'Coverage metrics saved');
  }
}
