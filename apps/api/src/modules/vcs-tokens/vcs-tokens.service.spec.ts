import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PullRequestProvider } from '@prisma/client';
import { VcsTokensService } from './vcs-tokens.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VcsTokensService', () => {
  let service: VcsTokensService;

  const mockPrismaService = {
    vcsToken: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const buildTokenRecord = (data: Record<string, any>) => ({
    id: 'token-1',
    provider: PullRequestProvider.GITHUB,
    baseUrl: null,
    userId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...data,
  });

  beforeEach(async () => {
    process.env.VCS_TOKEN_ENCRYPTION_KEY = 'unit-test-vcs-token-encryption-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VcsTokensService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VcsTokensService>(VcsTokensService);

    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.VCS_TOKEN_ENCRYPTION_KEY;
  });

  describe('list', () => {
    it('should return sanitized tokens with masked value', async () => {
      const tokenEncrypted = (service as any).encrypt('1234567890123456');
      const record = buildTokenRecord({ tokenEncrypted });
      mockPrismaService.vcsToken.findMany.mockResolvedValue([record]);

      const result = await service.list();

      expect(mockPrismaService.vcsToken.findMany).toHaveBeenCalledWith({
        orderBy: { provider: 'asc' },
      });
      expect(result).toEqual([
        expect.objectContaining({
          id: 'token-1',
          tokenMasked: '***90123456',
          hasToken: true,
        }),
      ]);
      expect((result[0] as any).tokenEncrypted).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should throw when token is missing', async () => {
      await expect(
        service.create({
          provider: PullRequestProvider.GITHUB,
          token: '   ',
        }),
      ).rejects.toThrow(new BadRequestException('Token is required'));
    });

    it('should throw when provider token already exists', async () => {
      mockPrismaService.vcsToken.findFirst.mockResolvedValue({ id: 'existing-1' });

      await expect(
        service.create({
          provider: PullRequestProvider.GITHUB,
          token: '1234567890123456',
        }),
      ).rejects.toThrow(
        new BadRequestException('Token already exists for provider "GITHUB"'),
      );
    });

    it('should encrypt token and return sanitized output', async () => {
      const dto = {
        provider: PullRequestProvider.GITHUB,
        token: '  1234567890123456  ',
        baseUrl: '  https://git.example.com  ',
      };

      mockPrismaService.vcsToken.findFirst.mockResolvedValue(null);
      mockPrismaService.vcsToken.create.mockImplementation(({ data }: any) =>
        Promise.resolve(buildTokenRecord(data)),
      );

      const result = await service.create(dto);

      expect(mockPrismaService.vcsToken.create).toHaveBeenCalled();
      const createCall = mockPrismaService.vcsToken.create.mock.calls[0][0];
      expect(createCall.data.provider).toBe(PullRequestProvider.GITHUB);
      expect(createCall.data.baseUrl).toBe('https://git.example.com');
      expect(createCall.data.userId).toBeNull();
      expect(createCall.data.tokenEncrypted).not.toBe('1234567890123456');
      expect(result).toEqual(
        expect.objectContaining({
          provider: PullRequestProvider.GITHUB,
          tokenMasked: '***90123456',
          hasToken: true,
          baseUrl: 'https://git.example.com',
        }),
      );
      expect((result as any).tokenEncrypted).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should throw when token does not exist', async () => {
      mockPrismaService.vcsToken.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', {})).rejects.toThrow(
        new NotFoundException('VCS token with id "missing-id" not found'),
      );
    });

    it('should throw when token field is provided but empty', async () => {
      const existing = buildTokenRecord({
        tokenEncrypted: (service as any).encrypt('1234567890123456'),
      });
      mockPrismaService.vcsToken.findUnique.mockResolvedValue(existing);

      await expect(service.update('token-1', { token: '   ' })).rejects.toThrow(
        new BadRequestException('Token is required'),
      );
    });

    it('should return existing token when no mutable field is provided', async () => {
      const existing = buildTokenRecord({
        tokenEncrypted: (service as any).encrypt('1234567890123456'),
      });
      mockPrismaService.vcsToken.findUnique.mockResolvedValue(existing);

      const result = await service.update('token-1', {});

      expect(mockPrismaService.vcsToken.update).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: 'token-1',
          tokenMasked: '***90123456',
          hasToken: true,
        }),
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when delete fails', async () => {
      mockPrismaService.vcsToken.delete.mockRejectedValue(new Error('delete failed'));

      await expect(service.remove('unknown-id')).rejects.toThrow(
        new NotFoundException('VCS token with id "unknown-id" not found'),
      );
    });
  });

  describe('upsertForUser', () => {
    it('should update existing user token', async () => {
      const existing = buildTokenRecord({
        id: 'token-user-1',
        userId: 'user-1',
        tokenEncrypted: (service as any).encrypt('1111111111111111'),
      });
      mockPrismaService.vcsToken.findFirst.mockResolvedValue(existing);
      mockPrismaService.vcsToken.update.mockImplementation(({ data, where }: any) =>
        Promise.resolve(
          buildTokenRecord({
            id: where.id,
            userId: 'user-1',
            provider: PullRequestProvider.GITHUB,
            ...data,
          }),
        ),
      );

      const result = await service.upsertForUser('user-1', {
        provider: PullRequestProvider.GITHUB,
        token: ' 1234567890123456 ',
        baseUrl: ' https://github.enterprise.local ',
      });

      expect(mockPrismaService.vcsToken.update).toHaveBeenCalledWith({
        where: { id: 'token-user-1' },
        data: expect.objectContaining({
          baseUrl: 'https://github.enterprise.local',
        }),
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'token-user-1',
          hasToken: true,
          tokenMasked: '***90123456',
        }),
      );
    });
  });

  describe('removeForUser', () => {
    it('should throw when user token does not exist', async () => {
      mockPrismaService.vcsToken.findFirst.mockResolvedValue(null);

      await expect(
        service.removeForUser('user-1', PullRequestProvider.GITHUB),
      ).rejects.toThrow(
        new NotFoundException('VCS token for provider "GITHUB" not found'),
      );
    });
  });
});
