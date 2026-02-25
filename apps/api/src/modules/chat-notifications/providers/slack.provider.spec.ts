import { Test, TestingModule } from '@nestjs/testing';
import { SlackProvider } from './slack.provider';
import { ChatMessagePayload, ChatIntegrationData } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('SlackProvider', () => {
  let provider: SlackProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlackProvider],
    }).compile();

    provider = module.get<SlackProvider>(SlackProvider);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('supports', () => {
    it('should support slack provider', () => {
      expect(provider.supports('slack')).toBe(true);
    });

    it('should not support other providers', () => {
      expect(provider.supports('teams')).toBe(false);
      expect(provider.supports('discord')).toBe(false);
      expect(provider.supports('generic')).toBe(false);
    });
  });

  describe('send', () => {
    const mockPayload: ChatMessagePayload = {
      projectName: 'Test Project',
      projectKey: 'test-project',
      branch: 'main',
      status: 'SUCCESS',
      issuesCount: 10,
      newIssuesCount: 2,
      qualityGateStatus: 'PASS',
      url: 'https://example.com/analysis/123',
      commitSha: 'abc123',
    };

    const mockIntegration: ChatIntegrationData = {
      id: 1,
      projectId: 'proj-1',
      provider: 'slack',
      webhookUrl: 'https://hooks.slack.com/test',
      channel: 'general',
      events: ['analysis.completed'],
      enabled: true,
    };

    it('should send notification successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await provider.send('analysis.completed', mockPayload, mockIntegration);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        mockIntegration.webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      const result = await provider.send('analysis.completed', mockPayload, mockIntegration);

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await provider.send('analysis.completed', mockPayload, mockIntegration);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should include channel in message when provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      await provider.send('analysis.completed', mockPayload, mockIntegration);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.channel).toBe('general');
    });

    it('should not include channel when not provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const integrationWithoutChannel = { ...mockIntegration, channel: undefined };
      await provider.send('analysis.completed', mockPayload, integrationWithoutChannel);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.channel).toBeUndefined();
    });

    it('should include warning message for quality gate failed', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const failedPayload = { ...mockPayload, qualityGateStatus: 'FAIL' as const };
      await provider.send('quality_gate.failed', failedPayload, mockIntegration);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      // Check that blocks include a context block with warning
      const hasWarningBlock = body.blocks.some((block: any) =>
        block.type === 'context' &&
        block.elements?.some((el: any) => el.text?.includes('Quality gate failed'))
      );

      expect(hasWarningBlock).toBe(true);
    });
  });
});
