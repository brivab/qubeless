import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email/email.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let previousWebUrl: string | undefined;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const mockPrismaService = {
    analysis: {
      findUnique: jest.fn(),
    },
  };

  const mockEmailService = {
    sendAnalysisFailed: jest.fn(),
    sendQualityGateFailed: jest.fn(),
  };

  beforeAll(() => {
    previousWebUrl = process.env.WEB_URL;
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    process.env.WEB_URL = 'https://web.qubeless.test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (previousWebUrl === undefined) {
      delete process.env.WEB_URL;
    } else {
      process.env.WEB_URL = previousWebUrl;
    }
    loggerWarnSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  describe('notifyAnalysisFailed', () => {
    it('should send email notification when analysis exists', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-1',
        commitSha: '123456789abcdef0',
        project: { name: 'Project One', key: 'proj-one' },
        branch: { name: 'feature/test' },
      });
      mockEmailService.sendAnalysisFailed.mockResolvedValue(undefined);

      await service.notifyAnalysisFailed('analysis-1');

      expect(mockEmailService.sendAnalysisFailed).toHaveBeenCalledWith('analysis-1', {
        projectName: 'Project One',
        branch: 'feature/test',
        commitSha: '12345678',
        errorMessage: 'Analysis execution failed. Check the logs for more details.',
        analysisUrl: 'https://web.qubeless.test/projects/proj-one/analyses/analysis-1',
      });
    });

    it('should fallback to main branch when branch is null', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-1',
        commitSha: 'abcdef1234567890',
        project: { name: 'Project One', key: 'proj-one' },
        branch: null,
      });
      mockEmailService.sendAnalysisFailed.mockResolvedValue(undefined);

      await service.notifyAnalysisFailed('analysis-1');

      expect(mockEmailService.sendAnalysisFailed).toHaveBeenCalledWith(
        'analysis-1',
        expect.objectContaining({
          branch: 'main',
        }),
      );
    });

    it('should do nothing when analysis is not found', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue(null);

      await expect(service.notifyAnalysisFailed('missing-analysis')).resolves.toBeUndefined();
      expect(mockEmailService.sendAnalysisFailed).not.toHaveBeenCalled();
    });

    it('should swallow email errors to avoid breaking flow', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-1',
        commitSha: '123456789abcdef0',
        project: { name: 'Project One', key: 'proj-one' },
        branch: { name: 'main' },
      });
      mockEmailService.sendAnalysisFailed.mockRejectedValue(new Error('smtp down'));

      await expect(service.notifyAnalysisFailed('analysis-1')).resolves.toBeUndefined();
    });
  });

  describe('notifyQualityGateFailed', () => {
    const failedConditions = [
      {
        metric: 'coverage',
        operator: 'LT',
        threshold: '80',
        actual: '72',
      },
    ];

    it('should send quality gate failure email', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-2',
        commitSha: 'fedcba9876543210',
        project: { name: 'Project Two', key: 'proj-two' },
        branch: { name: 'main' },
      });
      mockEmailService.sendQualityGateFailed.mockResolvedValue(undefined);

      await service.notifyQualityGateFailed('analysis-2', failedConditions);

      expect(mockEmailService.sendQualityGateFailed).toHaveBeenCalledWith('analysis-2', {
        projectName: 'Project Two',
        branch: 'main',
        commitSha: 'fedcba98',
        failedConditions,
        analysisUrl: 'https://web.qubeless.test/projects/proj-two/analyses/analysis-2',
      });
    });

    it('should fallback to localhost URL when WEB_URL is missing', async () => {
      delete process.env.WEB_URL;
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-2',
        commitSha: 'fedcba9876543210',
        project: { name: 'Project Two', key: 'proj-two' },
        branch: { name: 'main' },
      });
      mockEmailService.sendQualityGateFailed.mockResolvedValue(undefined);

      await service.notifyQualityGateFailed('analysis-2', failedConditions);

      expect(mockEmailService.sendQualityGateFailed).toHaveBeenCalledWith(
        'analysis-2',
        expect.objectContaining({
          analysisUrl: 'http://localhost:5173/projects/proj-two/analyses/analysis-2',
        }),
      );
    });

    it('should do nothing when analysis is missing', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue(null);

      await expect(
        service.notifyQualityGateFailed('missing-analysis', failedConditions),
      ).resolves.toBeUndefined();
      expect(mockEmailService.sendQualityGateFailed).not.toHaveBeenCalled();
    });

    it('should swallow email sending errors', async () => {
      mockPrismaService.analysis.findUnique.mockResolvedValue({
        id: 'analysis-2',
        commitSha: 'fedcba9876543210',
        project: { name: 'Project Two', key: 'proj-two' },
        branch: { name: 'main' },
      });
      mockEmailService.sendQualityGateFailed.mockRejectedValue(new Error('smtp down'));

      await expect(
        service.notifyQualityGateFailed('analysis-2', failedConditions),
      ).resolves.toBeUndefined();
    });
  });
});
