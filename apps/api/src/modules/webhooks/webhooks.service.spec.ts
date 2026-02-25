import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { ProjectsService } from '../projects/projects.service';
import { AnalysesService } from '../analyses/analyses.service';
import { PrismaService } from '../prisma/prisma.service';
import { PullRequestProvider } from '@prisma/client';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let projectsService: ProjectsService;
  let analysesService: AnalysesService;
  let prismaService: PrismaService;

  const mockProjectsService = {
    findByKey: jest.fn(),
    create: jest.fn(),
  };

  const mockAnalysesService = {
    createForProject: jest.fn(),
  };

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: AnalysesService, useValue: mockAnalysesService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    projectsService = module.get<ProjectsService>(ProjectsService);
    analysesService = module.get<AnalysesService>(AnalysesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('handlePullRequestEvent', () => {
    const mockPayload = {
      provider: PullRequestProvider.GITHUB,
      repo: 'my-repo',
      prNumber: 123,
      sourceBranch: 'feature/new-feature',
      targetBranch: 'main',
      commitSha: 'abc123def456',
    };

    const mockProject = {
      id: 'project-123',
      key: 'my-repo',
      name: 'My Repo',
      organizationId: 'org-456',
    };

    const mockAnalysis = {
      id: 'analysis-789',
      projectId: mockProject.id,
      commitSha: mockPayload.commitSha,
      prNumber: mockPayload.prNumber,
    };

    it('should trigger analysis for existing project', async () => {
      mockProjectsService.findByKey.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      const result = await service.handlePullRequestEvent(mockPayload);

      expect(result).toEqual(mockAnalysis);
      expect(mockProjectsService.findByKey).toHaveBeenCalledWith('my-repo');
      expect(mockAnalysesService.createForProject).toHaveBeenCalledWith('my-repo', {
        commitSha: mockPayload.commitSha,
        branch: undefined,
        provider: mockPayload.provider,
        repo: mockPayload.repo,
        prNumber: mockPayload.prNumber,
        sourceBranch: mockPayload.sourceBranch,
        targetBranch: mockPayload.targetBranch,
      });
      expect(mockProjectsService.create).not.toHaveBeenCalled();
    });

    it('should auto-create project when it does not exist', async () => {
      const mockDefaultOrg = {
        id: 'default-org-123',
        slug: 'default',
        name: 'Default Organization',
      };

      mockProjectsService.findByKey
        .mockResolvedValueOnce(null) // First call returns null (project doesn't exist)
        .mockResolvedValueOnce(mockProject); // Second call after creation returns project
      mockPrismaService.organization.findUnique.mockResolvedValue(mockDefaultOrg);
      mockProjectsService.create.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      const result = await service.handlePullRequestEvent(mockPayload);

      expect(result).toEqual(mockAnalysis);
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'default' },
      });
      expect(mockProjectsService.create).toHaveBeenCalledWith({
        key: 'my-repo',
        name: 'My Repo',
        description: 'Auto-created from GITHUB webhook',
        organizationId: mockDefaultOrg.id,
      });
      expect(mockProjectsService.findByKey).toHaveBeenCalledTimes(2);
    });

    it('should throw error when default organization does not exist', async () => {
      mockProjectsService.findByKey.mockResolvedValue(null);
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(service.handlePullRequestEvent(mockPayload)).rejects.toThrow(
        'Default organization not found. Please run database migrations and seed.',
      );
      expect(mockProjectsService.create).not.toHaveBeenCalled();
    });

    it('should throw error when project creation fails', async () => {
      const mockDefaultOrg = {
        id: 'default-org-123',
        slug: 'default',
        name: 'Default Organization',
      };

      mockProjectsService.findByKey
        .mockResolvedValueOnce(null) // First call
        .mockResolvedValueOnce(null); // Second call after failed creation
      mockPrismaService.organization.findUnique.mockResolvedValue(mockDefaultOrg);
      mockProjectsService.create.mockResolvedValue(mockProject);

      await expect(service.handlePullRequestEvent(mockPayload)).rejects.toThrow(
        'Failed to create or find project: my-repo',
      );
    });

    it('should handle GitHub webhooks', async () => {
      mockProjectsService.findByKey.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      await service.handlePullRequestEvent({
        ...mockPayload,
        provider: PullRequestProvider.GITHUB,
      });

      expect(mockAnalysesService.createForProject).toHaveBeenCalledWith('my-repo', {
        commitSha: mockPayload.commitSha,
        branch: undefined,
        provider: PullRequestProvider.GITHUB,
        repo: mockPayload.repo,
        prNumber: mockPayload.prNumber,
        sourceBranch: mockPayload.sourceBranch,
        targetBranch: mockPayload.targetBranch,
      });
    });

    it('should handle GitLab webhooks', async () => {
      mockProjectsService.findByKey.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      await service.handlePullRequestEvent({
        ...mockPayload,
        provider: PullRequestProvider.GITLAB,
      });

      expect(mockAnalysesService.createForProject).toHaveBeenCalledWith('my-repo', {
        commitSha: mockPayload.commitSha,
        branch: undefined,
        provider: PullRequestProvider.GITLAB,
        repo: mockPayload.repo,
        prNumber: mockPayload.prNumber,
        sourceBranch: mockPayload.sourceBranch,
        targetBranch: mockPayload.targetBranch,
      });
    });

    it('should handle Bitbucket webhooks', async () => {
      mockProjectsService.findByKey.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      await service.handlePullRequestEvent({
        ...mockPayload,
        provider: PullRequestProvider.BITBUCKET,
      });

      expect(mockAnalysesService.createForProject).toHaveBeenCalledWith('my-repo', {
        commitSha: mockPayload.commitSha,
        branch: undefined,
        provider: PullRequestProvider.BITBUCKET,
        repo: mockPayload.repo,
        prNumber: mockPayload.prNumber,
        sourceBranch: mockPayload.sourceBranch,
        targetBranch: mockPayload.targetBranch,
      });
    });

    it('should derive project name from key with dashes', async () => {
      const mockDefaultOrg = {
        id: 'default-org-123',
        slug: 'default',
        name: 'Default Organization',
      };

      mockProjectsService.findByKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockProject, key: 'my-awesome-project' });
      mockPrismaService.organization.findUnique.mockResolvedValue(mockDefaultOrg);
      mockProjectsService.create.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      await service.handlePullRequestEvent({
        ...mockPayload,
        repo: 'my-awesome-project',
      });

      expect(mockProjectsService.create).toHaveBeenCalledWith({
        key: 'my-awesome-project',
        name: 'My Awesome Project',
        description: 'Auto-created from GITHUB webhook',
        organizationId: mockDefaultOrg.id,
      });
    });

    it('should derive project name from key with underscores', async () => {
      const mockDefaultOrg = {
        id: 'default-org-123',
        slug: 'default',
        name: 'Default Organization',
      };

      mockProjectsService.findByKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockProject, key: 'my_awesome_project' });
      mockPrismaService.organization.findUnique.mockResolvedValue(mockDefaultOrg);
      mockProjectsService.create.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      await service.handlePullRequestEvent({
        ...mockPayload,
        repo: 'my_awesome_project',
      });

      expect(mockProjectsService.create).toHaveBeenCalledWith({
        key: 'my_awesome_project',
        name: 'My Awesome Project',
        description: 'Auto-created from GITHUB webhook',
        organizationId: mockDefaultOrg.id,
      });
    });

    it('should handle mixed delimiters in project name derivation', async () => {
      const mockDefaultOrg = {
        id: 'default-org-123',
        slug: 'default',
        name: 'Default Organization',
      };

      mockProjectsService.findByKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockProject, key: 'my-super_awesome-project' });
      mockPrismaService.organization.findUnique.mockResolvedValue(mockDefaultOrg);
      mockProjectsService.create.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      await service.handlePullRequestEvent({
        ...mockPayload,
        repo: 'my-super_awesome-project',
      });

      expect(mockProjectsService.create).toHaveBeenCalledWith({
        key: 'my-super_awesome-project',
        name: 'My Super Awesome Project',
        description: 'Auto-created from GITHUB webhook',
        organizationId: mockDefaultOrg.id,
      });
    });

    it('should handle pull request with different branches', async () => {
      mockProjectsService.findByKey.mockResolvedValue(mockProject);
      mockAnalysesService.createForProject.mockResolvedValue(mockAnalysis);

      await service.handlePullRequestEvent({
        ...mockPayload,
        sourceBranch: 'feature/authentication',
        targetBranch: 'develop',
      });

      expect(mockAnalysesService.createForProject).toHaveBeenCalledWith('my-repo', {
        commitSha: mockPayload.commitSha,
        branch: undefined,
        provider: mockPayload.provider,
        repo: mockPayload.repo,
        prNumber: mockPayload.prNumber,
        sourceBranch: 'feature/authentication',
        targetBranch: 'develop',
      });
    });
  });
});
