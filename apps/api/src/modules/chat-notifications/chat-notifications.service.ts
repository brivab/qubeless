import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatProvider } from './providers/chat-provider.interface';
import { SlackProvider } from './providers/slack.provider';
import { TeamsProvider } from './providers/teams.provider';
import { DiscordProvider } from './providers/discord.provider';
import { GenericWebhookProvider } from './providers/generic.provider';
import { ChatEvent, ChatMessagePayload, ChatIntegrationData, SendNotificationResult } from './types';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class ChatNotificationsService {
  private readonly logger = new Logger(ChatNotificationsService.name);
  private readonly providers: ChatProvider[];
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(
    private readonly prisma: PrismaService,
    slackProvider: SlackProvider,
    teamsProvider: TeamsProvider,
    discordProvider: DiscordProvider,
    genericProvider: GenericWebhookProvider,
  ) {
    this.providers = [slackProvider, teamsProvider, discordProvider, genericProvider];

    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const key = process.env.CHAT_WEBHOOK_ENCRYPTION_KEY
      ?? (nodeEnv === 'production' ? null : 'default-key-change-in-production-32');
    if (!key) {
      throw new Error('CHAT_WEBHOOK_ENCRYPTION_KEY is required in production');
    }
    this.encryptionKey = Buffer.from(key.padEnd(32, '0').substring(0, 32));
  }

  /**
   * Send notification to all enabled integrations for a project and event
   */
  async notify(projectId: string, event: ChatEvent, payload: ChatMessagePayload): Promise<void> {
    const integrations = await this.prisma.chatIntegration.findMany({
      where: {
        projectId,
        enabled: true,
        events: {
          has: event,
        },
      },
    });

    if (integrations.length === 0) {
      this.logger.debug(`No chat integrations found for project ${projectId} and event ${event}`);
      return;
    }

    this.logger.log(`Sending ${event} notification to ${integrations.length} integration(s)`, {
      projectId,
      event,
    });

    // Send notifications in parallel
    const results = await Promise.allSettled(
      integrations.map((integration) => this.sendToIntegration(integration, event, payload)),
    );

    // Log results
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Notifications sent: ${succeeded} succeeded, ${failed} failed`, {
      projectId,
      event,
    });
  }

  /**
   * Send a notification to a specific integration
   */
  private async sendToIntegration(
    integration: any,
    event: ChatEvent,
    payload: ChatMessagePayload,
  ): Promise<SendNotificationResult> {
    const provider = this.getProvider(integration.provider);

    if (!provider) {
      this.logger.error(`No provider found for ${integration.provider}`, {
        integrationId: integration.id,
      });
      return {
        success: false,
        error: `Unsupported provider: ${integration.provider}`,
      };
    }

    const integrationData: ChatIntegrationData = {
      ...integration,
      webhookUrl: this.decrypt(integration.webhookUrl),
    };

    return provider.send(event, payload, integrationData);
  }

  /**
   * Test a webhook connection
   */
  async testConnection(integrationId: number): Promise<SendNotificationResult> {
    const integration = await this.prisma.chatIntegration.findUnique({
      where: { id: integrationId },
      include: { project: true },
    });

    if (!integration) {
      throw new NotFoundException(`Chat integration ${integrationId} not found`);
    }

    const testPayload: ChatMessagePayload = {
      projectName: integration.project.name,
      projectKey: integration.project.key,
      branch: 'main',
      status: 'SUCCESS',
      issuesCount: 0,
      newIssuesCount: 0,
      qualityGateStatus: 'PASS',
      url: `${process.env.WEB_APP_URL || 'http://localhost:5173'}/projects/${integration.project.key}`,
      commitSha: '0000000',
    };

    return this.sendToIntegration(integration, 'analysis.completed', testPayload);
  }

  /**
   * Create a new chat integration
   */
  async create(data: {
    projectId: string;
    provider: string;
    webhookUrl: string;
    channel?: string;
    events: string[];
    enabled?: boolean;
  }) {
    const encryptedWebhookUrl = this.encrypt(data.webhookUrl);

    return this.prisma.chatIntegration.create({
      data: {
        projectId: data.projectId,
        provider: data.provider,
        webhookUrl: encryptedWebhookUrl,
        channel: data.channel || null,
        events: data.events,
        enabled: data.enabled ?? true,
      },
    });
  }

  /**
   * Update a chat integration
   */
  async update(
    id: number,
    data: {
      webhookUrl?: string;
      channel?: string;
      events?: string[];
      enabled?: boolean;
    },
  ) {
    const updateData: any = {};

    if (data.webhookUrl !== undefined) {
      updateData.webhookUrl = this.encrypt(data.webhookUrl);
    }
    if (data.channel !== undefined) {
      updateData.channel = data.channel || null;
    }
    if (data.events !== undefined) {
      updateData.events = data.events;
    }
    if (data.enabled !== undefined) {
      updateData.enabled = data.enabled;
    }

    return this.prisma.chatIntegration.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a chat integration
   */
  async delete(id: number) {
    return this.prisma.chatIntegration.delete({
      where: { id },
    });
  }

  /**
   * List all integrations for a project
   */
  async listForProject(projectId: string) {
    const integrations = await this.prisma.chatIntegration.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Return integrations without exposing the full webhook URL
    return integrations.map((integration) => ({
      ...integration,
      webhookUrl: this.maskWebhookUrl(this.decrypt(integration.webhookUrl)),
    }));
  }

  /**
   * Get a single integration
   */
  async getById(id: number) {
    const integration = await this.prisma.chatIntegration.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundException(`Chat integration ${id} not found`);
    }

    return {
      ...integration,
      webhookUrl: this.maskWebhookUrl(this.decrypt(integration.webhookUrl)),
    };
  }

  /**
   * Get provider for a given provider name
   */
  private getProvider(providerName: string): ChatProvider | null {
    return this.providers.find((p) => p.supports(providerName)) || null;
  }

  /**
   * Encrypt a webhook URL
   */
  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a webhook URL
   */
  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Mask webhook URL for display (show only last 8 characters)
   */
  private maskWebhookUrl(url: string): string {
    if (url.length <= 12) return '***';
    return `***${url.substring(url.length - 8)}`;
  }
}
