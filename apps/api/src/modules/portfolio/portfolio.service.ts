import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioQueryDto, QualityGateStatus, PortfolioSortBy } from './dto/portfolio-query.dto';
import {
  PortfolioResponseDto,
  PortfolioSummaryDto,
  PortfolioProjectDto,
  PortfolioProjectAnalysisDto,
} from './dto/portfolio-response.dto';
import { AnalysisStatus } from '@prisma/client';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(query: PortfolioQueryDto): Promise<PortfolioResponseDto> {
    // Build the where clause for filtering
    const where: any = {
      ...(query.organizationId && { organizationId: query.organizationId }),
    };

    // Get all projects with their latest analysis
    const projects = await this.prisma.project.findMany({
      where,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        analyses: {
          where: {
            status: AnalysisStatus.SUCCESS,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            _count: {
              select: { issues: true },
            },
            coverageReport: {
              select: {
                coveragePercent: true,
              },
            },
          },
        },
      },
    });

    // Process projects and apply filters
    let processedProjects: PortfolioProjectDto[] = projects.map((project) => {
      const latestAnalysis = project.analyses[0];

      let lastAnalysis: PortfolioProjectAnalysisDto | null = null;

      if (latestAnalysis) {
        // Calculate quality gate status (simplified - based on debt ratio and issues)
        let qualityGateStatus = 'PASSED';
        const debtRatio = latestAnalysis.debtRatio ? Number(latestAnalysis.debtRatio) : null;
        if (debtRatio && debtRatio > 10) qualityGateStatus = 'FAILED';
        if (latestAnalysis._count.issues > 100) qualityGateStatus = 'FAILED';

        const coverage = latestAnalysis.coverageReport?.coveragePercent
          ? Number(latestAnalysis.coverageReport.coveragePercent)
          : null;

        lastAnalysis = {
          id: latestAnalysis.id,
          qualityGateStatus,
          issuesCount: latestAnalysis._count.issues,
          coverage,
          debtRatio,
          createdAt: latestAnalysis.createdAt,
          status: latestAnalysis.status,
        };
      }

      return {
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description,
        organizationId: project.organizationId,
        organizationName: project.organization.name,
        lastAnalysis,
      };
    });

    // Apply filters
    processedProjects = processedProjects.filter((project) => {
      // Filter by quality gate status
      if (query.qualityGateStatus) {
        if (!project.lastAnalysis || project.lastAnalysis.qualityGateStatus !== query.qualityGateStatus) {
          return false;
        }
      }

      // Filter by coverage
      if (query.minCoverage !== undefined || query.maxCoverage !== undefined) {
        const coverage = project.lastAnalysis?.coverage;
        if (coverage === null || coverage === undefined) return false;

        if (query.minCoverage !== undefined && coverage < query.minCoverage) return false;
        if (query.maxCoverage !== undefined && coverage > query.maxCoverage) return false;
      }

      // Filter by debt ratio
      if (query.minDebtRatio !== undefined || query.maxDebtRatio !== undefined) {
        const debtRatio = project.lastAnalysis?.debtRatio;
        if (debtRatio === null || debtRatio === undefined) return false;

        if (query.minDebtRatio !== undefined && debtRatio < query.minDebtRatio) return false;
        if (query.maxDebtRatio !== undefined && debtRatio > query.maxDebtRatio) return false;
      }

      return true;
    });

    // Calculate summary
    const summary = this.calculateSummary(processedProjects);

    // Sort projects
    processedProjects = this.sortProjects(processedProjects, query.sortBy, query.sortOrder);

    // Get total count before pagination
    const total = processedProjects.length;

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paginatedProjects = processedProjects.slice(offset, offset + limit);

    return {
      summary,
      projects: paginatedProjects,
      total,
    };
  }

  private calculateSummary(projects: PortfolioProjectDto[]): PortfolioSummaryDto {
    const projectsWithAnalysis = projects.filter((p) => p.lastAnalysis);

    const totalProjects = projects.length;
    const totalAnalyses = projectsWithAnalysis.length;
    const totalIssues = projectsWithAnalysis.reduce((sum, p) => sum + (p.lastAnalysis?.issuesCount || 0), 0);

    // Calculate average coverage (only for projects with coverage data)
    const projectsWithCoverage = projectsWithAnalysis.filter((p) => p.lastAnalysis?.coverage !== null && p.lastAnalysis?.coverage !== undefined);
    const avgCoverage = projectsWithCoverage.length > 0
      ? projectsWithCoverage.reduce((sum, p) => sum + (p.lastAnalysis?.coverage || 0), 0) / projectsWithCoverage.length
      : 0;

    // Calculate average debt ratio (only for projects with debt ratio data)
    const projectsWithDebt = projectsWithAnalysis.filter((p) => p.lastAnalysis?.debtRatio !== null && p.lastAnalysis?.debtRatio !== undefined);
    const avgDebtRatio = projectsWithDebt.length > 0
      ? projectsWithDebt.reduce((sum, p) => sum + (p.lastAnalysis?.debtRatio || 0), 0) / projectsWithDebt.length
      : 0;

    return {
      totalProjects,
      totalAnalyses,
      totalIssues,
      avgCoverage: Math.round(avgCoverage * 10) / 10, // Round to 1 decimal
      avgDebtRatio: Math.round(avgDebtRatio * 10) / 10, // Round to 1 decimal
    };
  }

  private sortProjects(
    projects: PortfolioProjectDto[],
    sortBy: PortfolioSortBy = PortfolioSortBy.NAME,
    sortOrder: 'asc' | 'desc' = 'asc',
  ): PortfolioProjectDto[] {
    const sorted = [...projects].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case PortfolioSortBy.NAME:
          comparison = a.name.localeCompare(b.name);
          break;
        case PortfolioSortBy.ISSUES:
          comparison = (a.lastAnalysis?.issuesCount || 0) - (b.lastAnalysis?.issuesCount || 0);
          break;
        case PortfolioSortBy.COVERAGE:
          comparison = (a.lastAnalysis?.coverage || 0) - (b.lastAnalysis?.coverage || 0);
          break;
        case PortfolioSortBy.DEBT:
          comparison = (a.lastAnalysis?.debtRatio || 0) - (b.lastAnalysis?.debtRatio || 0);
          break;
        case PortfolioSortBy.LAST_ANALYSIS:
          const aDate = a.lastAnalysis?.createdAt ? new Date(a.lastAnalysis.createdAt).getTime() : 0;
          const bDate = b.lastAnalysis?.createdAt ? new Date(b.lastAnalysis.createdAt).getTime() : 0;
          comparison = aDate - bDate;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  async exportToCSV(query: PortfolioQueryDto): Promise<string> {
    // Get all data (no pagination for export)
    const { projects } = await this.getPortfolio({ ...query, limit: 10000, offset: 0 });

    // CSV headers
    const headers = ['Project', 'Gate', 'Issues', 'Coverage', 'Debt', 'Last Scan'];

    // CSV rows
    const rows = projects.map((project) => {
      const gate = project.lastAnalysis?.qualityGateStatus || 'N/A';
      const issues = project.lastAnalysis?.issuesCount?.toString() || 'N/A';
      const coverage = project.lastAnalysis?.coverage !== null && project.lastAnalysis?.coverage !== undefined
        ? `${project.lastAnalysis.coverage.toFixed(1)}%`
        : 'N/A';
      const debt = project.lastAnalysis?.debtRatio !== null && project.lastAnalysis?.debtRatio !== undefined
        ? `${project.lastAnalysis.debtRatio.toFixed(1)}%`
        : 'N/A';
      const lastScan = project.lastAnalysis?.createdAt
        ? new Date(project.lastAnalysis.createdAt).toISOString()
        : 'N/A';

      return [project.name, gate, issues, coverage, debt, lastScan];
    });

    // Build CSV
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
}
