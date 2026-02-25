import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioQueryDto, QualityGateStatus, PortfolioSortBy, SortOrder } from './dto/portfolio-query.dto';

describe('PortfolioService', () => {
  let service: PortfolioService;

  const mockPrismaService = {
    project: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    jest.clearAllMocks();
  });

  describe('getPortfolio', () => {
    const mockProjects = [
      {
        id: 'proj-1',
        key: 'API',
        name: 'API Project',
        description: 'Backend API',
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'Test Org' },
        analyses: [
          {
            id: 'analysis-1',
            status: 'SUCCESS',
            debtRatio: 5.2,
            createdAt: new Date('2024-01-01T10:00:00Z'),
            _count: { issues: 23 },
            coverageReport: { coveragePercent: 78 },
          },
        ],
      },
      {
        id: 'proj-2',
        key: 'WEB',
        name: 'Web Project',
        description: 'Frontend Web',
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'Test Org' },
        analyses: [
          {
            id: 'analysis-2',
            status: 'SUCCESS',
            debtRatio: 12.8,
            createdAt: new Date('2024-01-01T05:00:00Z'),
            _count: { issues: 156 },
            coverageReport: { coveragePercent: 45 },
          },
        ],
      },
      {
        id: 'proj-3',
        key: 'WORKER',
        name: 'Worker Service',
        description: 'Background worker',
        organizationId: 'org-1',
        organization: { id: 'org-1', name: 'Test Org' },
        analyses: [
          {
            id: 'analysis-3',
            status: 'SUCCESS',
            debtRatio: 3.1,
            createdAt: new Date('2024-01-01T01:00:00Z'),
            _count: { issues: 12 },
            coverageReport: { coveragePercent: 82 },
          },
        ],
      },
    ];

    it('should return portfolio data with summary', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        limit: 50,
        offset: 0,
        sortBy: PortfolioSortBy.NAME,
        sortOrder: SortOrder.ASC,
      };

      const result = await service.getPortfolio(query);

      expect(result).toBeDefined();
      expect(result.summary).toEqual({
        totalProjects: 3,
        totalAnalyses: 3,
        totalIssues: 191, // 23 + 156 + 12
        avgCoverage: 68.3, // (78 + 45 + 82) / 3 = 68.333...
        avgDebtRatio: 7.0, // (5.2 + 12.8 + 3.1) / 3 = 7.033...
      });
      expect(result.projects).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by quality gate status', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        qualityGateStatus: QualityGateStatus.PASSED,
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(result.projects).toHaveLength(2);
      expect(result.projects.every(p => p.lastAnalysis?.qualityGateStatus === 'PASSED')).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should filter by coverage range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        minCoverage: 50,
        maxCoverage: 80,
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].key).toBe('API');
      expect(result.projects[0].lastAnalysis?.coverage).toBe(78);
    });

    it('should filter by debt ratio range', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        minDebtRatio: 0,
        maxDebtRatio: 6,
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(result.projects).toHaveLength(2);
      expect(result.projects.some(p => p.key === 'API')).toBe(true);
      expect(result.projects.some(p => p.key === 'WORKER')).toBe(true);
    });

    it('should filter by organization', async () => {
      const projectsWithMultipleOrgs = [
        ...mockProjects,
        {
          id: 'proj-4',
          key: 'OTHER',
          name: 'Other Project',
          description: 'Other org project',
          organizationId: 'org-2',
          organization: { id: 'org-2', name: 'Other Org' },
          analyses: [
            {
              id: 'analysis-4',
              status: 'SUCCESS',
              debtRatio: 2.0,
              createdAt: new Date('2024-01-01T12:00:00Z'),
              _count: { issues: 5 },
              coverageReport: { coveragePercent: 90 },
            },
          ],
        },
      ];

      mockPrismaService.project.findMany.mockImplementation((args) => {
        if (args.where?.organizationId) {
          return Promise.resolve(
            projectsWithMultipleOrgs.filter(p => p.organizationId === args.where.organizationId)
          );
        }
        return Promise.resolve(projectsWithMultipleOrgs);
      });

      const query: PortfolioQueryDto = {
        organizationId: 'org-1',
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        })
      );
    });

    it('should sort by name ascending', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        sortBy: PortfolioSortBy.NAME,
        sortOrder: SortOrder.ASC,
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(result.projects[0].name).toBe('API Project');
      expect(result.projects[1].name).toBe('Web Project');
      expect(result.projects[2].name).toBe('Worker Service');
    });

    it('should sort by issues descending', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        sortBy: PortfolioSortBy.ISSUES,
        sortOrder: SortOrder.DESC,
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(result.projects[0].lastAnalysis?.issuesCount).toBe(156);
      expect(result.projects[1].lastAnalysis?.issuesCount).toBe(23);
      expect(result.projects[2].lastAnalysis?.issuesCount).toBe(12);
    });

    it('should sort by coverage ascending', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        sortBy: PortfolioSortBy.COVERAGE,
        sortOrder: SortOrder.ASC,
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(result.projects[0].lastAnalysis?.coverage).toBe(45);
      expect(result.projects[1].lastAnalysis?.coverage).toBe(78);
      expect(result.projects[2].lastAnalysis?.coverage).toBe(82);
    });

    it('should apply pagination', async () => {
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {
        limit: 2,
        offset: 1,
        sortBy: PortfolioSortBy.NAME,
        sortOrder: SortOrder.ASC,
      };

      const result = await service.getPortfolio(query);

      expect(result.projects).toHaveLength(2);
      expect(result.projects[0].name).toBe('Web Project');
      expect(result.projects[1].name).toBe('Worker Service');
      expect(result.total).toBe(3);
    });

    it('should handle projects without analyses', async () => {
      const projectsWithoutAnalyses = [
        {
          id: 'proj-new',
          key: 'NEW',
          name: 'New Project',
          description: 'No analysis yet',
          organizationId: 'org-1',
          organization: { id: 'org-1', name: 'Test Org' },
          analyses: [],
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(projectsWithoutAnalyses);

      const query: PortfolioQueryDto = {
        limit: 50,
        offset: 0,
      };

      const result = await service.getPortfolio(query);

      expect(result.summary).toEqual({
        totalProjects: 1,
        totalAnalyses: 0,
        totalIssues: 0,
        avgCoverage: 0,
        avgDebtRatio: 0,
      });
      expect(result.projects[0].lastAnalysis).toBeNull();
    });
  });

  describe('exportToCSV', () => {
    it('should generate CSV with correct format', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          key: 'API',
          name: 'API Project',
          description: 'Backend API',
          organizationId: 'org-1',
          organization: { id: 'org-1', name: 'Test Org' },
          analyses: [
            {
              id: 'analysis-1',
              status: 'SUCCESS',
              debtRatio: 5.2,
              createdAt: new Date('2024-01-01T10:00:00Z'),
              _count: { issues: 23 },
              coverageReport: { coveragePercent: 78.5 },
            },
          ],
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const query: PortfolioQueryDto = {};
      const csv = await service.exportToCSV(query);

      expect(csv).toContain('"Project"');
      expect(csv).toContain('"API Project","PASSED","23","78.5%","5.2%"');
      expect(csv).toContain('2024-01-01');
    });

    it('should handle projects without analyses in CSV', async () => {
      const projectsWithoutAnalyses = [
        {
          id: 'proj-new',
          key: 'NEW',
          name: 'New Project',
          description: 'No analysis yet',
          organizationId: 'org-1',
          organization: { id: 'org-1', name: 'Test Org' },
          analyses: [],
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(projectsWithoutAnalyses);

      const query: PortfolioQueryDto = {};
      const csv = await service.exportToCSV(query);

      expect(csv).toContain('"Project"');
      expect(csv).toContain('"New Project","N/A","N/A","N/A","N/A","N/A"');
    });
  });
});
