import { ChatEvent, ChatMessagePayload, ChatIntegrationData, SendNotificationResult } from '../types';

export interface ChatProvider {
  /**
   * Check if this provider supports the given provider name
   */
  supports(provider: string): boolean;

  /**
   * Send a notification message
   */
  send(
    event: ChatEvent,
    payload: ChatMessagePayload,
    integration: ChatIntegrationData,
  ): Promise<SendNotificationResult>;
}
