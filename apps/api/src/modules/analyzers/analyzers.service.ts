import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateAnalyzerDto } from './dto/create-analyzer.dto';
import { UpdateProjectAnalyzerDto } from './dto/update-project-analyzer.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

/**
 * Service for managing analyzers.
 */
@Injectable()
export class AnalyzersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Lists all enabled analyzers.
   * @returns Array of enabled analyzers.
   */
  async listAllEnabled() {
    return this.prisma.analyzer.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Lists all analyzers, including disabled ones.
   * @returns Array of all analyzers.
   */
  async listAll() {
    return this.prisma.analyzer.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Creates a new analyzer.
   * @param dto Data transfer object with analyzer details.
   * @returns Created analyzer.
   */
  async create(dto: CreateAnalyzerDto) {
    return this.prisma.analyzer.create({
      data: {
        key: dto.key,
        name: dto.name,
        dockerImage: dto.dockerImage,
        enabled: dto.enabled ?? true,
      },
    });
  }

  /**
   * Upserts (creates or updates) a project analyzer.
   * @param projectKey Key of the project.
   * @param analyzerKey Key of the analyzer.
   * @param dto Data transfer object with project analyzer details.
   * @param userId ID of the user performing the action.
   * @returns Project analyzer details.
   */
  async upsertProjectAnalyzer(projectKey: string, analyzerKey: string, dto: UpdateProjectAnalyzerDto, userId?: string) {
    const project = await this.projectsService.getByKeyOrThrow(projectKey);
    const analyzer = await this.prisma.analyzer.findUnique({ where: { key: analyzerKey } });
    if (!analyzer) {
      throw new NotFoundException(`Analyzer with key "${analyzerKey}" not found`);
    }

    const enabled = dto.enabled ?? true;
    const configJson = dto.configJson ?? undefined;

    // Check if this is an enable/disable action or a config update
    const existing = await this.prisma.projectAnalyzer.findUnique({
      where: {
        projectId_analyzerId: {
          projectId: project.id,
          analyzerId: analyzer.id,
        },
      },
    });

    const link = await this.prisma.projectAnalyzer.upsert({
      where: {
        projectId_analyzerId: {
          projectId: project.id,
          analyzerId: analyzer.id,
        },
      },
      create: {
        projectId: project.id,
        analyzerId: analyzer.id,
        enabled,
        configJson: configJson ?? null,
      },
      update: {
        enabled,
        configJson: configJson ?? null,
      },
      include: {
        analyzer: true,
      },
    });

    // Determine audit action based on what changed
    if (existing) {
      if (existing.enabled !== enabled) {
        await this.auditService.log({
          actorUserId: userId,
          action: enabled ? AuditAction.ANALYZER_ENABLE : AuditAction.ANALYZER_DISABLE,
          targetType: 'ProjectAnalyzer',
          targetId: analyzer.id,
          metadata: {
            projectKey,
            projectId: project.id,
            analyzerKey,
            analyzerName: analyzer.name,
          },
        });
      }
      if (configJson !== undefined && JSON.stringify(existing.configJson) !== JSON.stringify(configJson)) {
        await this.auditService.log({
          actorUserId: userId,
          action: AuditAction.ANALYZER_CONFIG_UPDATE,
          targetType: 'ProjectAnalyzer',
          targetId: analyzer.id,
          metadata: {
            projectKey,
            projectId: project.id,
            analyzerKey,
            analyzerName: analyzer.name,
          },
        });
      }
    } else {
      // New analyzer configuration
      await this.auditService.log({
        actorUserId: userId,
        action: enabled ? AuditAction.ANALYZER_ENABLE : AuditAction.ANALYZER_DISABLE,
        targetType: 'ProjectAnalyzer',
        targetId: analyzer.id,
        metadata: {
          projectKey,
          projectId: project.id,
          analyzerKey,
          analyzerName: analyzer.name,
        },
      });
    }

    return {
      analyzer: link.analyzer,
      projectEnabled: link.enabled,
      effectiveEnabled: analyzer.enabled && link.enabled,
      configJson: link.configJson,
    };
  }

  /**
   * Lists all analyzers for a specific project.
   * @param projectKey Key of the project.
   * @returns Array of analyzers with their configuration and enabling status.
   */
  async listForProject(projectKey: string) {
    const project = await this.projectsService.getByKeyOrThrow(projectKey);
    const [analyzers, overrides] = await Promise.all([
      this.prisma.analyzer.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.projectAnalyzer.findMany({
        where: { projectId: project.id },
      }),
    ]);

    const overrideMap = new Map(overrides.map((o) => [o.analyzerId, o]));

    return analyzers.map((analyzer) => {
      const override = overrideMap.get(analyzer.id);
      const projectEnabled = override?.enabled ?? null;
      const effectiveEnabled = analyzer.enabled && (projectEnabled ?? true);

      return {
        analyzer,
        projectEnabled,
        effectiveEnabled,
        configJson: override?.configJson ?? null,
      };
    });
  }
}
