import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Helper service to record analysis metrics
 * This service provides methods to manually record metrics when analyses complete or fail
 */
@Injectable()
export class AnalysisMetricsListener {
  private readonly logger = new Logger(AnalysisMetricsListener.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Record metrics for a completed analysis
   */
  async recordAnalysisCompletion(analysisId: string): Promise<void> {
    if (!this.metricsService.isEnabled()) {
      return;
    }

    try {
      const analysis = await this.prisma.analysis.findUnique({
        where: { id: analysisId },
        include: { project: { select: { key: true } } },
      });

      if (!analysis) {
        this.logger.warn({ analysisId }, 'Analysis not found for metrics');
        return;
      }

      const duration = analysis.finishedAt && analysis.startedAt
        ? (analysis.finishedAt.getTime() - analysis.startedAt.getTime()) / 1000
        : 0;

      const projectKey = analysis.project.key;
      const status = analysis.status === 'SUCCESS' ? 'completed' : 'failed';

      this.metricsService.analysesTotal.inc({
        project: projectKey,
        status,
      });

      if (duration > 0) {
        this.metricsService.analysisDuration.observe(
          { project: projectKey, status },
          duration,
        );
      }

      if (analysis.status === 'FAILED') {
        this.metricsService.analysesFailedTotal.inc({
          project: projectKey,
          reason: 'unknown',
        });
      }

      this.logger.debug({ analysisId, duration, projectKey, status }, 'Analysis metric recorded');
    } catch (error) {
      this.logger.error({ analysisId, error }, 'Failed to record analysis metric');
    }
  }

  /**
   * Record metrics for a failed analysis with a specific reason
   */
  async recordAnalysisFailure(analysisId: string, reason?: string): Promise<void> {
    if (!this.metricsService.isEnabled()) {
      return;
    }

    try {
      const analysis = await this.prisma.analysis.findUnique({
        where: { id: analysisId },
        include: { project: { select: { key: true } } },
      });

      if (!analysis) {
        this.logger.warn({ analysisId }, 'Analysis not found for metrics');
        return;
      }

      const duration = analysis.finishedAt && analysis.startedAt
        ? (analysis.finishedAt.getTime() - analysis.startedAt.getTime()) / 1000
        : 0;

      const projectKey = analysis.project.key;

      this.metricsService.analysesTotal.inc({
        project: projectKey,
        status: 'failed',
      });

      this.metricsService.analysesFailedTotal.inc({
        project: projectKey,
        reason: this.categorizeFailureReason(reason),
      });

      if (duration > 0) {
        this.metricsService.analysisDuration.observe(
          { project: projectKey, status: 'failed' },
          duration,
        );
      }

      this.logger.debug({ analysisId, duration, projectKey, reason }, 'Analysis failure metric recorded');
    } catch (error) {
      this.logger.error({ analysisId, error }, 'Failed to record failure metric');
    }
  }

  private categorizeFailureReason(reason?: string): string {
    if (!reason) return 'unknown';

    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('timeout')) return 'timeout';
    if (lowerReason.includes('memory')) return 'memory';
    if (lowerReason.includes('docker')) return 'docker';
    if (lowerReason.includes('storage') || lowerReason.includes('s3')) return 'storage';
    if (lowerReason.includes('network')) return 'network';

    return 'other';
  }
}
