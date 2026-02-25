import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisQueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { MetricsService } from '../metrics/metrics.service';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  checks?: {
    postgres?: { status: 'ok' | 'error'; latency?: number; error?: string };
    redis?: { status: 'ok' | 'error'; latency?: number; error?: string };
    minio?: { status: 'ok' | 'error'; latency?: number; error?: string };
  };
}

export interface PlatformStatusResult {
  status: 'operational' | 'degraded' | 'down';
  message: string;
  services: {
    api: 'online' | 'offline';
    worker: 'online' | 'offline';
    database: 'online' | 'offline';
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: AnalysisQueueService,
    private readonly storage: StorageService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Simple liveness check - returns ok if the process is running
   */
  async checkHealth(): Promise<HealthCheckResult> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check - verifies all critical dependencies are accessible
   */
  async checkReadiness(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const checks: HealthCheckResult['checks'] = {};

    // Check Postgres
    const pgResult = await this.checkPostgres();
    checks.postgres = pgResult;

    // Check Redis
    const redisResult = await this.checkRedis();
    checks.redis = redisResult;

    // Check MinIO
    const minioResult = await this.checkMinio();
    checks.minio = minioResult;

    // Overall status is ok if all checks pass
    const allOk = pgResult.status === 'ok' && redisResult.status === 'ok' && minioResult.status === 'ok';

    return {
      status: allOk ? 'ok' : 'error',
      timestamp,
      checks,
    };
  }

  /**
   * Platform status for frontend display - user-friendly status information
   */
  async getPlatformStatus(): Promise<PlatformStatusResult> {
    const timestamp = new Date().toISOString();

    // Check all services
    const pgResult = await this.checkPostgres();
    const redisResult = await this.checkRedis();
    const minioResult = await this.checkMinio();
    const workerResult = await this.checkWorker();

    // Determine overall platform status
    const apiOnline = pgResult.status === 'ok';
    const workerOnline = workerResult.status === 'ok';
    const databaseOnline = pgResult.status === 'ok';

    let status: 'operational' | 'degraded' | 'down';
    let message: string;

    if (apiOnline && workerOnline && databaseOnline) {
      status = 'operational';
      message = 'All systems operational';
    } else if (!apiOnline || !databaseOnline) {
      status = 'down';
      message = 'Critical services unavailable';
    } else {
      status = 'degraded';
      message = 'Some services experiencing issues';
    }

    return {
      status,
      message,
      services: {
        api: apiOnline ? 'online' : 'offline',
        worker: workerOnline ? 'online' : 'offline',
        database: databaseOnline ? 'online' : 'offline',
      },
      timestamp,
    };
  }

  private async checkPostgres(): Promise<{ status: 'ok' | 'error'; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      // Record metrics if enabled
      if (this.metricsService.isEnabled()) {
        this.metricsService.dbLatency.observe({ operation: 'health_check' }, latency / 1000);
      }

      return { status: 'ok', latency };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'Postgres health check failed');
      return { status: 'error', latency, error: errorMessage };
    }
  }

  private async checkRedis(): Promise<{ status: 'ok' | 'error'; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      // Use dynamic import to get Queue and test Redis connection
      const { Queue } = await import('bullmq');
      const testQueue = new Queue('health-check', {
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        },
      });

      // Get Redis client and ping (using any cast due to BullMQ v4 typing issues)
      const client = await (testQueue as any).client;
      await client.ping();
      await testQueue.close();

      const latency = Date.now() - start;

      // Record metrics if enabled
      if (this.metricsService.isEnabled()) {
        this.metricsService.redisLatency.observe({ operation: 'health_check' }, latency / 1000);
      }

      return { status: 'ok', latency };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'Redis health check failed');
      return { status: 'error', latency, error: errorMessage };
    }
  }

  private async checkMinio(): Promise<{ status: 'ok' | 'error'; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      // Access the internal S3 client
      const client = (this.storage as any).client;
      if (!client) {
        throw new Error('S3 client not available');
      }
      // Use dynamic import to get ListBucketsCommand
      const { ListBucketsCommand } = await import('@aws-sdk/client-s3');
      await client.send(new ListBucketsCommand({}));
      const latency = Date.now() - start;

      // Record metrics if enabled
      if (this.metricsService.isEnabled()) {
        this.metricsService.minioLatency.observe({ operation: 'health_check' }, latency / 1000);
      }

      return { status: 'ok', latency };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'MinIO health check failed');
      return { status: 'error', latency, error: errorMessage };
    }
  }

  private async checkWorker(): Promise<{ status: 'ok' | 'error'; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      // Access the internal queue
      const queue = (this.queue as any).queue;
      if (!queue) {
        throw new Error('Queue not available');
      }

      // Get worker information from BullMQ
      const workers = await queue.getWorkers();
      const latency = Date.now() - start;

      // Check if at least one worker is active
      if (!workers || workers.length === 0) {
        this.logger.warn('No active workers found');
        return { status: 'error', latency, error: 'No active workers' };
      }

      return { status: 'ok', latency };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'Worker health check failed');
      return { status: 'error', latency, error: errorMessage };
    }
  }
}
