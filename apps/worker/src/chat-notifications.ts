import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv } from 'crypto';

type ChatEvent = 'analysis.completed' | 'quality_gate.failed';
type ChatMessageStatus = 'SUCCESS' | 'FAILED';

interface ChatMessagePayload {
  projectName: string;
  projectKey: string;
  branch: string;
  status: ChatMessageStatus;
  issuesCount: number;
  newIssuesCount: number;
  qualityGateStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
  url: string;
  commitSha: string;
}

const algorithm = 'aes-256-cbc';
const nodeEnv = process.env.NODE_ENV ?? 'development';
const key = process.env.CHAT_WEBHOOK_ENCRYPTION_KEY
  ?? (nodeEnv === 'production' ? null : 'default-key-change-in-production-32');
if (!key) {
  throw new Error('CHAT_WEBHOOK_ENCRYPTION_KEY is required in production');
}
const encryptionKey = Buffer.from(key.padEnd(32, '0').substring(0, 32));

function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = createDecipheriv(algorithm, encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt webhook URL:', error);
    return '';
  }
}

async function sendSlackNotification(
  webhookUrl: string,
  event: ChatEvent,
  payload: ChatMessagePayload,
  channel?: string | null,
): Promise<boolean> {
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
        { type: 'mrkdwn', text: `*Project:*\n${payload.projectName}` },
        { type: 'mrkdwn', text: `*Branch:*\n${payload.branch}` },
        { type: 'mrkdwn', text: `*Quality Gate:*\n${gateEmoji} ${payload.qualityGateStatus}` },
        { type: 'mrkdwn', text: `*Issues:*\n${payload.issuesCount} total (${payload.newIssuesCount} new)` },
      ],
    },
  ];

  if (event === 'quality_gate.failed') {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: ':warning: *Quality gate failed* - Please review the issues before merging.' },
      ],
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Analysis' },
        url: payload.url,
        action_id: 'view_analysis',
      },
    ],
  });

  const message: any = { blocks };
  if (channel) message.channel = channel;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch (error) {
    console.error('Slack notification error:', error);
    return false;
  }
}

