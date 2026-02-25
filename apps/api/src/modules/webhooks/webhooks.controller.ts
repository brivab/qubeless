import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import { PullRequestProvider } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('webhooks')
@Controller('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class WebhooksController {
  private readonly githubSecret = process.env.GITHUB_WEBHOOK_SECRET ?? '';
  private readonly gitlabSecret = process.env.GITLAB_WEBHOOK_SECRET ?? '';

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @Throttle({ short: { limit: 50, ttl: 60000 } }) // 50 webhooks/min max
  @ApiOperation({
    summary: 'Webhook GitHub PR',
    description: 'Valide la signature et déclenche une analyse sur opened/synchronize/reopened.',
  })
  async handleGithub(@Req() req: FastifyRequest, @Body() body: any, @Headers() headers: Record<string, any>) {
    this.verifyGithubSignature(req, headers, body);

    const event = headers['x-github-event'];
    if (event !== 'pull_request') {
      return { ignored: true };
    }

    const action = body?.action;
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return { ignored: true };
    }

    const pr = body?.pull_request;
    const repoFullName = body?.repository?.full_name;
    if (!pr || !repoFullName) {
      throw new BadRequestException('Invalid GitHub payload');
    }

    const payload = {
      provider: PullRequestProvider.GITHUB,
      repo: repoFullName,
      prNumber: pr.number,
      sourceBranch: pr.head?.ref,
      targetBranch: pr.base?.ref,
      commitSha: pr.head?.sha,
    };

    if (!payload.sourceBranch || !payload.targetBranch || !payload.commitSha) {
      throw new BadRequestException('Missing PR data');
    }

    const analysis = await this.webhooksService.handlePullRequestEvent(payload);
    return { analysisId: analysis.id };
  }

  @Post('gitlab')
  @Throttle({ short: { limit: 50, ttl: 60000 } }) // 50 webhooks/min max
  @ApiOperation({
    summary: 'Webhook GitLab MR',
    description: 'Valide le token et déclenche une analyse sur open/update/reopen.',
  })
  async handleGitlab(@Body() body: any, @Headers() headers: Record<string, any>) {
    this.verifyGitlabSignature(headers);

    const event = headers['x-gitlab-event'] ?? headers['x-event-type'];
    if (!event || !`${event}`.toLowerCase().includes('merge')) {
      return { ignored: true };
    }

    const action = body?.object_attributes?.action;
    if (!['open', 'update', 'reopen'].includes(action)) {
      return { ignored: true };
    }

    const prNumber = body?.object_attributes?.iid;
    const sourceBranch = body?.object_attributes?.source_branch;
    const targetBranch = body?.object_attributes?.target_branch;
    const commitSha = body?.object_attributes?.last_commit?.id ?? body?.object_attributes?.last_commit?.sha;
    const repoFullName =
      body?.project?.path_with_namespace ?? body?.object_attributes?.target?.path_with_namespace;

    if (!repoFullName || !prNumber || !sourceBranch || !targetBranch || !commitSha) {
      throw new BadRequestException('Invalid GitLab payload');
    }

    const payload = {
      provider: PullRequestProvider.GITLAB,
      repo: repoFullName,
      prNumber: Number(prNumber),
      sourceBranch,
      targetBranch,
      commitSha,
    };

    const analysis = await this.webhooksService.handlePullRequestEvent(payload);
    return { analysisId: analysis.id };
  }

  private verifyGithubSignature(req: FastifyRequest, headers: Record<string, any>, body: any) {
    if (!this.githubSecret) return;
    const sigHeader = headers['x-hub-signature-256'];
    if (!sigHeader) {
      throw new BadRequestException('Missing GitHub signature');
    }
    const raw = (req as any).rawBody ?? JSON.stringify(body);
    const expected = `sha256=${createHmac('sha256', this.githubSecret).update(raw).digest('hex')}`;
    const safe = timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
    if (!safe) {
      throw new BadRequestException('Invalid GitHub signature');
    }
  }

  private verifyGitlabSignature(headers: Record<string, any>) {
    if (!this.gitlabSecret) return;
    const token = headers['x-gitlab-token'];
    if (!token || token !== this.gitlabSecret) {
      throw new BadRequestException('Invalid GitLab token');
    }
  }
}
