import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { AnalysisJobPayload, LlmResolveIssueJobPayload } from '@qubeless/shared';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

const QUEUE_NAME = 'analysis-queue';

@Injectable()
export class AnalysisQueueService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(AnalysisQueueService.name);
  private queue: Queue<AnalysisJobPayload | LlmResolveIssueJobPayload>;
  private readonly jobAttempts: number;
  private readonly backoffDelay: number;
  private queueDepthInterval?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {
    const host = this.configService.get<string>('REDIS_HOST') ?? 'localhost';
    const port = this.configService.get<number>('REDIS_PORT') ?? 6379;
    this.jobAttempts = Number(this.configService.get<string>('WORKER_JOB_ATTEMPTS') ?? 2);
    this.backoffDelay = Number(this.configService.get<string>('WORKER_BACKOFF_MS') ?? 5000);

    this.queue = new Queue<AnalysisJobPayload>(QUEUE_NAME, {
      connection: { host, port },
    });
    this.logger.log(`Connected to Redis at ${host}:${port} for queue ${QUEUE_NAME}`);
    this.logger.log(`Job configuration: attempts=${this.jobAttempts}, backoffDelay=${this.backoffDelay}ms`);
  }

  async onModuleInit() {
    // Start periodic queue depth monitoring
    if (this.metricsService.isEnabled()) {
      this.updateQueueDepthMetrics();
      this.queueDepthInterval = setInterval(() => {
        this.updateQueueDepthMetrics();
      }, 10000); // Update every 10 seconds
    }
  }

  async enqueueAnalysis(payload: AnalysisJobPayload) {
    this.logger.log({ payload, analysisId: payload.analysisId }, 'Enqueue analysis job');
    return this.queue.add(
      'analysis',
      payload,
      {
        attempts: this.jobAttempts,
        backoff: { type: 'exponential', delay: this.backoffDelay },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async enqueueLlmResolveIssue(payload: LlmResolveIssueJobPayload) {
    this.logger.log({ payload, issueId: payload.issueId, llmRunId: payload.llmRunId }, 'Enqueue LLM resolve job');
    return this.queue.add(
      'llm:resolve-issue',
      payload,
      {
        attempts: this.jobAttempts,
        backoff: { type: 'exponential', delay: this.backoffDelay },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  private async updateQueueDepthMetrics() {
    try {
      // Count analyses by status from database (more reliable than queue state)
      const [pending, running] = await Promise.all([
        this.prisma.analysis.count({ where: { status: 'PENDING' } }),
        this.prisma.analysis.count({ where: { status: 'RUNNING' } }),
      ]);

      // Set queue depth metrics based on database state
      this.metricsService.queueDepth.set({ state: 'waiting' }, pending);
      this.metricsService.queueDepth.set({ state: 'active' }, running);
      this.metricsService.queueDepth.set({ state: 'delayed' }, 0); // Not tracked in DB
      this.metricsService.queueDepth.set({ state: 'failed' }, 0); // Failed analyses have status FAILED, not in queue
      this.metricsService.runningAnalyses.set(running);
    } catch (error) {
      this.logger.error({ error }, 'Failed to update queue depth metrics');
    }
  }

  async onModuleDestroy() {
    if (this.queueDepthInterval) {
      clearInterval(this.queueDepthInterval);
    }
    await this.queue.close();
  }
}
