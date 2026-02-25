import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';
import * as crypto from 'crypto';

jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('48charshexstringfortoken12'));

describe('ApiTokensService', () => {
  let service: ApiTokensService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    apiToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiTokensService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ApiTokensService>(ApiTokensService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a global API token', async () => {
      const dto = {
        name: 'My Token',
        projectKey: '',
      };

      const mockCreatedToken = {
        id: 'token-123',
        name: 'My Token',
        projectId: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiToken.create.mockResolvedValue(mockCreatedToken);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create(dto, 'user-123');

      expect(result).toMatchObject({
        id: mockCreatedToken.id,
        name: mockCreatedToken.name,
        projectId: mockCreatedToken.projectId,
      });
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      expect(mockPrismaService.apiToken.create).toHaveBeenCalled();
      const createCall = mockPrismaService.apiToken.create.mock.calls[0][0];
      expect(createCall.data.name).toBe('My Token');
      expect(createCall.data.projectId).toBeUndefined();

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.TOKEN_CREATE,
        targetType: 'ApiToken',
        targetId: 'token-123',
        metadata: {
          tokenName: 'My Token',
          projectId: null,
          projectKey: '',
        },
      });
    });

    it('should create a project-scoped API token', async () => {
      const dto = {
        name: 'Project Token',
        projectKey: 'TEST_PROJECT',
      };

      const mockProject = {
        id: 'project-123',
        key: 'TEST_PROJECT',
        name: 'Test Project',
      };

      const mockCreatedToken = {
        id: 'token-456',
        name: 'Project Token',
        projectId: 'project-123',
        createdAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.apiToken.create.mockResolvedValue(mockCreatedToken);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create(dto, 'user-123');

      expect(result.projectId).toBe('project-123');
      expect(result.token).toBeDefined();

      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { key: 'TEST_PROJECT' },
      });

      expect(mockPrismaService.apiToken.create).toHaveBeenCalled();
      const createCall = mockPrismaService.apiToken.create.mock.calls[0][0];
      expect(createCall.data.name).toBe('Project Token');
      expect(createCall.data.projectId).toBe('project-123');
    });

    it('should create token without userId', async () => {
      const dto = {
        name: 'Anonymous Token',
        projectKey: '',
      };

      const mockCreatedToken = {
        id: 'token-789',
        name: 'Anonymous Token',
        projectId: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiToken.create.mockResolvedValue(mockCreatedToken);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: undefined,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all API tokens', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          name: 'Token 1',
          projectId: null,
          createdAt: new Date('2024-01-02'),
          lastUsedAt: new Date('2024-01-03'),
        },
        {
          id: 'token-2',
          name: 'Token 2',
          projectId: 'project-123',
          createdAt: new Date('2024-01-01'),
          lastUsedAt: null,
        },
      ];

      mockPrismaService.apiToken.findMany.mockResolvedValue(mockTokens);

      const result = await service.findAll();

      expect(result).toEqual(mockTokens);
      expect(mockPrismaService.apiToken.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          projectId: true,
          createdAt: true,
          lastUsedAt: true,
        },
      });
    });
  });

  describe('remove', () => {
    it('should remove an API token', async () => {
      const existingToken = {
        id: 'token-123',
        name: 'My Token',
        projectId: null,
      };

      mockPrismaService.apiToken.findUnique.mockResolvedValue(existingToken);
      mockPrismaService.apiToken.delete.mockResolvedValue(existingToken);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.remove('token-123', 'user-123');

      expect(result).toEqual({ id: 'token-123' });

      expect(mockPrismaService.apiToken.delete).toHaveBeenCalledWith({
        where: { id: 'token-123' },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.TOKEN_DELETE,
        targetType: 'ApiToken',
        targetId: 'token-123',
        metadata: {
          tokenName: 'My Token',
          projectId: null,
        },
      });
    });

    it('should throw NotFoundException when token does not exist', async () => {
      mockPrismaService.apiToken.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        new NotFoundException('Token nonexistent not found'),
      );

      expect(mockPrismaService.apiToken.delete).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('should validate and update lastUsedAt for valid token', async () => {
      const token = '48charshexstringfortoken12';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const mockTokenRecord = {
        id: 'token-123',
        name: 'My Token',
        projectId: null,
        tokenHash,
        createdAt: new Date(),
        lastUsedAt: null,
      };

      const updatedTokenRecord = {
        ...mockTokenRecord,
        lastUsedAt: new Date(),
      };

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockTokenRecord);
      mockPrismaService.apiToken.update.mockResolvedValue(updatedTokenRecord);

      const result = await service.validate(token);

      expect(result).toEqual(mockTokenRecord);

      expect(mockPrismaService.apiToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
      });

      expect(mockPrismaService.apiToken.update).toHaveBeenCalled();
      const updateCall = mockPrismaService.apiToken.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('token-123');
      expect(updateCall.data.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should return null for invalid token', async () => {
      const token = 'invalidtoken';

      mockPrismaService.apiToken.findUnique.mockResolvedValue(null);

      const result = await service.validate(token);

      expect(result).toBeNull();
      expect(mockPrismaService.apiToken.update).not.toHaveBeenCalled();
    });
  });
});
