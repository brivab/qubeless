import { Controller, Get, NotFoundException, Param, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { FastifyRequest } from 'fastify';
import { ApiOrJwtGuard } from '../auth/guards/api-or-jwt.guard';

@ApiTags('artifacts')
@ApiBearerAuth()
@Controller('analyses/:id/artifacts')
@UseGuards(ApiOrJwtGuard)
export class AnalysesArtifactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async list(@Param('id') analysisId: string) {
    const artifacts = await this.prisma.analysisArtifact.findMany({
      where: { analysisId },
      orderBy: { createdAt: 'asc' },
    });
    return artifacts.map((artifact) => ({
      ...artifact,
      size: typeof artifact.size === 'bigint' ? Number(artifact.size) : artifact.size,
    }));
  }

  @Get(':kind')
  async getPresigned(
    @Param('id') analysisId: string,
    @Param('kind') kind: string,
    @Query('analyzerKey') analyzerKey: string | undefined,
    @Req() req: FastifyRequest,
  ) {
    const artifact = await this.prisma.analysisArtifact.findFirst({
      where: {
        analysisId,
        kind: kind.toUpperCase() as any,
        ...(analyzerKey ? { analyzerKey } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!artifact) {
      throw new NotFoundException('Artifact not found');
    }

    const protocol =
      (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'http';
    const host =
      (req.headers['x-forwarded-host'] as string | undefined) ??
      req.hostname ??
      req.headers.host ??
      'localhost:3001';
    const baseUrl = `${protocol}://${host}`;
    const params = new URLSearchParams();
    if (analyzerKey) params.set('analyzerKey', analyzerKey);
    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${baseUrl}/api/analyses/${encodeURIComponent(analysisId)}/artifacts/${encodeURIComponent(kind)}/download${query}`;

    return { url, expiresInSeconds: this.storage.urlExpirySeconds };
  }

  @Get(':kind/download')
  async downloadArtifact(
    @Param('id') analysisId: string,
    @Param('kind') kind: string,
    @Query('analyzerKey') analyzerKey?: string,
  ) {
    const artifact = await this.prisma.analysisArtifact.findFirst({
      where: {
        analysisId,
        kind: kind.toUpperCase() as any,
        ...(analyzerKey ? { analyzerKey } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!artifact) {
      throw new NotFoundException('Artifact not found');
    }

    const result = await this.storage.getObjectStream({
      bucket: artifact.bucket,
      key: artifact.objectKey,
    });

    const filename = artifact.objectKey.split('/').pop() ?? `${artifact.kind.toLowerCase()}.dat`;
    return new StreamableFile(result.stream, {
      type: artifact.contentType ?? result.contentType ?? 'application/octet-stream',
      disposition: `attachment; filename="${filename}"`,
      length: typeof result.contentLength === 'number' ? result.contentLength : undefined,
    });
  }
}
