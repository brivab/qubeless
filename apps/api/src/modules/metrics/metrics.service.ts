import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: client.Registry;
  private readonly enabled: boolean;

  // Counters
  public readonly analysesTotal: client.Counter<string>;
  public readonly analysesFailedTotal: client.Counter<string>;

  // Histogram
  public readonly analysisDuration: client.Histogram<string>;

  // Gauge
  public readonly queueDepth: client.Gauge<string>;
  public readonly runningAnalyses: client.Gauge<string>;

  // Infrastructure metrics
  public readonly dbLatency: client.Histogram<string>;
  public readonly redisLatency: client.Histogram<string>;
  public readonly minioLatency: client.Histogram<string>;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('METRICS_ENABLED', 'false').toLowerCase() === 'true';

    if (!this.enabled) {
      this.logger.log('Metrics collection is disabled (METRICS_ENABLED=false)');
    } else {
      this.logger.log('Metrics collection is enabled');
    }

    // Create a new registry
    this.registry = new client.Registry();

    // Add default metrics (CPU, memory, etc.)
    if (this.enabled) {
      client.collectDefaultMetrics({ register: this.registry });
    }

    // Define custom metrics
    this.analysesTotal = new client.Counter({
      name: 'analyses_total',
      help: 'Total number of analyses started',
      labelNames: ['project', 'status'],
      registers: [this.registry],
    });

    this.analysesFailedTotal = new client.Counter({
      name: 'analyses_failed_total',
      help: 'Total number of failed analyses',
      labelNames: ['project', 'reason'],
      registers: [this.registry],
    });

    this.analysisDuration = new client.Histogram({
      name: 'analysis_duration_seconds',
      help: 'Duration of analyses in seconds',
      labelNames: ['project', 'status'],
      buckets: [30, 60, 120, 300, 600, 1200, 1800, 3600], // 30s to 1h
      registers: [this.registry],
    });

    this.queueDepth = new client.Gauge({
      name: 'queue_depth',
      help: 'Number of jobs waiting in the analysis queue',
      labelNames: ['state'],
      registers: [this.registry],
    });

    this.runningAnalyses = new client.Gauge({
      name: 'running_analyses',
      help: 'Number of currently running analyses',
      registers: [this.registry],
    });

    this.dbLatency = new client.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.redisLatency = new client.Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Redis operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
      registers: [this.registry],
    });

    this.minioLatency = new client.Histogram({
      name: 'minio_operation_duration_seconds',
      help: 'MinIO operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });
  }

  /**
   * Check if metrics collection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    if (!this.enabled) {
      return '# Metrics disabled\n';
    }

    return this.registry.metrics();
  }

  /**
   * Get the Prometheus content type
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.registry.resetMetrics();
  }
}
