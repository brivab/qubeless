import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserRole, AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt');
jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('random-hex-string'));

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        globalRole: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        globalRole: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    const input = {
      email: 'newuser@example.com',
      password: 'password123',
    };

    const mockCreatedUser = {
      id: 'user-123',
      email: 'newuser@example.com',
      passwordHash: 'hashed-password',
      globalRole: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a user with default USER role', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createUser(input, 'creator-123');

      expect(result).toEqual(mockCreatedUser);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          passwordHash: 'hashed-password',
          globalRole: UserRole.USER,
        },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'creator-123',
        action: AuditAction.USER_CREATE,
        targetType: 'User',
        targetId: 'user-123',
        metadata: {
          email: 'newuser@example.com',
          role: UserRole.USER,
          method: 'local',
        },
      });
    });

    it('should create a user with specified role', async () => {
      const adminUser = {
        ...mockCreatedUser,
        globalRole: UserRole.ADMIN,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(adminUser);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createUser(
        { ...input, role: UserRole.ADMIN },
        'creator-123',
      );

      expect(result).toEqual(adminUser);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          passwordHash: 'hashed-password',
          globalRole: UserRole.ADMIN,
        },
      });
    });

    it('should create a user via SSO method', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.createUser(input, 'creator-123', 'sso');

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'creator-123',
        action: AuditAction.USER_CREATE,
        targetType: 'User',
        targetId: 'user-123',
        metadata: {
          email: 'newuser@example.com',
          role: UserRole.USER,
          method: 'sso',
        },
      });
    });

    it('should create a user without creator', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createUser(input);

      expect(result).toEqual(mockCreatedUser);
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: undefined,
        action: AuditAction.USER_CREATE,
        targetType: 'User',
        targetId: 'user-123',
        metadata: {
          email: 'newuser@example.com',
          role: UserRole.USER,
          method: 'local',
        },
      });
    });
  });

  describe('createSsoUser', () => {
    it('should create an SSO user with random password', async () => {
      const mockCreatedUser = {
        id: 'user-123',
        email: 'ssouser@example.com',
        passwordHash: 'hashed-random',
        globalRole: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-random');
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createSsoUser('ssouser@example.com', undefined, 'creator-123');

      expect(result).toEqual(mockCreatedUser);
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_CREATE,
        }),
      );
    });

    it('should create an SSO user with specified role', async () => {
      const mockAdminUser = {
        id: 'user-123',
        email: 'admin@example.com',
        passwordHash: 'hashed-random',
        globalRole: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-random');
      mockPrismaService.user.create.mockResolvedValue(mockAdminUser);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.createSsoUser('admin@example.com', UserRole.ADMIN);

      expect(result).toEqual(mockAdminUser);
    });
  });

  describe('toUserDTO', () => {
    it('should convert user to UserDTO', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        globalRole: UserRole.USER,
        mfaEnabled: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const result = service.toUserDTO(mockUser);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        globalRole: UserRole.USER,
        mfaEnabled: false,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-02').toISOString(),
      });
    });

    it('should return null for null user', () => {
      const result = service.toUserDTO(null);

      expect(result).toBeNull();
    });
  });
});
