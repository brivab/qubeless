import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LlmProvidersService } from './llm-providers.service';
import { PrismaService } from '../prisma/prisma.service';

global.fetch = jest.fn();

describe('LlmProvidersService', () => {
  let service: LlmProvidersService;

  const mockPrismaService = {
    llmProvider: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const buildProviderRecord = (data: Record<string, unknown>) => ({
    id: 'provider-1',
    name: 'OpenAI',
    providerType: 'openai',
    baseUrl: 'https://api.openai.com/v1/models',
    model: null,
    headersJson: Prisma.JsonNull,
    tokenEncrypted: null,
    isDefault: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...data,
  });

  beforeEach(async () => {
    process.env.LLM_PROVIDER_ENCRYPTION_KEY = 'unit-test-llm-provider-encryption-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmProvidersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LlmProvidersService>(LlmProvidersService);

    mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        llmProvider: {
          create: mockPrismaService.llmProvider.create,
          update: mockPrismaService.llmProvider.update,
          updateMany: mockPrismaService.llmProvider.updateMany,
        },
      });
    });

    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.LLM_PROVIDER_ENCRYPTION_KEY;
  });

  describe('list', () => {
    it('should return sanitized providers with masked token', async () => {
      const tokenEncrypted = (service as any).encrypt('sk-1234567890abcdef');
      mockPrismaService.llmProvider.findMany.mockResolvedValue([
        buildProviderRecord({ tokenEncrypted }),
      ]);

      const result = await service.list();

      expect(mockPrismaService.llmProvider.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: 'provider-1',
          tokenMasked: '***90abcdef',
          hasToken: true,
        }),
      ]);
      expect((result[0] as any).tokenEncrypted).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should disable existing default providers when creating a default one', async () => {
      mockPrismaService.llmProvider.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.llmProvider.create.mockImplementation(({ data }: any) =>
        Promise.resolve(buildProviderRecord(data)),
      );

      const result = await service.create({
        name: '  OpenAI  ',
        providerType: ' openai ',
        baseUrl: ' https://api.openai.com/v1/models ',
        model: ' gpt-4o-mini ',
        token: ' sk-1234567890abcdef ',
        isDefault: true,
      });

      expect(mockPrismaService.llmProvider.updateMany).toHaveBeenCalledWith({
        data: { isDefault: false },
        where: { isDefault: true },
      });
      const createCall = mockPrismaService.llmProvider.create.mock.calls[0][0];
      expect(createCall.data.name).toBe('OpenAI');
      expect(createCall.data.providerType).toBe('openai');
      expect(createCall.data.baseUrl).toBe('https://api.openai.com/v1/models');
      expect(createCall.data.model).toBe('gpt-4o-mini');
      expect(createCall.data.tokenEncrypted).not.toBe('sk-1234567890abcdef');
      expect(result).toEqual(
        expect.objectContaining({
          name: 'OpenAI',
          isDefault: true,
          hasToken: true,
          tokenMasked: '***90abcdef',
        }),
      );
    });
  });

  describe('update', () => {
    it('should throw when provider does not exist', async () => {
      mockPrismaService.llmProvider.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', {})).rejects.toThrow(
        new NotFoundException('LLM provider with id "missing-id" not found'),
      );
    });

    it('should clear token and normalize optional fields', async () => {
      const existing = buildProviderRecord({
        tokenEncrypted: (service as any).encrypt('sk-old-token-123456'),
      });
      mockPrismaService.llmProvider.findUnique.mockResolvedValue(existing);
      mockPrismaService.llmProvider.update.mockImplementation(({ data }: any) =>
        Promise.resolve(buildProviderRecord(data)),
      );

      await service.update('provider-1', {
        model: null,
        headersJson: null,
        token: '   ',
      });

      expect(mockPrismaService.llmProvider.update).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
        data: expect.objectContaining({
          model: null,
          headersJson: Prisma.JsonNull,
          tokenEncrypted: null,
        }),
      });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when delete fails', async () => {
      mockPrismaService.llmProvider.delete.mockRejectedValue(new Error('delete failed'));

      await expect(service.remove('missing-id')).rejects.toThrow(
        new NotFoundException('LLM provider with id "missing-id" not found'),
      );
    });
  });

  describe('testConnection', () => {
    it('should throw when provider does not exist', async () => {
      mockPrismaService.llmProvider.findUnique.mockResolvedValue(null);

      await expect(service.testConnection('missing-id')).rejects.toThrow(
        new NotFoundException('LLM provider with id "missing-id" not found'),
      );
    });

    it('should merge headers and inject bearer token when authorization is absent', async () => {
      const tokenEncrypted = (service as any).encrypt('secret-token');
      mockPrismaService.llmProvider.findUnique.mockResolvedValue(
        buildProviderRecord({
          baseUrl: 'https://llm.example.com/ping',
          tokenEncrypted,
          headersJson: {
            'X-Trace-Id': 123,
            'X-Client': 'qubeless',
            'X-Null': null,
          },
        }),
      );
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.testConnection('provider-1');

      expect(result).toEqual({ success: true, status: 200 });
      expect(global.fetch).toHaveBeenCalledWith('https://llm.example.com/ping', {
        method: 'GET',
        headers: {
          'X-Trace-Id': '123',
          'X-Client': 'qubeless',
          Authorization: 'Bearer secret-token',
        },
      });
    });

    it('should preserve existing authorization header', async () => {
      const tokenEncrypted = (service as any).encrypt('secret-token');
      mockPrismaService.llmProvider.findUnique.mockResolvedValue(
        buildProviderRecord({
          baseUrl: 'https://llm.example.com/ping',
          tokenEncrypted,
          headersJson: { authorization: 'Bearer already-there' },
        }),
      );
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 204,
      });

      await service.testConnection('provider-1');

      const fetchArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchArgs.headers).toEqual({ authorization: 'Bearer already-there' });
    });

    it('should throw BadRequestException on network error', async () => {
      mockPrismaService.llmProvider.findUnique.mockResolvedValue(
        buildProviderRecord({ baseUrl: 'https://llm.example.com/ping' }),
      );
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

      await expect(service.testConnection('provider-1')).rejects.toThrow(
        new BadRequestException('Connection failed: network down'),
      );
    });

    it('should throw BadRequestException when provider ping fails', async () => {
      mockPrismaService.llmProvider.findUnique.mockResolvedValue(
        buildProviderRecord({ baseUrl: 'https://llm.example.com/ping' }),
      );
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(service.testConnection('provider-1')).rejects.toThrow(
        new BadRequestException('Provider ping failed (503)'),
      );
    });
  });
});
