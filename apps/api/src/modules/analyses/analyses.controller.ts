import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoverageFormat } from '@prisma/client';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { IssueCodeResponseDto } from './dto/issue-code-response.dto';
import { ListAnalysesQueryDto } from './dto/list-analyses-query.dto';
import { ListIssuesQueryDto } from './dto/list-issues-query.dto';
import { ResolveIssueDto } from './dto/resolve-issue.dto';
import { FastifyRequest } from 'fastify';
import { ApiOrJwtGuard } from '../auth/guards/api-or-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@ApiTags('analyses')
@ApiBearerAuth()
@Controller()
@UseGuards(ApiOrJwtGuard)
export class AnalysesController {
  private readonly logger = new Logger(AnalysesController.name);

  constructor(private readonly analysesService: AnalysesService) {}

  @Post('projects/:key/analyses')
  @ApiOperation({
    summary: 'Créer une analyse',
    description: 'Soumet une analyse via JSON ou multipart (commitSha + branch OU données PR).',
  })
  async createForProject(@Param('key') key: string, @Req() req: FastifyRequest) {
    const body = ((req as any).body ?? {}) as Partial<CreateAnalysisDto>;

    const isMultipart = (req as any).isMultipart?.();
    if (isMultipart) {
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
      this.logger.log('[MULTIPART] Starting to read multipart request');

      // Read all parts from multipart request
      const parts: any[] = [];
      const files: Map<string, any> = new Map();

      for await (const part of (req as any).parts()) {
        this.logger.log(`[MULTIPART] Part received:`, {
          fieldname: part.fieldname,
          type: part.file ? 'file' : 'field',
          filename: part.filename,
          mimetype: part.mimetype,
        });

        if (part.file) {
          // This is a file upload - we need to buffer it immediately to consume the stream
          // Otherwise the multipart parser will hang waiting for the stream to be consumed
          const buffer = await part.toBuffer();
          // Store the buffered file with metadata
          files.set(part.fieldname, {
            ...part,
            buffer,
            // Override toBuffer to return the already-buffered data
            toBuffer: async () => buffer,
            // Ensure file property exists for compatibility
            file: part.file,
          });
        } else {
          // For fields, just store the part
          parts.push(part);
        }
      }

      this.logger.log(`[MULTIPART] Total parts: ${parts.length}, Files: ${files.size}`);
      this.logger.log(`[MULTIPART] File fields: ${Array.from(files.keys()).join(', ')}`);

      // Get the source zip file
      const sourceFile = files.get('sourceZip');
      if (!sourceFile) {
        this.logger.error('[MULTIPART] No sourceZip file provided in multipart request');
        throw new Error('No source file provided');
      }

      // Extract form fields from parts
      const formFields: Record<string, any> = {};
      for (const part of parts) {
        if (!part.file && part.fieldname) {
          formFields[part.fieldname] = part.value;
        }
      }

      this.logger.log('[MULTIPART] Form fields extracted:', Object.keys(formFields));

      const commitSha = formFields.commitSha ?? body.commitSha;
      const branchName = formFields.branch ?? formFields.branchName ?? (body as any).branchName ?? body.branch;
      const provider = (formFields.provider ?? body.provider) as CreateAnalysisDto['provider'];
      const repo = formFields.repo ?? body.repo;
      const prNumberRaw = formFields.prNumber ?? body.prNumber;
      const prNumber = prNumberRaw !== undefined && prNumberRaw !== null ? Number(prNumberRaw) : undefined;
      const sourceBranch = formFields.sourceBranch ?? body.sourceBranch;
      const targetBranch = formFields.targetBranch ?? body.targetBranch;
      const coverageFormatRaw = formFields.coverageFormat;
      const coverageFormat = coverageFormatRaw as CoverageFormat | undefined;

      this.logger.log('[MULTIPART] Extracted metadata:', {
        commitSha,
        branchName,
        coverageFormat,
      });

      // Get the coverage file if present
      const coverageFile = files.get('coverageFile') ?? null;

      if (coverageFile) {
        this.logger.log('[MULTIPART] Coverage file detected:', {
          fieldname: coverageFile.fieldname,
          filename: coverageFile.filename,
          format: coverageFormat,
        });
      } else {
        this.logger.log('[MULTIPART] No coverage file provided');
      }
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

      const analysis = await this.analysesService.createForProjectWithUpload(key, {
        commitSha,
        branch: branchName,
        provider,
        repo,
        prNumber,
        sourceBranch,
        targetBranch,
        file: sourceFile,
        coverageFile,
        coverageFormat,
      });
      return this.buildResponse(req, analysis.id);
    }

    const branchNameBody = (body as any).branchName ?? body.branch;
    const analysis = await this.analysesService.createForProject(key, {
      ...body,
      branch: branchNameBody,
    } as CreateAnalysisDto);
    return this.buildResponse(req, analysis.id);
  }

