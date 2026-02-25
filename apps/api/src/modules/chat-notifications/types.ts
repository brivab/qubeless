export type ChatEvent = 'analysis.completed' | 'quality_gate.failed';

export type ChatMessageStatus = 'SUCCESS' | 'FAILED';

export interface ChatMessagePayload {
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

export interface ChatIntegrationData {
  id: number;
  projectId: string;
  provider: string;
  webhookUrl: string;
  channel?: string | null;
  events: string[];
  enabled: boolean;
}

export interface SendNotificationResult {
  success: boolean;
  error?: string;
}
