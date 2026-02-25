import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email/email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async notifyAnalysisFailed(analysisId: string): Promise<void> {
    try {
      const analysis = await this.prisma.analysis.findUnique({
        where: { id: analysisId },
        include: {
          project: true,
          branch: true,
        },
      });

      if (!analysis) {
        this.logger.warn(`Analysis ${analysisId} not found`);
        return;
      }

      const baseUrl = process.env.WEB_URL || 'http://localhost:5173';
      const analysisUrl = `${baseUrl}/projects/${analysis.project.key}/analyses/${analysisId}`;

      await this.emailService.sendAnalysisFailed(analysisId, {
        projectName: analysis.project.name,
        branch: analysis.branch?.name || 'main',
        commitSha: analysis.commitSha.substring(0, 8),
        errorMessage: 'Analysis execution failed. Check the logs for more details.',
        analysisUrl,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send analysis failed notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async notifyQualityGateFailed(
    analysisId: string,
    failedConditions: Array<{
      metric: string;
      operator: string;
      threshold: string;
      actual: string;
    }>,
  ): Promise<void> {
    try {
      const analysis = await this.prisma.analysis.findUnique({
        where: { id: analysisId },
        include: {
          project: true,
          branch: true,
        },
      });

      if (!analysis) {
        this.logger.warn(`Analysis ${analysisId} not found`);
        return;
      }

      const baseUrl = process.env.WEB_URL || 'http://localhost:5173';
      const analysisUrl = `${baseUrl}/projects/${analysis.project.key}/analyses/${analysisId}`;

      await this.emailService.sendQualityGateFailed(analysisId, {
        projectName: analysis.project.name,
        branch: analysis.branch?.name || 'main',
        commitSha: analysis.commitSha.substring(0, 8),
        failedConditions,
        analysisUrl,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send quality gate failed notification: ${error.message}`,
        error.stack,
      );
    }
  }
}
