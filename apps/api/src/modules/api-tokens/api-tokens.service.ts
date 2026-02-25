import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { randomBytes, createHash } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class ApiTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(dto: CreateApiTokenDto, userId?: string) {
    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(token);
    const project =
      dto.projectKey && dto.projectKey.length > 0
        ? await this.prisma.project.findUnique({ where: { key: dto.projectKey } })
        : null;

    const created = await this.prisma.apiToken.create({
      data: {
        name: dto.name,
        tokenHash,
        projectId: project?.id,
      },
      select: {
        id: true,
        name: true,
        projectId: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.TOKEN_CREATE,
      targetType: 'ApiToken',
      targetId: created.id,
      metadata: {
        tokenName: created.name,
        projectId: created.projectId,
        projectKey: dto.projectKey,
      },
    });

    return { ...created, token };
  }

  async findAll() {
    return this.prisma.apiToken.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        projectId: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  }

  async remove(id: string, userId?: string) {
    const existing = await this.prisma.apiToken.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        projectId: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Token ${id} not found`);
    }

    await this.prisma.apiToken.delete({ where: { id } });

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.TOKEN_DELETE,
      targetType: 'ApiToken',
      targetId: existing.id,
      metadata: {
        tokenName: existing.name,
        projectId: existing.projectId,
      },
    });

    return { id };
  }

  async removeMany(ids: string[], userId?: string) {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => id && id.length > 0);
    if (uniqueIds.length === 0) {
      return { deletedIds: [], missingIds: [] };
    }

    const existingTokens = await this.prisma.apiToken.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        name: true,
        projectId: true,
      },
    });

    const existingIds = new Set(existingTokens.map((token) => token.id));
    const missingIds = uniqueIds.filter((id) => !existingIds.has(id));

    await this.prisma.apiToken.deleteMany({ where: { id: { in: uniqueIds } } });

    await Promise.all(
      existingTokens.map((token) =>
        this.auditService.log({
          actorUserId: userId,
          action: AuditAction.TOKEN_DELETE,
          targetType: 'ApiToken',
          targetId: token.id,
          metadata: {
            tokenName: token.name,
            projectId: token.projectId,
          },
        }),
      ),
    );

    return { deletedIds: Array.from(existingIds), missingIds };
  }

  async validate(token: string) {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.apiToken.findUnique({ where: { tokenHash } });
    if (!record) return null;
    await this.prisma.apiToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });
    return record;
  }
}
