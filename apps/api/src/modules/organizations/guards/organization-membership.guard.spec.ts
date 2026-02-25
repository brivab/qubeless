import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationMembershipGuard } from './organization-membership.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgRole, UserRole } from '@prisma/client';
import { AuthPayload } from '../../auth/auth.types';

describe('OrganizationMembershipGuard', () => {
  let guard: OrganizationMembershipGuard;
  let prismaService: PrismaService;
  let reflector: Reflector;

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
    },
    organizationMembership: {
      findUnique: jest.fn(),
    },
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationMembershipGuard,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<OrganizationMembershipGuard>(OrganizationMembershipGuard);
    prismaService = module.get<PrismaService>(PrismaService);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    user?: AuthPayload,
    params: any = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('Authentication checks', () => {
    it('should throw ForbiddenException when user is not authenticated', async () => {
      const context = createMockExecutionContext(undefined, { slug: 'test-org' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should throw ForbiddenException when user is null', async () => {
      const context = createMockExecutionContext(null as any, { slug: 'test-org' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });
  });

  describe('Global ADMIN bypass', () => {
    it('should allow global ADMIN to access any organization', async () => {
      const adminUser: AuthPayload = {
        sub: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      const context = createMockExecutionContext(adminUser, { slug: 'test-org' });
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Organization slug validation', () => {
    it('should throw NotFoundException when organization slug is missing', async () => {
      const user: AuthPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: UserRole.USER,
      };

      const context = createMockExecutionContext(user, {});

      await expect(guard.canActivate(context)).rejects.toThrow(
        new NotFoundException('Organization slug not found in request'),
      );
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      const user: AuthPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: UserRole.USER,
      };

      const context = createMockExecutionContext(user, { slug: 'non-existent' });
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new NotFoundException('Organization "non-existent" not found'),
      );
    });
  });

  describe('Membership validation', () => {
    const mockOrg = {
      id: 'org-456',
      slug: 'test-org',
      name: 'Test Organization',
    };

    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(null);
      mockReflector.getAllAndOverride.mockReturnValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('You are not a member of this organization'),
      );
    });

    it('should allow access when user is a member (no role requirement)', async () => {
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.MEMBER,
      };

      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.organizationMembership.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-456',
            userId: 'user-123',
          },
        },
      });
    });
  });

  describe('Role-based access control', () => {
    const mockOrg = {
      id: 'org-456',
      slug: 'test-org',
      name: 'Test Organization',
    };

    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
    });

    it('should allow access when user has required OWNER role', async () => {
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.OWNER,
      };

      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue([OrgRole.OWNER]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required ADMIN role', async () => {
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.ADMIN,
      };

      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue([OrgRole.ADMIN, OrgRole.OWNER]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user role does not meet requirement', async () => {
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.MEMBER,
      };

      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue([OrgRole.ADMIN, OrgRole.OWNER]);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Requires one of the following roles: ADMIN, OWNER'),
      );
    });

    it('should handle single required role', async () => {
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.MEMBER,
      };

      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue([OrgRole.OWNER]);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Requires one of the following roles: OWNER'),
      );
    });

    it('should allow OWNER to access ADMIN-required resources', async () => {
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.OWNER,
      };

      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue([OrgRole.ADMIN, OrgRole.OWNER]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle empty required roles array', async () => {
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.MEMBER,
      };

      const context = createMockExecutionContext(user, { slug: 'test-org' });
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue([]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete flow: regular user accessing member-only resource', async () => {
      const user: AuthPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: UserRole.USER,
      };

      const mockOrg = {
        id: 'org-456',
        slug: 'my-org',
        name: 'My Organization',
      };

      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.MEMBER,
      };

      const context = createMockExecutionContext(user, { slug: 'my-org' });
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'my-org' },
      });
    });

    it('should handle complete flow: org admin accessing admin-only resource', async () => {
      const user: AuthPayload = {
        sub: 'user-123',
        email: 'admin@example.com',
        role: UserRole.USER,
      };

      const mockOrg = {
        id: 'org-456',
        slug: 'my-org',
        name: 'My Organization',
      };

      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: OrgRole.ADMIN,
      };

      const context = createMockExecutionContext(user, { slug: 'my-org' });
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrismaService.organizationMembership.findUnique.mockResolvedValue(mockMembership);
      mockReflector.getAllAndOverride.mockReturnValue([OrgRole.ADMIN, OrgRole.OWNER]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
