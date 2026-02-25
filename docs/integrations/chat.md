# Chat Notifications Integration

This document describes how to configure chat notifications in Qubeless to send analysis results to Slack, Microsoft Teams, Discord, or any webhook-compatible chat platform.

## Overview

Chat notifications allow your team to receive real-time updates about code quality analyses directly in your chat platform of choice. You can configure notifications for:

- **Analysis Completed**: Sent when an analysis finishes successfully
- **Quality Gate Failed**: Sent when a quality gate fails, requiring immediate attention

## Supported Providers

### Slack

Slack integration uses Incoming Webhooks with rich message formatting using Block Kit.

**Setup:**
1. Go to your Slack workspace settings
2. Navigate to "Apps" → "Incoming Webhooks"
3. Create a new webhook for the desired channel
4. Copy the webhook URL (e.g., `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX`)
5. Add the integration in Qubeless with the webhook URL

**Optional:** Override the default channel by specifying a channel name in the integration settings.

### Microsoft Teams

Teams integration uses Incoming Webhooks with Adaptive Cards for rich formatting.

**Setup:**
1. In your Teams channel, click the "..." menu
2. Select "Connectors" → "Incoming Webhook"
3. Give your webhook a name and optionally upload an image
4. Copy the webhook URL
5. Add the integration in Qubeless with the webhook URL

### Discord

Discord integration uses webhooks with embedded messages for rich formatting.

**Setup:**
1. In your Discord server, go to "Server Settings" → "Integrations"
2. Click "Webhooks" → "New Webhook"
3. Choose a channel and copy the webhook URL
4. Add the integration in Qubeless with the webhook URL

### Mattermost

Mattermost integration uses Incoming Webhooks.

**Setup:**
1. Go to "Main Menu" → "Integrations" → "Incoming Webhooks"
2. Click "Add Incoming Webhook"
3. Choose a channel and copy the webhook URL
4. Add the integration in Qubeless with the webhook URL

### Rocket.Chat

Rocket.Chat integration uses Incoming Webhooks.

**Setup:**
1. Go to "Administration" → "Integrations" → "New Integration"
2. Select "Incoming Webhook"
3. Enable the webhook and copy the URL
4. Add the integration in Qubeless with the webhook URL

### Google Chat

Google Chat integration uses webhooks.

**Setup:**
1. In your Google Chat space, click the space name → "Manage webhooks"
2. Click "Add Webhook"
3. Give it a name and copy the webhook URL
4. Add the integration in Qubeless with the webhook URL

### Generic Webhook

For other platforms or custom integrations, use the Generic Webhook provider. It sends a standardized JSON payload.

**Payload Format:**
```json
{
  "event": "analysis.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "title": "✅ Code Quality Analysis Completed",
    "project": "My Project",
    "projectKey": "my-project",
    "branch": "main",
    "commit": "abc1234",
    "status": "SUCCESS",
    "qualityGate": {
      "status": "PASS",
      "emoji": "🟢"
    },
    "issues": {
      "total": 42,
      "new": 5
    },
    "url": "https://qubeless.example.com/analyses/xyz"
  },
  "text": "✅ **My Project** - Code Quality Analysis Completed\nBranch: main\nQuality Gate: 🟢 PASS\nIssues: 42 total (5 new)\n[View Analysis](https://qubeless.example.com/analyses/xyz)"
}
```

## Configuration

### Via Web UI

1. Navigate to your project
2. Click on the **Integrations** tab
3. Click **Add Integration**
4. Select your chat platform from the dropdown
5. Enter your webhook URL
6. (Optional) Specify a channel name for Slack
7. Select which events you want to receive notifications for:
   - Analysis Completed
   - Quality Gate Failed
8. Click **Create**

### Test Connection

After creating an integration, you can test it by clicking the 🔔 button next to the integration. This will send a test notification to verify the webhook is working correctly.

### Edit or Delete

- Click the ✏️ button to edit an integration
- Click the 🗑️ button to delete an integration
- Toggle the Enabled/Disabled status to temporarily pause notifications

## Message Examples

### Success Message

When an analysis completes successfully:

