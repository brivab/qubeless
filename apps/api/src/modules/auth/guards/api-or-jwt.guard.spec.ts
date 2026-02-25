import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ApiOrJwtGuard } from './api-or-jwt.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

describe('ApiOrJwtGuard', () => {
  let guard: ApiOrJwtGuard;
  let prismaService: PrismaService;
  let jwtAuthGuard: JwtAuthGuard;

  const mockPrismaService = {
    apiToken: {
      findUnique: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    analysis: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiOrJwtGuard,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtAuthGuard, useValue: mockJwtAuthGuard },
      ],
    }).compile();

    guard = module.get<ApiOrJwtGuard>(ApiOrJwtGuard);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    headers: any = {},
    params: any = {},
    apiToken?: any,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          params,
          apiToken,
        }),
      }),
    } as ExecutionContext;
  };

  const hashToken = (token: string) => {
    return createHash('sha256').update(token).digest('hex');
  };

  describe('API Token Authentication', () => {
    it('should allow access with valid API token (no project restriction)', async () => {
      const token = 'valid-api-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: null,
      };

      const context = createMockExecutionContext(
        { authorization: `Bearer ${token}` },
        {},
      );

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtAuthGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should allow access with API token pre-populated by middleware', async () => {
      const mockToken = {
        id: 'token-123',
        projectId: null,
      };

      const context = createMockExecutionContext({}, {}, mockToken);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.apiToken.findUnique).not.toHaveBeenCalled();
      expect(mockJwtAuthGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should enforce project restriction when token has projectId', async () => {
      const token = 'project-scoped-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: 'project-456',
      };

      const mockProject = {
        id: 'project-456',
      };

      const context = createMockExecutionContext(
        { authorization: `Bearer ${token}` },
        { key: 'project-key' },
      );

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { key: 'project-key' },
        select: { id: true },
      });
    });

    it('should deny access when token projectId does not match route project', async () => {
      const token = 'project-scoped-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: 'project-456',
      };

      const mockProject = {
        id: 'project-999', // Different project
      };

      const context = createMockExecutionContext(
        { authorization: `Bearer ${token}` },
        { key: 'wrong-project' },
      );

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should allow project creation when project does not exist', async () => {
      const token = 'project-scoped-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: 'project-456',
      };

      const context = createMockExecutionContext(
        { authorization: `Bearer ${token}` },
        { key: 'new-project' },
      );

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should enforce project restriction via analysisId', async () => {
      const token = 'project-scoped-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: 'project-456',
      };

      const mockAnalysis = {
        projectId: 'project-456',
      };

      const context = createMockExecutionContext(
        { authorization: `Bearer ${token}` },
        { id: 'analysis-789' },
      );

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.analysis.findUnique.mockResolvedValue(mockAnalysis);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.analysis.findUnique).toHaveBeenCalledWith({
        where: { id: 'analysis-789' },
        select: { projectId: true },
      });
    });

    it('should deny access when analysis projectId does not match token', async () => {
      const token = 'project-scoped-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: 'project-456',
      };

      const mockAnalysis = {
        projectId: 'project-999', // Different project
      };

      const context = createMockExecutionContext(
        { authorization: `Bearer ${token}` },
        { id: 'analysis-789' },
      );

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.analysis.findUnique.mockResolvedValue(mockAnalysis);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should handle projectKey parameter name', async () => {
      const token = 'project-scoped-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: 'project-456',
      };

      const mockProject = {
        id: 'project-456',
      };

      const context = createMockExecutionContext(
        { authorization: `Bearer ${token}` },
        { projectKey: 'project-key' },
      );

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { key: 'project-key' },
        select: { id: true },
      });
    });
  });

  describe('JWT Authentication Fallback', () => {
    it('should fallback to JWT guard when no API token is present', async () => {
      const context = createMockExecutionContext();

      mockJwtAuthGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should fallback to JWT guard when API token is not found in database', async () => {
      const token = 'invalid-token';
      const context = createMockExecutionContext({
        authorization: `Bearer ${token}`,
      });

      mockPrismaService.apiToken.findUnique.mockResolvedValue(null);
      mockJwtAuthGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should return false when JWT guard denies access', async () => {
      const context = createMockExecutionContext();

      mockJwtAuthGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });

  describe('Header Parsing', () => {
    it('should extract token from Bearer authorization header (lowercase)', async () => {
      const token = 'valid-api-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: null,
      };

      const context = createMockExecutionContext({
        authorization: `bearer ${token}`,
      });

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);

      await guard.canActivate(context);

      expect(mockPrismaService.apiToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashToken(token) },
      });
    });

    it('should handle Bearer token with extra whitespace', async () => {
      const token = 'valid-api-token';
      const mockToken = {
        id: 'token-123',
        tokenHash: hashToken(token),
        projectId: null,
      };

      const context = createMockExecutionContext({
        authorization: `Bearer   ${token}  `,
      });

      mockPrismaService.apiToken.findUnique.mockResolvedValue(mockToken);

      await guard.canActivate(context);

      expect(mockPrismaService.apiToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashToken(token.trim()) },
      });
    });

    it('should fallback to JWT when authorization header is not Bearer', async () => {
      const context = createMockExecutionContext({
        authorization: 'Basic xyz123',
      });

      mockJwtAuthGuard.canActivate.mockResolvedValue(true);

      await guard.canActivate(context);

      expect(mockJwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
      expect(mockPrismaService.apiToken.findUnique).not.toHaveBeenCalled();
    });

    it('should handle missing authorization header', async () => {
      const context = createMockExecutionContext({});

      mockJwtAuthGuard.canActivate.mockResolvedValue(true);

      await guard.canActivate(context);

      expect(mockJwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
      expect(mockPrismaService.apiToken.findUnique).not.toHaveBeenCalled();
    });
  });
});
