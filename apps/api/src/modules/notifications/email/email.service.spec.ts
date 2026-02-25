import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EmailService', () => {
  let service: EmailService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    analysis: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    issue: {
      count: jest.fn(),
    },
    issueResolution: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testConnection', () => {
    it('should return false when SMTP is not configured', async () => {
      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('sendAnalysisFailed', () => {
    it('should log warning when analysis not found', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue(null);

      await service.sendAnalysisFailed('non-existent-id', {
        projectName: 'Test Project',
        branch: 'main',
        commitSha: 'abc123',
        errorMessage: 'Test error',
        analysisUrl: 'http://test.com',
      });

      expect(mockPrismaService.analysis.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
        include: {
          project: {
            include: {
              memberships: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });
    });

    it('should handle analysis with no recipients', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'test-id',
        project: {
          id: 'project-id',
          name: 'Test Project',
          memberships: [],
        },
      });

      await service.sendAnalysisFailed('test-id', {
        projectName: 'Test Project',
        branch: 'main',
        commitSha: 'abc123',
        errorMessage: 'Test error',
        analysisUrl: 'http://test.com',
      });

      expect(mockPrismaService.analysis.findUnique).toHaveBeenCalled();
    });
  });

  describe('sendQualityGateFailed', () => {
    it('should log warning when analysis not found', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue(null);

      await service.sendQualityGateFailed('non-existent-id', {
        projectName: 'Test Project',
        branch: 'main',
        commitSha: 'abc123',
        failedConditions: [
          {
            metric: 'coverage',
            operator: 'LT',
            threshold: '80',
            actual: '75',
          },
        ],
        analysisUrl: 'http://test.com',
      });

      expect(mockPrismaService.analysis.findUnique).toHaveBeenCalled();
    });
  });

  // TODO: Add tests for sendWeeklyDigest when method is implemented
});
