import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

interface EmailRecipient {
  email: string;
  name?: string;
}

interface AnalysisFailedData {
  projectName: string;
  branch: string;
  commitSha: string;
  errorMessage: string;
  analysisUrl: string;
}

interface QualityGateFailedData {
  projectName: string;
  branch: string;
  commitSha: string;
  failedConditions: Array<{
    metric: string;
    operator: string;
    threshold: string;
    actual: string;
  }>;
  analysisUrl: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private templatesCache: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor(private prisma: PrismaService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;

    if (!smtpHost || !smtpPort) {
      this.logger.warn('SMTP configuration not found. Email notifications will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      } : undefined,
    });

    this.logger.log('Email service initialized with SMTP configuration');
  }

  private async getTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    if (this.templatesCache.has(templateName)) {
      return this.templatesCache.get(templateName)!;
    }

    const templatePath = join(__dirname, 'templates', `${templateName}.hbs`);
    const templateSource = readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateSource);

    this.templatesCache.set(templateName, template);
    return template;
  }

  private createProjectTransporter(smtpConfig: any): nodemailer.Transporter | null {
    if (!smtpConfig.smtpHost || !smtpConfig.smtpPort) {
      return null;
    }

    return nodemailer.createTransport({
      host: smtpConfig.smtpHost,
      port: smtpConfig.smtpPort,
      secure: smtpConfig.smtpSecure ?? false,
      auth: smtpConfig.smtpUser && smtpConfig.smtpPassword ? {
        user: smtpConfig.smtpUser,
        pass: smtpConfig.smtpPassword,
      } : undefined,
    });
  }

  private async sendEmail(
    to: string[],
    subject: string,
    html: string,
    projectTransporter?: nodemailer.Transporter | null,
    fromAddress?: string | null,
  ): Promise<void> {
    const transporter = projectTransporter || this.transporter;

    if (!transporter) {
      this.logger.warn('Email transporter not configured. Skipping email.');
      return;
    }

    const from = fromAddress || process.env.SMTP_FROM || 'noreply@qubeless.com';

    try {
      await transporter.sendMail({
        from,
        to: to.join(','),
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to.join(', ')}: ${subject}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendAnalysisFailed(
    analysisId: string,
    data: AnalysisFailedData,
  ): Promise<void> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        project: {
          include: {
            memberships: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!analysis) {
      this.logger.warn(`Analysis ${analysisId} not found`);
      return;
    }

    const recipients = analysis.project.memberships
      .filter((m: any) => m.emailNotifyAnalysisFailed !== false)
      .map((m: any) => m.emailAddress || m.user.email);

    if (recipients.length === 0) {
      this.logger.log('No recipients configured for analysis failed notification');
      return;
    }

    const template = await this.getTemplate('analysis-failed');
    const html = template(data);

    // Use project-specific SMTP config if available
    const projectTransporter = this.createProjectTransporter(analysis.project);

    await this.sendEmail(
      recipients,
      `[Qubeless] Analysis failed - ${data.projectName}`,
      html,
      projectTransporter,
      analysis.project.smtpFrom,
    );
  }

  async sendQualityGateFailed(
    analysisId: string,
    data: QualityGateFailedData,
  ): Promise<void> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        project: {
          include: {
            memberships: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!analysis) {
      this.logger.warn(`Analysis ${analysisId} not found`);
      return;
    }

    const recipients = analysis.project.memberships
      .filter((m: any) => m.emailNotifyQualityGateFailed !== false)
      .map((m: any) => m.emailAddress || m.user.email);

    if (recipients.length === 0) {
      this.logger.log('No recipients configured for quality gate failed notification');
      return;
    }

    const template = await this.getTemplate('quality-gate-failed');
    const html = template(data);

    // Use project-specific SMTP config if available
    const projectTransporter = this.createProjectTransporter(analysis.project);

    await this.sendEmail(
      recipients,
      `[Qubeless] Quality gate failed - ${data.projectName}`,
      html,
      projectTransporter,
      analysis.project.smtpFrom,
    );
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error: any) {
      this.logger.error(`SMTP connection test failed: ${error.message}`);
      return false;
    }
  }
}
