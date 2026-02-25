import { Injectable, Logger } from '@nestjs/common';
import { PullRequestProvider } from '@prisma/client';
import { ProjectsService } from '../projects/projects.service';
import { AnalysesService } from '../analyses/analyses.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly analysesService: AnalysesService,
    private readonly prisma: PrismaService,
  ) {}

  async handlePullRequestEvent(payload: {
    provider: PullRequestProvider;
    repo: string;
    prNumber: number;
    sourceBranch: string;
    targetBranch: string;
    commitSha: string;
  }) {
    const projectKey = payload.repo;

    let project = await this.projectsService.findByKey(projectKey);

    if (!project) {
      // Get default organization for auto-created projects
      const defaultOrg = await this.prisma.organization.findUnique({
        where: { slug: 'default' },
      });

      if (!defaultOrg) {
        throw new Error('Default organization not found. Please run database migrations and seed.');
      }

      await this.projectsService.create({
        key: projectKey,
        name: this.deriveName(projectKey),
        description: `Auto-created from ${payload.provider} webhook`,
        organizationId: defaultOrg.id,
      });

      // Refetch the project to get consistent type
      project = await this.projectsService.findByKey(projectKey);
    }

    if (!project) {
      throw new Error(`Failed to create or find project: ${projectKey}`);
    }

    const dto = {
      commitSha: payload.commitSha,
      branch: undefined,
      provider: payload.provider,
      repo: payload.repo,
      prNumber: payload.prNumber,
      sourceBranch: payload.sourceBranch,
      targetBranch: payload.targetBranch,
    };

    const analysis = await this.analysesService.createForProject(project.key, dto as any);
    this.logger.log(
      {
        analysisId: analysis.id,
        projectKey: project.key,
        prNumber: payload.prNumber,
        repo: payload.repo,
      },
      'Analysis triggered from webhook',
    );
    return analysis;
  }

  private deriveName(key: string) {
    return key
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
