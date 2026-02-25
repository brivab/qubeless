import { Controller, Get, Header, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Metrics')
@ApiBearerAuth()
@Controller('metrics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns application metrics in Prometheus format. This endpoint is disabled by default and can be enabled via METRICS_ENABLED environment variable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics in Prometheus format',
    content: {
      'text/plain': {
        example: `# HELP analyses_total Total number of analyses started
# TYPE analyses_total counter
analyses_total{project="my-project",status="completed"} 42

# HELP analysis_duration_seconds Duration of analyses in seconds
# TYPE analysis_duration_seconds histogram
analysis_duration_seconds_bucket{project="my-project",status="completed",le="30"} 5
analysis_duration_seconds_bucket{project="my-project",status="completed",le="60"} 15
analysis_duration_seconds_sum{project="my-project",status="completed"} 1234.5
analysis_duration_seconds_count{project="my-project",status="completed"} 42`,
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Metrics endpoint is disabled',
  })
  async getMetrics(): Promise<string> {
    if (!this.metricsService.isEnabled()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Metrics endpoint is disabled',
          hint: 'Set METRICS_ENABLED=true to enable metrics collection',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return this.metricsService.getMetrics();
  }
}
