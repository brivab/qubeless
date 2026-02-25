import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LdapService } from './ldap/ldap.service';
import { UserRole, SsoProvider, AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    toUserDTO: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockPrismaService = {
    ssoIdentity: {
      findFirst: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockLdapService = {
    authenticate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: LdapService, useValue: mockLdapService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    const credentials = {
      email: 'user@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-123',
      email: 'user@example.com',
      passwordHash: 'hashed-password',
      globalRole: UserRole.USER,
      mfaEnabled: false,
      createdAt: new Date(),
    };

    it('should return access token and user for valid credentials', async () => {
      const mockUserDTO = {
        id: 'user-123',
        email: 'user@example.com',
        globalRole: UserRole.USER,
        mfaEnabled: false,
        createdAt: mockUser.createdAt.toISOString(),
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('jwt-token');
      mockUsersService.toUserDTO.mockReturnValue(mockUserDTO);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.login(credentials);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: mockUserDTO,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        metadata: { method: 'local' },
      });
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(credentials)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(credentials)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });
  });

  describe('loginWithUser', () => {
    const mockUser = {
      id: 'user-123',
      email: 'user@example.com',
      passwordHash: 'hashed-password',
      globalRole: UserRole.USER,
      mfaEnabled: false,
      createdAt: new Date(),
    };

    const mockUserDTO = {
      id: 'user-123',
      email: 'user@example.com',
      globalRole: UserRole.USER,
      mfaEnabled: false,
      createdAt: mockUser.createdAt.toISOString(),
    };

    it('should return access token for SSO user', async () => {
      mockJwtService.signAsync.mockResolvedValue('jwt-token');
      mockUsersService.toUserDTO.mockReturnValue(mockUserDTO);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.loginWithUser(mockUser, 'sso');

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: mockUserDTO,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        metadata: { method: 'sso' },
      });
    });

    it('should return access token for local user', async () => {
      mockJwtService.signAsync.mockResolvedValue('jwt-token');
      mockUsersService.toUserDTO.mockReturnValue(mockUserDTO);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.loginWithUser(mockUser, 'local');

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: mockUserDTO,
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        metadata: { method: 'local' },
      });
    });

    it('should default to sso method when not specified', async () => {
      mockJwtService.signAsync.mockResolvedValue('jwt-token');
      mockUsersService.toUserDTO.mockReturnValue(mockUserDTO);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.loginWithUser(mockUser);

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        metadata: { method: 'sso' },
      });
    });
  });

  describe('ensureAdminUser', () => {
    it('should create admin user when it does not exist', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ADMIN_EMAIL') return 'admin@example.com';
        if (key === 'ADMIN_PASSWORD') return 'admin123';
        return undefined;
      });

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        globalRole: UserRole.ADMIN,
      });

      await service.ensureAdminUser();

      expect(mockUsersService.createUser).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'admin123',
      });
    });

    it('should not create admin user when it already exists', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ADMIN_EMAIL') return 'admin@example.com';
        if (key === 'ADMIN_PASSWORD') return 'admin123';
        return undefined;
      });

      mockUsersService.findByEmail.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        globalRole: UserRole.ADMIN,
      });

      await service.ensureAdminUser();

      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });

    it('should use default credentials when env vars are not set', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue({});

      await service.ensureAdminUser();

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('admin@example.com');
      expect(mockUsersService.createUser).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'admin123',
      });
    });
  });

  describe('logout', () => {
    it('should return empty object for local user', async () => {
      mockPrismaService.ssoIdentity.findFirst.mockResolvedValue(null);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.logout('user-123');

      expect(result).toEqual({});
      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGOUT,
        metadata: {
          method: 'local',
          provider: undefined,
        },
      });
    });

    it('should return OIDC logout URL for OIDC user', async () => {
      const mockSsoIdentity = {
        id: 'sso-123',
        userId: 'user-123',
        provider: SsoProvider.OIDC,
        externalId: 'ext-123',
        createdAt: new Date(),
      };

      mockPrismaService.ssoIdentity.findFirst.mockResolvedValue(mockSsoIdentity);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SSO_OIDC_LOGOUT_URL') return 'https://oidc.example.com/logout';
        return undefined;
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.logout('user-123');

      expect(result).toEqual({
        ssoLogoutUrl: 'https://oidc.example.com/logout',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGOUT,
        metadata: {
          method: 'sso',
          provider: SsoProvider.OIDC,
        },
      });
    });

    it('should return SAML logout URL for SAML user', async () => {
      const mockSsoIdentity = {
        id: 'sso-123',
        userId: 'user-123',
        provider: SsoProvider.SAML,
        externalId: 'ext-123',
        createdAt: new Date(),
      };

      mockPrismaService.ssoIdentity.findFirst.mockResolvedValue(mockSsoIdentity);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SSO_SAML_LOGOUT_URL') return 'https://saml.example.com/logout';
        return undefined;
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.logout('user-123');

      expect(result).toEqual({
        ssoLogoutUrl: 'https://saml.example.com/logout',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith({
        actorUserId: 'user-123',
        action: AuditAction.AUTH_LOGOUT,
        metadata: {
          method: 'sso',
          provider: SsoProvider.SAML,
        },
      });
    });

    it('should return empty ssoLogoutUrl when logout URL is not configured', async () => {
      const mockSsoIdentity = {
        id: 'sso-123',
        userId: 'user-123',
        provider: SsoProvider.OIDC,
        externalId: 'ext-123',
        createdAt: new Date(),
      };

      mockPrismaService.ssoIdentity.findFirst.mockResolvedValue(mockSsoIdentity);
      mockConfigService.get.mockReturnValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.logout('user-123');

      expect(result).toEqual({ ssoLogoutUrl: undefined });
    });
  });
});