  @Get('projects/:key/analyses')
  @ApiOperation({ summary: 'Lister les analyses d’un projet' })
  listForProject(@Param('key') key: string, @Query() query: ListAnalysesQueryDto) {
    return this.analysesService.findByProject(key, query);
  }

  @Get('analyses/:id')
  @ApiOperation({ summary: 'Détails d’une analyse' })
  findById(@Param('id') id: string) {
    return this.analysesService.findById(id);
  }

  @Get('analyses/:id/quality-gate-status')
  @ApiOperation({ summary: 'Statut Quality Gate' })
  qualityGateStatus(@Param('id') id: string) {
    return this.analysesService.evaluateQualityGateStatus(id);
  }

  @Get('analyses/:id/issues')
  @ApiOperation({ summary: 'Issues d’une analyse', description: 'Filtrable par sévérité, type, chemin, onlyNew.' })
  listIssues(@Param('id') id: string, @Query() query: ListIssuesQueryDto) {
    return this.analysesService.listIssues(id, query);
  }

  @Get('analyses/:id/summary')
  @ApiOperation({ summary: 'Résumé des issues', description: 'Total issues, new issues, breakdown type/sévérité.' })
  summary(@Param('id') id: string) {
    return this.analysesService.summary(id);
  }

  @Put('issues/:id/resolve')
  @ApiOperation({ summary: 'Résoudre une issue', description: 'Marquer une issue comme FALSE_POSITIVE, ACCEPTED_RISK, RESOLVED ou OPEN' })
  resolveIssue(@Param('id') id: string, @Body() dto: ResolveIssueDto) {
    return this.analysesService.resolveIssue(id, dto);
  }

  @Post('issues/:id/resolve')
  @ApiOperation({ summary: 'Résoudre une issue via LLM', description: 'Lance un job LLM pour proposer une modification.' })
  resolveIssueViaLlm(@Param('id') id: string, @CurrentUser() user?: AuthPayload) {
    return this.analysesService.enqueueLlmResolveIssue(id, user?.sub);
  }

  @Get('issues/:id/llm-runs')
  @ApiOperation({ summary: 'Historique des runs LLM', description: 'Liste les runs LLM pour une issue.' })
  listIssueLlmRuns(@Param('id') id: string) {
    return this.analysesService.listIssueLlmRuns(id);
  }

  @Get('issues/:id/resolutions')
  @ApiOperation({ summary: 'Historique des résolutions', description: 'Liste toutes les résolutions d\'une issue' })
  getIssueResolutions(@Param('id') id: string) {
    return this.analysesService.getIssueResolutions(id);
  }

  @Get('issues/:id/code')
  @ApiOperation({ summary: 'Code lié à une issue', description: 'Retourne un extrait du fichier lié à l’issue.' })
  @ApiOkResponse({ type: IssueCodeResponseDto })
  @ApiNotFoundResponse({ description: 'Issue not found' })
  @ApiConflictResponse({ description: 'SOURCE_ZIP artifact not found' })
  getIssueCode(@Param('id') id: string, @Query('full') full?: string) {
    return this.analysesService.getIssueCode(id, { full: full === 'true' });
  }

  @Get('analyses/:id/debt')
  @ApiOperation({
    summary: 'Technical Debt Ratio',
    description: 'Récupère le ratio de dette technique, le coût de remediation, et le rating de maintenabilité (A-E)'
  })
  getTechnicalDebt(@Param('id') id: string) {
    return this.analysesService.getTechnicalDebt(id);
  }

  private buildResponse(req: FastifyRequest, analysisId: string) {
    const baseUrl = this.getBaseUrl(req);
    return {
      analysisId,
      statusUrl: `${baseUrl}/analyses/${analysisId}`,
      gateUrl: `${baseUrl}/analyses/${analysisId}/quality-gate-status`,
    };
  }

  private getBaseUrl(req: FastifyRequest) {
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const forwardedHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
    const proto = forwardedProto.split(',')[0].trim();
    const host = forwardedHost.split(',')[0].trim();
    return `${proto}://${host}/api`;
  }

  private extractField(fields: Record<string, any>, name: string): string | undefined {
    const raw = fields[name];
    if (!raw) return undefined;
    if (Array.isArray(raw)) {
      const first = raw[0];
      return first?.value ?? first;
    }
    return raw.value ?? raw;
  }
}
