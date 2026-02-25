import { Injectable, Logger } from '@nestjs/common';
import { ChatProvider } from './chat-provider.interface';
import { ChatEvent, ChatMessagePayload, ChatIntegrationData, SendNotificationResult } from '../types';

@Injectable()
export class TeamsProvider implements ChatProvider {
  private readonly logger = new Logger(TeamsProvider.name);
  private readonly timeout = 10000; // 10 seconds

  supports(provider: string): boolean {
    return provider === 'teams';
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
          `Teams notification failed: ${response.status} ${errorText}`,
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

      this.logger.log(`Teams notification sent successfully for event ${event}`, {
        projectId: integration.projectId,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Teams notification error: ${errorMessage}`, {
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
    const themeColor = payload.qualityGateStatus === 'PASS' ? '00FF00' : payload.qualityGateStatus === 'FAIL' ? 'FF0000' : 'FFA500';
    const statusText = payload.status === 'SUCCESS' ? 'Completed' : 'Failed';

    // Microsoft Teams Adaptive Card
    const card = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `Code Quality Analysis ${statusText}`,
      themeColor,
      sections: [
        {
          activityTitle: `Code Quality Analysis ${statusText}`,
          activitySubtitle: payload.projectName,
          facts: [
            {
              name: 'Project:',
              value: payload.projectName,
            },
            {
              name: 'Branch:',
              value: payload.branch,
            },
            {
              name: 'Quality Gate:',
              value: payload.qualityGateStatus,
            },
            {
              name: 'Issues:',
              value: `${payload.issuesCount} total (${payload.newIssuesCount} new)`,
            },
            {
              name: 'Commit:',
              value: payload.commitSha.substring(0, 7),
            },
          ],
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View Analysis',
          targets: [
            {
              os: 'default',
              uri: payload.url,
            },
          ],
        },
      ],
    };

    if (event === 'quality_gate.failed') {
      card.sections.push({
        activityTitle: '⚠️ Quality gate failed',
        activitySubtitle: 'Please review the issues before merging.',
        facts: [],
      });
    }

    return card;
  }
}