async function sendTeamsNotification(
  webhookUrl: string,
  event: ChatEvent,
  payload: ChatMessagePayload,
): Promise<boolean> {
  const themeColor = payload.qualityGateStatus === 'PASS' ? '00FF00' : payload.qualityGateStatus === 'FAIL' ? 'FF0000' : 'FFA500';
  const statusText = payload.status === 'SUCCESS' ? 'Completed' : 'Failed';

  const card: any = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: `Code Quality Analysis ${statusText}`,
    themeColor,
    sections: [
      {
        activityTitle: `Code Quality Analysis ${statusText}`,
        activitySubtitle: payload.projectName,
        facts: [
          { name: 'Project:', value: payload.projectName },
          { name: 'Branch:', value: payload.branch },
          { name: 'Quality Gate:', value: payload.qualityGateStatus },
          { name: 'Issues:', value: `${payload.issuesCount} total (${payload.newIssuesCount} new)` },
          { name: 'Commit:', value: payload.commitSha.substring(0, 7) },
        ],
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'View Analysis',
        targets: [{ os: 'default', uri: payload.url }],
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

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    return response.ok;
  } catch (error) {
    console.error('Teams notification error:', error);
    return false;
  }
}

async function sendDiscordNotification(
  webhookUrl: string,
  event: ChatEvent,
  payload: ChatMessagePayload,
): Promise<boolean> {
  const color = payload.qualityGateStatus === 'PASS' ? 0x00ff00 : payload.qualityGateStatus === 'FAIL' ? 0xff0000 : 0xffa500;
  const statusEmoji = payload.status === 'SUCCESS' ? '✅' : '❌';

  const embed: any = {
    title: `${statusEmoji} Code Quality Analysis ${payload.status === 'SUCCESS' ? 'Completed' : 'Failed'}`,
    color,
    fields: [
      { name: 'Project', value: payload.projectName, inline: true },
      { name: 'Branch', value: payload.branch, inline: true },
      { name: 'Quality Gate', value: payload.qualityGateStatus, inline: true },
      { name: 'Issues', value: `${payload.issuesCount} total (${payload.newIssuesCount} new)`, inline: true },
      { name: 'Commit', value: `\`${payload.commitSha.substring(0, 7)}\``, inline: true },
    ],
    url: payload.url,
    timestamp: new Date().toISOString(),
  };

  if (event === 'quality_gate.failed') {
    embed.description = '⚠️ **Quality gate failed** - Please review the issues before merging.';
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    return response.ok;
  } catch (error) {
    console.error('Discord notification error:', error);
    return false;
  }
}

async function sendGenericNotification(
  webhookUrl: string,
  event: ChatEvent,
  payload: ChatMessagePayload,
): Promise<boolean> {
  const statusEmoji = payload.status === 'SUCCESS' ? '✅' : '❌';
  const gateEmoji = payload.qualityGateStatus === 'PASS' ? '🟢' : payload.qualityGateStatus === 'FAIL' ? '🔴' : '⚪';

  const message = {
    event,
    timestamp: new Date().toISOString(),
    data: {
      title: `${statusEmoji} Code Quality Analysis ${payload.status === 'SUCCESS' ? 'Completed' : 'Failed'}`,
      project: payload.projectName,
      projectKey: payload.projectKey,
      branch: payload.branch,
      commit: payload.commitSha,
      status: payload.status,
      qualityGate: { status: payload.qualityGateStatus, emoji: gateEmoji },
      issues: { total: payload.issuesCount, new: payload.newIssuesCount },
      url: payload.url,
    },
    text:
      `${statusEmoji} **${payload.projectName}** - Code Quality Analysis ${payload.status === 'SUCCESS' ? 'Completed' : 'Failed'}\n` +
      `Branch: ${payload.branch}\n` +
      `Quality Gate: ${gateEmoji} ${payload.qualityGateStatus}\n` +
      `Issues: ${payload.issuesCount} total (${payload.newIssuesCount} new)\n` +
      `[View Analysis](${payload.url})`,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch (error) {
    console.error('Generic webhook notification error:', error);
    return false;
  }
}

export async function sendChatNotifications(
  prisma: PrismaClient,
  projectId: string,
  event: ChatEvent,
  payload: ChatMessagePayload,
  logger: any,
): Promise<void> {
  try {
    const integrations = await prisma.chatIntegration.findMany({
      where: {
        projectId,
        enabled: true,
        events: { has: event },
      },
    });

    if (integrations.length === 0) {
      logger.debug({ projectId, event }, 'No chat integrations found');
      return;
    }

    logger.info({ projectId, event, count: integrations.length }, 'Sending chat notifications');

    const results = await Promise.allSettled(
      integrations.map(async (integration) => {
        const webhookUrl = decrypt(integration.webhookUrl);
        if (!webhookUrl) {
          logger.error({ integrationId: integration.id }, 'Failed to decrypt webhook URL');
          return false;
        }

        let success = false;
        switch (integration.provider) {
          case 'slack':
            success = await sendSlackNotification(webhookUrl, event, payload, integration.channel);
            break;
          case 'teams':
            success = await sendTeamsNotification(webhookUrl, event, payload);
            break;
          case 'discord':
            success = await sendDiscordNotification(webhookUrl, event, payload);
            break;
          case 'generic':
          case 'mattermost':
          case 'rocketchat':
          case 'googlechat':
            success = await sendGenericNotification(webhookUrl, event, payload);
            break;
          default:
            logger.warn({ provider: integration.provider }, 'Unsupported provider');
        }

        if (success) {
          logger.info({ integrationId: integration.id, provider: integration.provider }, 'Notification sent');
        } else {
          logger.error({ integrationId: integration.id, provider: integration.provider }, 'Notification failed');
        }

        return success;
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - succeeded;

    logger.info({ projectId, event, succeeded, failed }, 'Chat notifications completed');
  } catch (error) {
    logger.error({ error, projectId, event }, 'Failed to send chat notifications');
  }
}
