import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { HealthService } from './modules/health/health.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe - checks if the process is running' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  async health() {
    return this.healthService.checkHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - checks if the system is ready to handle requests' })
  @ApiResponse({ status: 200, description: 'System is ready' })
  @ApiResponse({ status: 503, description: 'System is not ready' })
  async ready(@Res() reply: FastifyReply) {
    const result = await this.healthService.checkReadiness();

    const statusCode = result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return reply.status(statusCode).send(result);
  }

  @Get('status')
  @ApiOperation({ summary: 'Platform status - user-friendly status for frontend display' })
  @ApiResponse({ status: 200, description: 'Platform status information' })
  async status() {
    return this.healthService.getPlatformStatus();
  }
}
