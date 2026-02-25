import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChatNotificationsService } from './chat-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlackProvider } from './providers/slack.provider';
import { TeamsProvider } from './providers/teams.provider';
import { DiscordProvider } from './providers/discord.provider';
import { GenericWebhookProvider } from './providers/generic.provider';

describe('ChatNotificationsService', () => {
  let service: ChatNotificationsService;

  const mockPrismaService = {
    chatIntegration: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockSlackProvider = {
    supports: jest.fn((provider: string) => provider === 'slack'),
    send: jest.fn(),
  };
  const mockTeamsProvider = {
    supports: jest.fn((provider: string) => provider === 'teams'),
    send: jest.fn(),
  };
  const mockDiscordProvider = {
    supports: jest.fn((provider: string) => provider === 'discord'),
    send: jest.fn(),
  };
  const mockGenericProvider = {
    supports: jest.fn((provider: string) => provider === 'generic'),
    send: jest.fn(),
  };

  const payload = {
    projectName: 'Project One',
    projectKey: 'proj-one',
    branch: 'main',
    status: 'SUCCESS' as const,
    issuesCount: 3,
    newIssuesCount: 1,
    qualityGateStatus: 'PASS' as const,
    url: 'https://web.example.com/projects/proj-one/analyses/a-1',
    commitSha: 'abcdef1',
  };

  beforeEach(async () => {
    process.env.CHAT_WEBHOOK_ENCRYPTION_KEY = 'unit-test-chat-webhook-encryption-key';
    process.env.WEB_APP_URL = 'https://web.example.com';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatNotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SlackProvider, useValue: mockSlackProvider },
        { provide: TeamsProvider, useValue: mockTeamsProvider },
        { provide: DiscordProvider, useValue: mockDiscordProvider },
        { provide: GenericWebhookProvider, useValue: mockGenericProvider },
      ],
    }).compile();

    service = module.get<ChatNotificationsService>(ChatNotificationsService);

    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.CHAT_WEBHOOK_ENCRYPTION_KEY;
    delete process.env.WEB_APP_URL;
  });

  describe('notify', () => {
    it('should return without sending when no integrations are found', async () => {
      mockPrismaService.chatIntegration.findMany.mockResolvedValue([]);

      await service.notify('project-1', 'analysis.completed', payload);

      expect(mockPrismaService.chatIntegration.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          enabled: true,
          events: {
            has: 'analysis.completed',
          },
        },
      });
      expect(mockSlackProvider.send).not.toHaveBeenCalled();
    });

    it('should route notification to matching provider with decrypted webhook url', async () => {
      const encryptedWebhook = (service as any).encrypt('https://hooks.slack.com/services/test');
      mockPrismaService.chatIntegration.findMany.mockResolvedValue([
        {
          id: 1,
          projectId: 'project-1',
          provider: 'slack',
          webhookUrl: encryptedWebhook,
          channel: 'alerts',
          enabled: true,
          events: ['analysis.completed'],
        },
      ]);
      mockSlackProvider.send.mockResolvedValue({ success: true });

      await service.notify('project-1', 'analysis.completed', payload);

      expect(mockSlackProvider.send).toHaveBeenCalledWith(
        'analysis.completed',
        payload,
        expect.objectContaining({
          id: 1,
          webhookUrl: 'https://hooks.slack.com/services/test',
        }),
      );
    });

    it('should tolerate provider failures and continue', async () => {
      const encryptedWebhook = (service as any).encrypt('https://hooks.slack.com/services/test');
      mockPrismaService.chatIntegration.findMany.mockResolvedValue([
        {
          id: 1,
          projectId: 'project-1',
          provider: 'slack',
          webhookUrl: encryptedWebhook,
          enabled: true,
          events: ['analysis.completed'],
        },
      ]);
      mockSlackProvider.send.mockRejectedValue(new Error('network down'));

      await expect(
        service.notify('project-1', 'analysis.completed', payload),
      ).resolves.toBeUndefined();
    });
  });

  describe('testConnection', () => {
    it('should throw NotFoundException when integration does not exist', async () => {
      mockPrismaService.chatIntegration.findUnique.mockResolvedValue(null);

      await expect(service.testConnection(404)).rejects.toThrow(
        new NotFoundException('Chat integration 404 not found'),
      );
    });

    it('should send test notification with generated payload', async () => {
      const encryptedWebhook = (service as any).encrypt('https://hooks.slack.com/services/test');
      mockPrismaService.chatIntegration.findUnique.mockResolvedValue({
        id: 42,
        projectId: 'project-1',
        provider: 'slack',
        webhookUrl: encryptedWebhook,
        channel: null,
        enabled: true,
        events: ['analysis.completed'],
        project: {
          name: 'Project One',
          key: 'proj-one',
        },
      });
      mockSlackProvider.send.mockResolvedValue({ success: true });

      const result = await service.testConnection(42);

      expect(result).toEqual({ success: true });
      expect(mockSlackProvider.send).toHaveBeenCalledWith(
        'analysis.completed',
        expect.objectContaining({
          projectName: 'Project One',
          projectKey: 'proj-one',
          url: 'https://web.example.com/projects/proj-one',
        }),
        expect.objectContaining({
          id: 42,
          webhookUrl: 'https://hooks.slack.com/services/test',
        }),
      );
    });
  });

  describe('create and update', () => {
    it('should encrypt webhook and use enabled=true by default on create', async () => {
      mockPrismaService.chatIntegration.create.mockResolvedValue({ id: 1 });

      await service.create({
        projectId: 'project-1',
        provider: 'slack',
        webhookUrl: 'https://hooks.slack.com/services/test',
        events: ['analysis.completed'],
      });

      const createCall = mockPrismaService.chatIntegration.create.mock.calls[0][0];
      expect(createCall.data.enabled).toBe(true);
      expect(createCall.data.webhookUrl).not.toBe('https://hooks.slack.com/services/test');
      expect(createCall.data.channel).toBeNull();
    });

    it('should update only provided fields and normalize empty channel', async () => {
      mockPrismaService.chatIntegration.update.mockResolvedValue({ id: 1 });

      await service.update(1, {
        channel: '',
        events: ['quality_gate.failed'],
        enabled: false,
      });

      expect(mockPrismaService.chatIntegration.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          channel: null,
          events: ['quality_gate.failed'],
          enabled: false,
        },
      });
    });
  });

  describe('listForProject and getById', () => {
    it('should return masked webhook urls', async () => {
      const encryptedWebhook = (service as any).encrypt('https://hooks.slack.com/services/ABCDEFGH');
      mockPrismaService.chatIntegration.findMany.mockResolvedValue([
        {
          id: 1,
          projectId: 'project-1',
          provider: 'slack',
          webhookUrl: encryptedWebhook,
          enabled: true,
          events: ['analysis.completed'],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const result = await service.listForProject('project-1');

      expect(result[0].webhookUrl).toBe('***ABCDEFGH');
    });

    it('should throw NotFoundException for missing integration on getById', async () => {
      mockPrismaService.chatIntegration.findUnique.mockResolvedValue(null);

      await expect(service.getById(1)).rejects.toThrow(
        new NotFoundException('Chat integration 1 not found'),
      );
    });
  });
});