```
✅ Code Quality Analysis Completed

Project: My Project
Branch: main
Quality Gate: 🟢 PASS
Issues: 42 total (5 new)
Commit: abc1234

[View Analysis Button]
```

### Quality Gate Failed Message

When a quality gate fails:

```
❌ Code Quality Analysis Completed

Project: My Project
Branch: main
Quality Gate: 🔴 FAIL
Issues: 67 total (12 new)
Commit: abc1234

⚠️ Quality gate failed - Please review the issues before merging.

[View Analysis Button]
```

## Security Considerations

1. **Webhook URLs are encrypted** in the database using AES-256-CBC encryption
2. **Webhook URLs are masked** in the UI (only the last 8 characters are shown)
3. **HTTPS only**: Ensure your webhook URL uses HTTPS
4. **Treat webhook URLs as secrets**: They provide write access to your chat channels
5. **Rotate webhooks periodically**: If a webhook URL is compromised, delete the integration and create a new one

## Environment Variables

Set the following environment variable to configure encryption:

```bash
# Encryption key for webhook URLs (32 characters recommended)
CHAT_WEBHOOK_ENCRYPTION_KEY=your-secret-key-here-32-chars
```

**Important:** Use a strong, random key in production. If this variable is not set, a default key will be used (insecure).

## Adding a New Provider

To add support for a new chat platform:

1. Create a new provider class implementing the `ChatProvider` interface:

```typescript
import { Injectable } from '@nestjs/common';
import { ChatProvider } from './chat-provider.interface';

@Injectable()
export class MyCustomProvider implements ChatProvider {
  supports(provider: string): boolean {
    return provider === 'mycustom';
  }

  async send(event, payload, integration) {
    // Implement your custom message format and HTTP request
    // Return { success: boolean, error?: string }
  }
}
```

2. Register the provider in `chat-notifications.module.ts`:

```typescript
@Module({
  // ...
  providers: [
    ChatNotificationsService,
    // ... other providers
    MyCustomProvider,
  ],
})
export class ChatNotificationsModule {}
```

3. Update the service constructor to inject your provider:

```typescript
constructor(
  private readonly prisma: PrismaService,
  // ... other providers
  myCustomProvider: MyCustomProvider,
) {
  this.providers = [
    // ... other providers
    myCustomProvider,
  ];
}
```

4. Add the provider to the UI dropdown in `ChatIntegrationsTab.vue`

## Troubleshooting

### Notifications not received

1. **Check integration is enabled**: Ensure the integration status shows "Enabled"
2. **Test the connection**: Use the 🔔 test button
3. **Verify webhook URL**: Make sure the webhook URL is correct and not expired
4. **Check events**: Ensure the correct events are selected
5. **Review logs**: Check the worker logs for error messages

### Invalid webhook URL

Ensure your webhook URL:
- Starts with `https://`
- Is a valid URL format
- Hasn't expired (some platforms expire webhooks after inactivity)

### Messages not formatted correctly

Different platforms have different formatting requirements. If messages appear broken:
- Verify you selected the correct provider
- For custom webhooks, use the "Generic Webhook" provider

## API Reference

### List Integrations

```
GET /projects/:key/chat-integrations
```

### Create Integration

```
POST /projects/:key/chat-integrations
```

Body:
```json
{
  "provider": "slack",
  "webhookUrl": "https://hooks.slack.com/services/...",
  "channel": "general",
  "events": ["analysis.completed", "quality_gate.failed"],
  "enabled": true
}
```

### Update Integration

```
PUT /chat-integrations/:id
```

### Delete Integration

```
DELETE /chat-integrations/:id
```

### Test Integration

```
POST /chat-integrations/:id/test
```

## Best Practices

1. **Use dedicated channels**: Create dedicated channels for code quality notifications to avoid noise
2. **Start with critical events**: Begin with `quality_gate.failed` notifications, then add `analysis.completed` as needed
3. **One integration per channel**: Avoid creating multiple integrations for the same channel
4. **Monitor notification volume**: Adjust events if notifications become too frequent
5. **Use filters wisely**: Consider creating separate integrations for different branches or projects

## Support

For issues or questions about chat integrations, please open an issue on the [GitHub repository](https://github.com/anthropics/qubeless-monorepo/issues).
