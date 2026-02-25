import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

describe('AuditService', () => {
  let service: AuditService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      const mockAuditLog = {
        id: 'audit-123',
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        targetType: null,
        targetId: null,
        metadata: { method: 'local' },
        createdAt: new Date(),
        actor: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.log({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        metadata: { method: 'local' },
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorUserId: 'user-123',
          action: AuditAction.AUTH_LOGIN,
          targetType: null,
          targetId: null,
          metadata: { method: 'local' },
        },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      expect(result).toEqual({
        id: 'audit-123',
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        targetType: null,
        targetId: null,
        metadata: { method: 'local' },
        createdAt: mockAuditLog.createdAt.toISOString(),
        actor: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });
    });

    it('should sanitize sensitive metadata fields', async () => {
      const mockAuditLog = {
        id: 'audit-123',
        actorUserId: 'user-123',
        action: AuditAction.PROJECT_CREATE,
        targetType: 'Project',
        targetId: 'project-123',
        metadata: { projectName: 'Test' },
        createdAt: new Date(),
        actor: null,
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.log({
        actorUserId: 'user-123',
        action: AuditAction.PROJECT_CREATE,
        targetType: 'Project',
        targetId: 'project-123',
        metadata: {
          projectName: 'Test',
          password: 'secret123',
          token: 'bearer-token',
          apiKey: 'api-key-secret',
        },
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: { projectName: 'Test' },
          }),
        }),
      );
    });

    it('should handle null actor', async () => {
      const mockAuditLog = {
        id: 'audit-123',
        actorUserId: null,
        action: AuditAction.PROJECT_CREATE,
        targetType: 'Project',
        targetId: 'project-123',
        metadata: null,
        createdAt: new Date(),
        actor: null,
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.log({
        action: AuditAction.PROJECT_CREATE,
        targetType: 'Project',
        targetId: 'project-123',
      });

      expect(result.actorUserId).toBeNull();
      expect(result.actor).toBeUndefined();
    });
  });

  describe('findMany', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          actorUserId: 'user-123',
          action: AuditAction.AUTH_LOGIN,
          targetType: null,
          targetId: null,
          metadata: null,
          createdAt: new Date(),
          actor: { id: 'user-123', email: 'test@example.com' },
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.findMany({
        actorUserId: 'user-123',
        limit: 10,
        offset: 0,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { actorUserId: 'user-123' },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should apply all filters', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.findMany({
        actorUserId: 'user-123',
        action: AuditAction.PROJECT_CREATE,
        targetType: 'Project',
        targetId: 'project-123',
        limit: 20,
        offset: 10,
      });

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            actorUserId: 'user-123',
            action: AuditAction.PROJECT_CREATE,
            targetType: 'Project',
            targetId: 'project-123',
          },
          take: 20,
          skip: 10,
        }),
      );
    });

    it('should default to limit 100', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.findMany({});

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return an audit log by id', async () => {
      const mockLog = {
        id: 'audit-123',
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        targetType: null,
        targetId: null,
        metadata: null,
        createdAt: new Date(),
        actor: { id: 'user-123', email: 'test@example.com' },
      };

      mockPrismaService.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await service.findById('audit-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('audit-123');
      expect(prismaService.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'audit-123' },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    });

    it('should return null if not found', async () => {
      mockPrismaService.auditLog.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });
});
