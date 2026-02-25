import { Injectable, Logger } from '@nestjs/common';
import { ChatProvider } from './chat-provider.interface';
import { ChatEvent, ChatMessagePayload, ChatIntegrationData, SendNotificationResult } from '../types';

@Injectable()
export class GenericWebhookProvider implements ChatProvider {
  private readonly logger = new Logger(GenericWebhookProvider.name);
  private readonly timeout = 10000; // 10 seconds

  supports(provider: string): boolean {
    return provider === 'generic' || provider === 'mattermost' || provider === 'rocketchat' || provider === 'googlechat';
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
          `Generic webhook notification failed: ${response.status} ${errorText}`,
          {
            projectId: integration.projectId,
            provider: integration.provider,
            event,
          },
        );
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      this.logger.log(`Generic webhook notification sent successfully for event ${event}`, {
        projectId: integration.projectId,
        provider: integration.provider,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Generic webhook notification error: ${errorMessage}`, {
        projectId: integration.projectId,
        provider: integration.provider,
        event,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private buildMessage(event: ChatEvent, payload: ChatMessagePayload) {
    const statusEmoji = payload.status === 'SUCCESS' ? '✅' : '❌';
    const gateEmoji =
      payload.qualityGateStatus === 'PASS'
        ? '🟢'
        : payload.qualityGateStatus === 'FAIL'
          ? '🔴'
          : '⚪';

    return {
      event,
      timestamp: new Date().toISOString(),
      data: {
        title: `${statusEmoji} Code Quality Analysis ${payload.status === 'SUCCESS' ? 'Completed' : 'Failed'}`,
        project: payload.projectName,
        projectKey: payload.projectKey,
        branch: payload.branch,
        commit: payload.commitSha,
        status: payload.status,
        qualityGate: {
          status: payload.qualityGateStatus,
          emoji: gateEmoji,
        },
        issues: {
          total: payload.issuesCount,
          new: payload.newIssuesCount,
        },
        url: payload.url,
      },
      text: `${statusEmoji} **${payload.projectName}** - Code Quality Analysis ${payload.status === 'SUCCESS' ? 'Completed' : 'Failed'}\n` +
            `Branch: ${payload.branch}\n` +
            `Quality Gate: ${gateEmoji} ${payload.qualityGateStatus}\n` +
            `Issues: ${payload.issuesCount} total (${payload.newIssuesCount} new)\n` +
            `[View Analysis](${payload.url})`,
    };
  }
}
