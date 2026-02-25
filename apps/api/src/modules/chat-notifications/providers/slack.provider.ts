import { Injectable, Logger } from '@nestjs/common';
import { ChatProvider } from './chat-provider.interface';
import { ChatEvent, ChatMessagePayload, ChatIntegrationData, SendNotificationResult } from '../types';

@Injectable()
export class SlackProvider implements ChatProvider {
  private readonly logger = new Logger(SlackProvider.name);
  private readonly timeout = 10000; // 10 seconds

  supports(provider: string): boolean {
    return provider === 'slack';
  }

  async send(
    event: ChatEvent,
    payload: ChatMessagePayload,
    integration: ChatIntegrationData,
  ): Promise<SendNotificationResult> {
    try {
      const message = this.buildMessage(event, payload, integration);

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
          `Slack notification failed: ${response.status} ${errorText}`,
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

      this.logger.log(`Slack notification sent successfully for event ${event}`, {
        projectId: integration.projectId,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Slack notification error: ${errorMessage}`, {
        projectId: integration.projectId,
        event,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private buildMessage(event: ChatEvent, payload: ChatMessagePayload, integration: ChatIntegrationData) {
    const statusEmoji = payload.status === 'SUCCESS' ? ':white_check_mark:' : ':x:';
    const gateEmoji =
      payload.qualityGateStatus === 'PASS'
        ? ':large_green_circle:'
        : payload.qualityGateStatus === 'FAIL'
          ? ':red_circle:'
          : ':white_circle:';

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Code Quality Analysis ${payload.status === 'SUCCESS' ? 'Completed' : 'Failed'}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project:*\n${payload.projectName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Branch:*\n${payload.branch}`,
          },
          {
            type: 'mrkdwn',
            text: `*Quality Gate:*\n${gateEmoji} ${payload.qualityGateStatus}`,
          },
          {
            type: 'mrkdwn',
            text: `*Issues:*\n${payload.issuesCount} total (${payload.newIssuesCount} new)`,
          },
        ],
      },
    ];

    if (event === 'quality_gate.failed') {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':warning: *Quality gate failed* - Please review the issues before merging.',
          },
        ],
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Analysis',
          },
          url: payload.url,
          action_id: 'view_analysis',
        },
      ],
    });

    const message: any = {
      blocks,
    };

    if (integration.channel) {
      message.channel = integration.channel;
    }

    return message;
  }
}
