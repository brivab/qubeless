import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

export interface CreateAuditLogDto {
  actorUserId?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
  };
}

export interface ListAuditLogsQuery {
  actorUserId?: string;
  action?: AuditAction;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(data: CreateAuditLogDto): Promise<AuditLogDto> {
    const sanitizedMetadata = this.sanitizeMetadata(data.metadata);

    this.logger.log({
      action: data.action,
      actorUserId: data.actorUserId,
      targetType: data.targetType,
      targetId: data.targetId,
    });

    const auditLog = await this.prisma.auditLog.create({
      data: {
        actorUserId: data.actorUserId ?? null,
        action: data.action,
        targetType: data.targetType ?? null,
        targetId: data.targetId ?? null,
        metadata: sanitizedMetadata as any,
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return this.mapToDto(auditLog);
  }

  async findMany(query: ListAuditLogsQuery): Promise<{
    data: AuditLogDto[];
    total: number;
  }> {
    const where: any = {
      ...(query.actorUserId && { actorUserId: query.actorUserId }),
      ...(query.action && { action: query.action }),
      ...(query.targetType && { targetType: query.targetType }),
      ...(query.targetId && { targetId: query.targetId }),
    };

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 100,
        skip: query.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: auditLogs.map(this.mapToDto),
      total,
    };
  }

  async findById(id: string): Promise<AuditLogDto | null> {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return auditLog ? this.mapToDto(auditLog) : null;
  }

  private mapToDto(auditLog: any): AuditLogDto {
    return {
      id: auditLog.id,
      actorUserId: auditLog.actorUserId,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata as Record<string, unknown> | null,
      createdAt: auditLog.createdAt.toISOString(),
      ...(auditLog.actor && { actor: auditLog.actor }),
    };
  }

  private sanitizeMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (!metadata) return null;

    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'secret',
      'apiKey',
      'assertion',
      'samlResponse',
      'id_token',
      'access_token',
      'refresh_token',
    ];

    const sanitized = { ...metadata };

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        delete sanitized[key];
      }
    }

    Object.keys(sanitized).forEach((key) => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeMetadata(
          sanitized[key] as Record<string, unknown>,
        );
      }
    });

    return sanitized;
  }
}
