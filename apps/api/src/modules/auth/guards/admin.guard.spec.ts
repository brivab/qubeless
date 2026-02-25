import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { UserRole } from '@prisma/client';
import { AuthPayload } from '../auth.types';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminGuard],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
  });

  const createMockExecutionContext = (user?: AuthPayload): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access when user is an ADMIN', () => {
      const adminUser: AuthPayload = {
        sub: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      const context = createMockExecutionContext(adminUser);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user is not an ADMIN', () => {
      const regularUser: AuthPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: UserRole.USER,
      };

      const context = createMockExecutionContext(regularUser);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Admin access required'),
      );
    });

    it('should deny access when user is not authenticated', () => {
      const context = createMockExecutionContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });

    it('should deny access when user is null', () => {
      const context = createMockExecutionContext(null as any);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });
  });
});
