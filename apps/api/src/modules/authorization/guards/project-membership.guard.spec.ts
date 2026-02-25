import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectMembershipGuard } from './project-membership.guard';
import { AuthorizationService } from '../authorization.service';
import { UserRole, ProjectRole } from '@prisma/client';
import { AuthPayload } from '../../auth/auth.types';

describe('ProjectMembershipGuard', () => {
  let guard: ProjectMembershipGuard;

  const mockAuthzService = {
    canAccessProject: jest.fn(),
    isStrictMode: jest.fn(),
    resolveProjectId: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectMembershipGuard,
        { provide: AuthorizationService, useValue: mockAuthzService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<ProjectMembershipGuard>(ProjectMembershipGuard);

    jest.clearAllMocks();

    // Default mock: resolveProjectId returns the input unchanged
    mockAuthzService.resolveProjectId.mockImplementation((id) => Promise.resolve(id));
  });

  const createMockExecutionContext = (
    user: AuthPayload | null,
    params: Record<string, string> = {},
    query: Record<string, string> = {},
    body: Record<string, unknown> = {},
  ): ExecutionContext => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          query,
          body,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  };

  it('should throw ForbiddenException when user is not authenticated', async () => {
    const context = createMockExecutionContext(null);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException when projectId is not found', async () => {
    const user: AuthPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: UserRole.USER,
    };
    const context = createMockExecutionContext(user, {}, {}, {});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should allow access for ADMIN users', async () => {
    const user: AuthPayload = {
      sub: 'admin-123',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };
    const context = createMockExecutionContext(user, { projectId: 'project-456' });

    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    mockAuthzService.canAccessProject.mockResolvedValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthzService.canAccessProject).toHaveBeenCalledWith(
      'admin-123',
      'project-456',
      UserRole.ADMIN,
      undefined,
    );
  });

  it('should check project membership for regular users in STRICT mode', async () => {
    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };
    const context = createMockExecutionContext(user, { projectId: 'project-456' });

    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    mockAuthzService.canAccessProject.mockResolvedValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should deny access when user has no membership in STRICT mode', async () => {
    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };
    const context = createMockExecutionContext(user, { projectId: 'project-456' });

    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    mockAuthzService.canAccessProject.mockResolvedValue(false);
    mockAuthzService.isStrictMode.mockReturnValue(true);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should check required roles when decorator is present', async () => {
    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };
    const context = createMockExecutionContext(user, { projectId: 'project-456' });

    mockReflector.getAllAndOverride.mockReturnValue([ProjectRole.PROJECT_ADMIN]);
    mockAuthzService.canAccessProject.mockResolvedValue(false);
    mockAuthzService.isStrictMode.mockReturnValue(true);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);

    expect(mockAuthzService.canAccessProject).toHaveBeenCalledWith(
      'user-123',
      'project-456',
      UserRole.USER,
      [ProjectRole.PROJECT_ADMIN],
    );
  });

  it('should extract projectId from params.id', async () => {
    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };
    const context = createMockExecutionContext(user, { id: 'project-789' });

    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    mockAuthzService.canAccessProject.mockResolvedValue(true);

    await guard.canActivate(context);

    expect(mockAuthzService.canAccessProject).toHaveBeenCalledWith(
      'user-123',
      'project-789',
      UserRole.USER,
      undefined,
    );
  });

  it('should extract projectId from query params', async () => {
    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };
    const context = createMockExecutionContext(user, {}, { projectId: 'project-query' });

    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    mockAuthzService.canAccessProject.mockResolvedValue(true);

    await guard.canActivate(context);

    expect(mockAuthzService.canAccessProject).toHaveBeenCalledWith(
      'user-123',
      'project-query',
      UserRole.USER,
      undefined,
    );
  });

  it('should extract projectId from body', async () => {
    const user: AuthPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      role: UserRole.USER,
    };
    const context = createMockExecutionContext(user, {}, {}, { projectId: 'project-body' });

    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    mockAuthzService.canAccessProject.mockResolvedValue(true);

    await guard.canActivate(context);

    expect(mockAuthzService.canAccessProject).toHaveBeenCalledWith(
      'user-123',
      'project-body',
      UserRole.USER,
      undefined,
    );
  });
});
