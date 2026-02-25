import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditService, ListAuditLogsQuery } from './audit.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'List audit logs' })
  async listLogs(
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: AuditAction,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const query: ListAuditLogsQuery = {
      ...(actorUserId && { actorUserId }),
      ...(action && { action }),
      ...(targetType && { targetType }),
      ...(targetId && { targetId }),
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    return this.auditService.findMany(query);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: 'Get audit log by ID' })
  async getLog(@Param('id') id: string) {
    const log = await this.auditService.findById(id);
    if (!log) {
      throw new NotFoundException(`Audit log with id "${id}" not found`);
    }
    return log;
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List all audit logs (admin only)' })
  async listAllLogs(
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: AuditAction,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const query: ListAuditLogsQuery = {
      ...(actorUserId && { actorUserId }),
      ...(action && { action }),
      ...(targetType && { targetType }),
      ...(targetId && { targetId }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    return this.auditService.findMany(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID (admin only)' })
  async getLog(@Param('id') id: string) {
    const log = await this.auditService.findById(id);
    if (!log) {
      throw new NotFoundException(`Audit log with id "${id}" not found`);
    }
    return log;
  }
}
