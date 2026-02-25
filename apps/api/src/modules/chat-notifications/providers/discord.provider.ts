import { Injectable, Logger } from '@nestjs/common';
import { ChatProvider } from './chat-provider.interface';
import { ChatEvent, ChatMessagePayload, ChatIntegrationData, SendNotificationResult } from '../types';

@Injectable()
export class DiscordProvider implements ChatProvider {
  private readonly logger = new Logger(DiscordProvider.name);
  private readonly timeout = 10000; // 10 seconds

  supports(provider: string): boolean {
    return provider === 'discord';
  }

  async send(
    event: ChatEvent,
    payload: ChatMessagePayload,
    integration: ChatIntegrationData,
  ): Promise<SendNotificationResult> {
    try {
      const message = this.buildMessage(event, payload);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Discord notification failed: ${response.status} ${errorText}`,
          {
            projectId: integration.projectId,
            event,
          },
        );
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      this.logger.log(`Discord notification sent successfully for event ${event}`, {
        projectId: integration.projectId,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Discord notification error: ${errorMessage}`, {
        projectId: integration.projectId,
        event,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private buildMessage(event: ChatEvent, payload: ChatMessagePayload) {
    const color = payload.qualityGateStatus === 'PASS' ? 0x00ff00 : payload.qualityGateStatus === 'FAIL' ? 0xff0000 : 0xffa500;
    const statusEmoji = payload.status === 'SUCCESS' ? '✅' : '❌';

    const embed: any = {
      title: `${statusEmoji} Code Quality Analysis ${payload.status === 'SUCCESS' ? 'Completed' : 'Failed'}`,
      color,
      fields: [
        {
          name: 'Project',
          value: payload.projectName,
          inline: true,
        },
        {
          name: 'Branch',
          value: payload.branch,
          inline: true,
        },
        {
          name: 'Quality Gate',
          value: payload.qualityGateStatus,
          inline: true,
        },
        {
          name: 'Issues',
          value: `${payload.issuesCount} total (${payload.newIssuesCount} new)`,
          inline: true,
        },
        {
          name: 'Commit',
          value: `\`${payload.commitSha.substring(0, 7)}\``,
          inline: true,
        },
      ],
      url: payload.url,
      timestamp: new Date().toISOString(),
    };

    if (event === 'quality_gate.failed') {
      embed.description = '⚠️ **Quality gate failed** - Please review the issues before merging.';
    }

    const message = {
      embeds: [embed],
    };

    return message;
  }
}
