import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisQueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { MetricsService } from '../metrics/metrics.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: PrismaService;
  let queueService: AnalysisQueueService;
  let storageService: StorageService;
  let metricsService: MetricsService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockQueueService = {
    queue: {
      getWorkers: jest.fn(),
    },
  };

  const mockS3Client = {
    send: jest.fn(),
  };

  const mockStorageService = {
    client: mockS3Client,
  };

  const mockMetricsService = {
    isEnabled: jest.fn().mockReturnValue(false),
    dbLatency: {
      observe: jest.fn(),
    },
    redisLatency: {
      observe: jest.fn(),
    },
    minioLatency: {
      observe: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AnalysisQueueService, useValue: mockQueueService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prismaService = module.get<PrismaService>(PrismaService);
    queueService = module.get<AnalysisQueueService>(AnalysisQueueService);
    storageService = module.get<StorageService>(StorageService);
    metricsService = module.get<MetricsService>(MetricsService);

    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return ok status with timestamp', async () => {
      const result = await service.checkHealth();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should always return ok for liveness check', async () => {
      const result1 = await service.checkHealth();
      const result2 = await service.checkHealth();

      expect(result1.status).toBe('ok');
      expect(result2.status).toBe('ok');
    });
  });

  describe('checkReadiness', () => {
    it('should return ok when all dependencies are healthy', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});

      const result = await service.checkReadiness();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(result.checks?.postgres?.status).toBe('ok');
      expect(result.checks?.minio?.status).toBe('ok');
    });

    it('should return error when postgres is down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockS3Client.send.mockResolvedValue({});

      const result = await service.checkReadiness();

      expect(result.status).toBe('error');
      expect(result.checks?.postgres?.status).toBe('error');
      expect(result.checks?.postgres?.error).toBe('Connection refused');
    });

    it('should return error when minio is down', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockRejectedValue(new Error('MinIO unavailable'));

      const result = await service.checkReadiness();

      expect(result.status).toBe('error');
      expect(result.checks?.minio?.status).toBe('error');
      expect(result.checks?.minio?.error).toBe('MinIO unavailable');
    });

    it('should include latency in health checks', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});

      const result = await service.checkReadiness();

      expect(result.checks?.postgres?.latency).toBeGreaterThanOrEqual(0);
      expect(result.checks?.minio?.latency).toBeGreaterThanOrEqual(0);
    });

    it('should record metrics when enabled', async () => {
      mockMetricsService.isEnabled.mockReturnValue(true);
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});

      await service.checkReadiness();

      expect(mockMetricsService.dbLatency.observe).toHaveBeenCalledWith(
        { operation: 'health_check' },
        expect.any(Number),
      );
      expect(mockMetricsService.minioLatency.observe).toHaveBeenCalledWith(
        { operation: 'health_check' },
        expect.any(Number),
      );
    });

    it('should not record metrics when disabled', async () => {
      mockMetricsService.isEnabled.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});

      await service.checkReadiness();

      expect(mockMetricsService.dbLatency.observe).not.toHaveBeenCalled();
      expect(mockMetricsService.minioLatency.observe).not.toHaveBeenCalled();
    });
  });

  describe('getPlatformStatus', () => {
    it('should return operational when all services are online', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});
      mockQueueService.queue.getWorkers.mockResolvedValue([{ id: 'worker-1' }]);

      const result = await service.getPlatformStatus();

      expect(result.status).toBe('operational');
      expect(result.message).toBe('All systems operational');
      expect(result.services.api).toBe('online');
      expect(result.services.worker).toBe('online');
      expect(result.services.database).toBe('online');
      expect(result.timestamp).toBeDefined();
    });

    it('should return down when database is unavailable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database down'));
      mockS3Client.send.mockResolvedValue({});
      mockQueueService.queue.getWorkers.mockResolvedValue([{ id: 'worker-1' }]);

      const result = await service.getPlatformStatus();

      expect(result.status).toBe('down');
      expect(result.message).toBe('Critical services unavailable');
      expect(result.services.database).toBe('offline');
      expect(result.services.api).toBe('offline');
    });

    it('should return degraded when worker is unavailable', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});
      mockQueueService.queue.getWorkers.mockResolvedValue([]);

      const result = await service.getPlatformStatus();

      expect(result.status).toBe('degraded');
      expect(result.message).toBe('Some services experiencing issues');
      expect(result.services.worker).toBe('offline');
      expect(result.services.api).toBe('online');
      expect(result.services.database).toBe('online');
    });

    it('should return degraded when no workers are active', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});
      mockQueueService.queue.getWorkers.mockResolvedValue(null);

      const result = await service.getPlatformStatus();

      expect(result.status).toBe('degraded');
      expect(result.services.worker).toBe('offline');
    });

    it('should return down when both API and database are unavailable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database error'));
      mockS3Client.send.mockRejectedValue(new Error('MinIO error'));
      mockQueueService.queue.getWorkers.mockResolvedValue([{ id: 'worker-1' }]);

      const result = await service.getPlatformStatus();

      expect(result.status).toBe('down');
      expect(result.message).toBe('Critical services unavailable');
      expect(result.services.api).toBe('offline');
      expect(result.services.database).toBe('offline');
    });
  });

  describe('Postgres Health Check', () => {
    it('should successfully check postgres connection', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});

      const result = await service.checkReadiness();

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result.checks?.postgres?.status).toBe('ok');
      expect(result.checks?.postgres?.latency).toBeGreaterThanOrEqual(0);
    });

    it('should handle postgres connection errors', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection timeout'));
      mockS3Client.send.mockResolvedValue({});

      const result = await service.checkReadiness();

      expect(result.checks?.postgres?.status).toBe('error');
      expect(result.checks?.postgres?.error).toBe('Connection timeout');
      expect(result.checks?.postgres?.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('MinIO Health Check', () => {
    it('should successfully check MinIO connection', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});

      const result = await service.checkReadiness();

      expect(mockS3Client.send).toHaveBeenCalled();
      expect(result.checks?.minio?.status).toBe('ok');
      expect(result.checks?.minio?.latency).toBeGreaterThanOrEqual(0);
    });

    it('should handle MinIO connection errors', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockRejectedValue(new Error('S3 service unavailable'));

      const result = await service.checkReadiness();

      expect(result.checks?.minio?.status).toBe('error');
      expect(result.checks?.minio?.error).toBe('S3 service unavailable');
      expect(result.checks?.minio?.latency).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing S3 client', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const serviceWithNoClient = { ...mockStorageService, client: null };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HealthService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: AnalysisQueueService, useValue: mockQueueService },
          { provide: StorageService, useValue: serviceWithNoClient },
          { provide: MetricsService, useValue: mockMetricsService },
        ],
      }).compile();

      const testService = module.get<HealthService>(HealthService);

      const result = await testService.checkReadiness();

      expect(result.checks?.minio?.status).toBe('error');
      expect(result.checks?.minio?.error).toContain('S3 client not available');
    });
  });

  describe('Worker Health Check', () => {
    it('should return ok when workers are active', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});
      mockQueueService.queue.getWorkers.mockResolvedValue([
        { id: 'worker-1' },
        { id: 'worker-2' },
      ]);

      const result = await service.getPlatformStatus();

      expect(result.services.worker).toBe('online');
    });

    it('should return error when no workers are found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});
      mockQueueService.queue.getWorkers.mockResolvedValue([]);

      const result = await service.getPlatformStatus();

      expect(result.services.worker).toBe('offline');
    });

    it('should handle queue check errors', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});
      mockQueueService.queue.getWorkers.mockRejectedValue(new Error('Queue error'));

      const result = await service.getPlatformStatus();

      expect(result.services.worker).toBe('offline');
    });

    it('should handle missing queue', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockS3Client.send.mockResolvedValue({});

      const serviceWithNoQueue = { queue: null };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HealthService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: AnalysisQueueService, useValue: serviceWithNoQueue },
          { provide: StorageService, useValue: mockStorageService },
          { provide: MetricsService, useValue: mockMetricsService },
        ],
      }).compile();

      const testService = module.get<HealthService>(HealthService);

      const result = await testService.getPlatformStatus();

      expect(result.services.worker).toBe('offline');
    });
  });
});
