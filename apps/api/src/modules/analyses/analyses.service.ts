import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AnalysisStatus,
  ArtifactKind,
  IssueSeverity,
  IssueType,
  IssueStatus,
  PullRequestProvider,
  QualityGateCondition,
  QualityGateOperator,
  LeakPeriodType,
  AuditAction,
  CoverageFormat,
} from '@prisma/client';
import { AnalysisJobPayload } from '@qubeless/shared';
import { inflateRawSync } from 'node:zlib';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { ListAnalysesQueryDto } from './dto/list-analyses-query.dto';
import { ListIssuesQueryDto } from './dto/list-issues-query.dto';
import { ResolveIssueDto } from './dto/resolve-issue.dto';
import { AnalyzersService } from '../analyzers/analyzers.service';
import { AnalysisQueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CoverageService } from '../coverage/coverage.service';
import { TechnicalDebtService } from './technical-debt.service';

@Injectable()
export class AnalysesService {
  private readonly logger = new Logger(AnalysesService.name);
  private readonly maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);
  private readonly maxRunningAnalyses = Number(process.env.MAX_RUNNING_ANALYSES ?? 5);
  private readonly maxRunningPerProject = Number(process.env.MAX_RUNNING_PER_PROJECT ?? 2);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly analyzersService: AnalyzersService,
    private readonly queueService: AnalysisQueueService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly coverageService: CoverageService,
    private readonly technicalDebtService: TechnicalDebtService,
  ) {}

  async createForProject(projectKey: string, dto: CreateAnalysisDto) {
    const project = await this.projectsService.getByKeyOrThrow(projectKey);

    // Check quotas before creating analysis
    await this.checkQuotas(project.id);

    const { target } = this.resolveTarget(dto);
    const start = Date.now();

    const { analysis, branchNameForPayload, pullRequestInfo } = await this.createAnalysisRecord(project.id, dto, target);
    await this.setBaseline(analysis, target);

    const analyzers = await this.analyzersService.listForProject(project.key);
    let activeAnalyzers = analyzers
      .filter((a) => a.effectiveEnabled)
      .map((a) => ({
        id: a.analyzer.id,
        key: a.analyzer.key,
        dockerImage: a.analyzer.dockerImage,
        configJson: a.configJson ?? undefined,
      }));

    // Filter by analyzerIds if provided
    if (dto.analyzerIds && dto.analyzerIds.length > 0) {
      activeAnalyzers = activeAnalyzers.filter((a) => dto.analyzerIds!.includes(a.id));

      // Validate that all requested analyzers exist and are active
      if (activeAnalyzers.length !== dto.analyzerIds.length) {
        const foundIds = activeAnalyzers.map((a) => a.id);
        const missingIds = dto.analyzerIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `The following analyzer IDs are not found or not active for this project: ${missingIds.join(', ')}`
        );
      }
    }

    // Remove the id field before creating the payload
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const analyzerPayload = activeAnalyzers.map(({ id, ...rest }) => rest);

    const payload: AnalysisJobPayload = {
      analysisId: analysis.id,
      projectKey: project.key,
      branchName: branchNameForPayload,
      commitSha: dto.commitSha,
      analyzers: analyzerPayload,
      pullRequestId: pullRequestInfo?.id,
      pullRequest: pullRequestInfo ?? undefined,
      workspacePath: process.env.WORKSPACE_PATH, // optional, worker can decide default
    };

    await this.queueService.enqueueAnalysis(payload);

    const elapsed = Date.now() - start;
    this.logger.log(
      {
        analysisId: analysis.id,
        projectKey,
        branchName: branchNameForPayload,
        prNumber: pullRequestInfo?.prNumber,
        elapsedMs: elapsed,
      },
      'Analysis created',
    );

    // Audit log for analysis creation
    await this.auditService.log({
      actorUserId: undefined, // Can be added as parameter if needed
      action: AuditAction.ANALYSIS_CREATE,
      targetType: 'Analysis',
      targetId: analysis.id,
      metadata: {
        projectKey,
        projectId: project.id,
        commitSha: dto.commitSha,
        branch: analysis.branchId ? branchNameForPayload : undefined,
        pullRequest: pullRequestInfo ? {
          provider: pullRequestInfo.provider,
          repo: pullRequestInfo.repo,
          prNumber: pullRequestInfo.prNumber,
        } : undefined,
      },
    });

    return analysis;
  }

  async createForProjectWithUpload(
    projectKey: string,
    input: {
      commitSha?: string;
      branch?: string;
      provider?: PullRequestProvider;
      repo?: string;
      prNumber?: number;
      sourceBranch?: string;
      targetBranch?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      file: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coverageFile?: any;
      coverageFormat?: CoverageFormat;
    },
  ) {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const commitSha = input.commitSha ?? input.file?.fields?.commitSha?.value;
    const branch = input.branch ?? input.file?.fields?.branch?.value;
    const provider = input.provider ?? input.file?.fields?.provider?.value;
    const repo = input.repo ?? input.file?.fields?.repo?.value;
    const prNumberRaw = input.prNumber ?? input.file?.fields?.prNumber?.value;
    const prNumber = prNumberRaw !== undefined && prNumberRaw !== null ? Number(prNumberRaw) : undefined;
    const sourceBranch = input.sourceBranch ?? input.file?.fields?.sourceBranch?.value;
    const targetBranch = input.targetBranch ?? input.file?.fields?.targetBranch?.value;
    const coverageFormatField = input.coverageFormat ?? input.file?.fields?.coverageFormat?.value;

    const dto: CreateAnalysisDto = { commitSha, branch, provider, repo, prNumber, sourceBranch, targetBranch };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const { target } = this.resolveTarget(dto);
    const project = await this.projectsService.getByKeyOrThrow(projectKey);

    // Check quotas before creating analysis
    await this.checkQuotas(project.id);
    const { analysis, branchNameForPayload, pullRequestInfo } = await this.createAnalysisRecord(project.id, dto, target);
    await this.setBaseline(analysis, target);

    const start = Date.now();
    const sourceKey = await this.saveSourceZip(project.key, analysis.id, input.file);

    // Process coverage file if provided
    this.logger.log({
      hasCoverageFile: !!input.coverageFile,
      coverageFormat: coverageFormatField,
      analysisId: analysis.id,
    }, 'Checking coverage file');

    if (input.coverageFile && coverageFormatField) {
      this.logger.log({ analysisId: analysis.id, format: coverageFormatField }, 'Processing coverage file');
      try {
        const coverageBuffer = await this.saveCoverageFile(input.coverageFile);
        this.logger.log({ analysisId: analysis.id, bufferSize: coverageBuffer.length }, 'Coverage file buffered');
        await this.coverageService.processCoverageFile(analysis.id, coverageFormatField as CoverageFormat, coverageBuffer);
        this.logger.log({ analysisId: analysis.id, format: coverageFormatField }, 'Coverage processed successfully');
      } catch (error) {
        this.logger.error({ analysisId: analysis.id, error: error instanceof Error ? error.message : error }, 'Failed to process coverage file');
        // Don't fail the analysis if coverage processing fails
      }
    } else {
      if (!input.coverageFile) {
        this.logger.log({ analysisId: analysis.id }, 'No coverage file provided');
      }
      if (!coverageFormatField) {
        this.logger.log({ analysisId: analysis.id }, 'No coverage format specified');
      }
    }

    const analyzers = await this.analyzersService.listForProject(project.key);
    let activeAnalyzers = analyzers
      .filter((a) => a.effectiveEnabled)
      .map((a) => ({
        id: a.analyzer.id,
        key: a.analyzer.key,
        dockerImage: a.analyzer.dockerImage,
        configJson: a.configJson ?? undefined,
      }));

    // Filter by analyzerIds if provided
    if (dto.analyzerIds && dto.analyzerIds.length > 0) {
      activeAnalyzers = activeAnalyzers.filter((a) => dto.analyzerIds!.includes(a.id));

      // Validate that all requested analyzers exist and are active
      if (activeAnalyzers.length !== dto.analyzerIds.length) {
        const foundIds = activeAnalyzers.map((a) => a.id);
        const missingIds = dto.analyzerIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `The following analyzer IDs are not found or not active for this project: ${missingIds.join(', ')}`
        );
      }
    }

    // Remove the id field before creating the payload
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const analyzerPayload = activeAnalyzers.map(({ id, ...rest }) => rest);

    const payload: AnalysisJobPayload = {
      analysisId: analysis.id,
      projectKey: project.key,
      branchName: branchNameForPayload,
      commitSha: dto.commitSha,
      analyzers: analyzerPayload,
      sourceObjectKey: sourceKey,
      pullRequestId: pullRequestInfo?.id,
      pullRequest: pullRequestInfo ?? undefined,
    };

    await this.queueService.enqueueAnalysis(payload);

    const elapsed = Date.now() - start;
    this.logger.log(
      {
        analysisId: analysis.id,
        projectKey,
        branchName: branchNameForPayload,
        prNumber: pullRequestInfo?.prNumber,
        elapsedMs: elapsed,
      },
      'Analysis created (upload)',
    );

    // Audit log for analysis creation with upload
    await this.auditService.log({
      actorUserId: undefined, // Can be added as parameter if needed
      action: AuditAction.ANALYSIS_CREATE,
      targetType: 'Analysis',
      targetId: analysis.id,
      metadata: {
        projectKey,
        projectId: project.id,
        commitSha: dto.commitSha,
        branch: analysis.branchId ? branchNameForPayload : undefined,
        pullRequest: pullRequestInfo ? {
          provider: pullRequestInfo.provider,
          repo: pullRequestInfo.repo,
          prNumber: pullRequestInfo.prNumber,
        } : undefined,
        uploadedSource: true,
      },
    });

    return analysis;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async saveSourceZip(projectKey: string, analysisId: string, file: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!file?.file) {
      throw new NotFoundException('sourceZip is required in multipart form-data');
    }

    const objectKey = `${projectKey}/${analysisId}/source.zip`;
    // Buffer the file to ensure Content-Length is set for S3-compatible stores
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const buffer = await file.toBuffer();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (buffer.length > this.maxUploadBytes) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new BadRequestException(`Zip too large (${buffer.length} bytes), max ${this.maxUploadBytes}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const contentType = file.mimetype ?? 'application/zip';
    const upload = await this.storageService.uploadBuffer(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      buffer,
      {
        objectKey,
        contentType,
        metadata: {
          analysisId,
          projectKey,
        },
      },
    );
    await this.prisma.analysisArtifact.upsert({
      where: {
        analysisId_analyzerKey_kind: {
          analysisId,
          analyzerKey: 'legacy',
          kind: ArtifactKind.SOURCE_ZIP,
        },
      },
      create: {
        analysisId,
        analyzerKey: 'legacy',
        kind: ArtifactKind.SOURCE_ZIP,
        bucket: upload.bucket,
        objectKey: upload.key,
        contentType,
        size: BigInt(buffer.length),
      },
      update: {
        bucket: upload.bucket,
        objectKey: upload.key,
        contentType,
        size: BigInt(buffer.length),
        analyzerKey: 'legacy',
      },
    });
    return objectKey;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async saveCoverageFile(file: any): Promise<Buffer> {
    this.logger.log('saveCoverageFile: Starting to process coverage file');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!file?.file) {
      this.logger.error('saveCoverageFile: file.file is null or undefined', {
        hasFile: !!file,
        fileKeys: file ? Object.keys(file) : [],
      });
      throw new BadRequestException('Coverage file is required');
    }

    this.logger.log('saveCoverageFile: File object exists, converting to buffer');

    // Buffer the file
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const buffer = await file.toBuffer();

    this.logger.log(`saveCoverageFile: Buffer created, size: ${buffer.length} bytes`);

    // Check file size
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (buffer.length > this.maxUploadBytes) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(`saveCoverageFile: File too large (${buffer.length} bytes), max ${this.maxUploadBytes}`);
      throw new BadRequestException(`Coverage file too large (${buffer.length} bytes), max ${this.maxUploadBytes}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return buffer;
  }

  async getIssueCode(issueId: string, options: { full?: boolean } = {}) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        analysisId: true,
        analyzerKey: true,
        filePath: true,
        line: true,
        language: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with id ${issueId} not found`);
    }

    let artifact = await this.prisma.analysisArtifact.findFirst({
      where: {
        analysisId: issue.analysisId,
        analyzerKey: issue.analyzerKey,
        kind: ArtifactKind.SOURCE_ZIP,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!artifact) {
      artifact = await this.prisma.analysisArtifact.findFirst({
        where: {
          analysisId: issue.analysisId,
          kind: ArtifactKind.SOURCE_ZIP,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!artifact) {
      throw new HttpException('SOURCE_ZIP artifact not found', HttpStatus.CONFLICT);
    }

    const { buffer } = await this.storageService.getObjectBuffer({
      bucket: artifact.bucket,
      key: artifact.objectKey,
    });

    const fileBuffer = this.extractFileFromZip(buffer, issue.filePath);
    if (!fileBuffer) {
      return {
        issueId: issue.id,
        analysisId: issue.analysisId,
        filePath: issue.filePath,
        line: issue.line ?? null,
        startLine: null,
        endLine: null,
        language: issue.language ?? null,
        snippet: '',
        fileExists: false,
      };
    }

    const fileText = fileBuffer.toString('utf8');
    const { snippet, startLine, endLine } = this.buildSnippet(fileText, issue.line, options.full ?? false);

    return {
      issueId: issue.id,
      analysisId: issue.analysisId,
      filePath: issue.filePath,
      line: issue.line ?? null,
      startLine,
      endLine,
      language: issue.language ?? null,
      snippet,
      fileExists: true,
    };
  }

  private buildSnippet(content: string, line: number | null, full: boolean) {
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    if (totalLines === 0) {
      return { snippet: '', startLine: 1, endLine: 1 };
    }

    if (full) {
      return {
        snippet: lines.join('\n'),
        startLine: 1,
        endLine: totalLines,
      };
    }

    const hasLine = typeof line === 'number' && Number.isFinite(line);
    const targetLine = hasLine ? Math.min(Math.max(1, line), totalLines) : null;
    const startLine = targetLine ? Math.max(1, targetLine - 15) : 1;
    const endLine = targetLine ? Math.min(totalLines, targetLine + 15) : Math.min(totalLines, 30);
    const snippet = lines.slice(startLine - 1, endLine).join('\n');

    return { snippet, startLine, endLine };
  }

  private extractFileFromZip(zipBuffer: Buffer, rawPath: string): Buffer | null {
    const targetPath = this.normalizeZipPath(rawPath);
    const eocdIndex = this.findZipEocd(zipBuffer);
    if (eocdIndex < 0) {
      throw new Error('Invalid zip: EOCD not found');
    }

    const totalEntries = zipBuffer.readUInt16LE(eocdIndex + 10);
    const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdIndex + 16);
    let offset = centralDirectoryOffset;

    let fallbackEntry: {
      compressionMethod: number;
      compressedSize: number;
      localHeaderOffset: number;
    } | null = null;
    let fallbackMatches = 0;

    for (let i = 0; i < totalEntries && offset + 46 <= zipBuffer.length; i += 1) {
      const signature = zipBuffer.readUInt32LE(offset);
      if (signature !== 0x02014b50) {
        break;
      }

      const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
      const compressedSize = zipBuffer.readUInt32LE(offset + 20);
      const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
      const extraLength = zipBuffer.readUInt16LE(offset + 30);
      const commentLength = zipBuffer.readUInt16LE(offset + 32);
      const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);
      const nameStart = offset + 46;
      const nameEnd = nameStart + fileNameLength;
      const entryName = zipBuffer.slice(nameStart, nameEnd).toString('utf8');
      const normalizedName = this.normalizeZipPath(entryName);

      if (normalizedName === targetPath) {
        return this.extractZipEntry(zipBuffer, {
          compressionMethod,
          compressedSize,
          localHeaderOffset,
        });
      }

      if (normalizedName.endsWith(`/${targetPath}`)) {
        fallbackEntry = { compressionMethod, compressedSize, localHeaderOffset };
        fallbackMatches += 1;
      }

      offset = nameEnd + extraLength + commentLength;
    }

    if (fallbackEntry && fallbackMatches === 1) {
      return this.extractZipEntry(zipBuffer, fallbackEntry);
    }

    return null;
  }

  private extractZipEntry(
    zipBuffer: Buffer,
    entry: { compressionMethod: number; compressedSize: number; localHeaderOffset: number },
  ): Buffer {
    const localHeaderOffset = entry.localHeaderOffset;
    if (localHeaderOffset + 30 > zipBuffer.length) {
      throw new Error('Invalid zip: local header out of range');
    }
    const localSignature = zipBuffer.readUInt32LE(localHeaderOffset);
    if (localSignature !== 0x04034b50) {
      throw new Error('Invalid zip: local header signature mismatch');
    }
    const fileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const extraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
    const dataEnd = dataOffset + entry.compressedSize;
    if (dataEnd > zipBuffer.length) {
      throw new Error('Invalid zip: entry data out of range');
    }
    const compressed = zipBuffer.slice(dataOffset, dataEnd);

    if (entry.compressionMethod === 0) {
      return compressed;
    }
    if (entry.compressionMethod === 8) {
      return inflateRawSync(compressed);
    }
    throw new Error(`Unsupported zip compression method: ${entry.compressionMethod}`);
  }

  private normalizeZipPath(value: string) {
    return value
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^\.\//, '')
      .trim();
  }

  private findZipEocd(zipBuffer: Buffer) {
    const maxCommentLength = 0xffff;
    const minOffset = Math.max(0, zipBuffer.length - maxCommentLength - 22);
    for (let offset = zipBuffer.length - 22; offset >= minOffset; offset -= 1) {
      if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
        return offset;
      }
    }
    return -1;
  }

  async findByProject(projectKey: string, query: ListAnalysesQueryDto) {
    const project = await this.projectsService.getByKeyOrThrow(projectKey);
    return this.prisma.analysis.findMany({
      where: {
        projectId: project.id,
        ...(query.branch
          ? {
              branch: { name: query.branch },
            }
          : {}),
      },
      include: {
        branch: true,
        pullRequest: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id },
      include: {
        branch: true,
        project: true,
        pullRequest: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${id} not found`);
    }

    return analysis;
  }

  async evaluateQualityGateStatus(analysisId: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      include: { project: true },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    const qualityGate = await this.prisma.qualityGate.findFirst({
      where: { projectId: analysis.projectId },
      include: { conditions: true },
    });

    if (!qualityGate) {
      throw new NotFoundException(`No quality gate defined for project ${analysis.projectId}`);
    }

    const issues = await this.prisma.issue.findMany({
      where: { analysisId, status: IssueStatus.OPEN },
      select: { severity: true, type: true, isNew: true },
    });

    const metricsByScope = await this.computeMetricsByScopeWithCoverage(analysisId, issues);
    const conditionResults = qualityGate.conditions.map((condition) =>
      this.evaluateCondition(condition, metricsByScope),
    );
    const status = conditionResults.every((condition) => condition.passed) ? 'PASS' : 'FAIL';

    return {
      status,
      gate: { id: qualityGate.id, name: qualityGate.name },
      conditions: conditionResults,
      metrics: metricsByScope.ALL,
      metricsNew: metricsByScope.NEW,
    };
  }

  async listIssues(analysisId: string, filters: ListIssuesQueryDto) {
    await this.ensureAnalysisExists(analysisId);

    const onlyNew = filters.scope === 'NEW' ? true : filters.scope === 'ALL' ? false : filters.onlyNew;

    return this.prisma.issue.findMany({
      where: {
        analysisId,
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.filePath ? { filePath: { contains: filters.filePath } } : {}),
        ...(filters.language ? { language: filters.language } : {}),
        ...(onlyNew ? { isNew: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async summary(analysisId: string) {
    await this.ensureAnalysisExists(analysisId);

    // Only count OPEN issues (exclude FALSE_POSITIVE, ACCEPTED_RISK, RESOLVED)
    const whereOpen = { analysisId, status: IssueStatus.OPEN };
    const whereOpenNew = { analysisId, status: IssueStatus.OPEN, isNew: true };

    const [totalIssues, newIssues, severityCounts, typeCounts, newSeverityCounts, newTypeCounts] = await Promise.all([
      this.prisma.issue.count({ where: whereOpen }),
      this.prisma.issue.count({ where: whereOpenNew }),
      this.prisma.issue.groupBy({
        by: ['severity'],
        where: whereOpen,
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['type'],
        where: whereOpen,
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['severity'],
        where: whereOpenNew,
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['type'],
        where: whereOpenNew,
        _count: true,
      }),
    ]);

    const severityKeys = Object.values(IssueSeverity);
    const typeKeys = Object.values(IssueType);

    const bySeverity = Object.fromEntries(severityKeys.map((s) => [s, 0]));
    severityCounts.forEach((item) => {
      bySeverity[item.severity] = item._count ?? 0;
    });

    const newBySeverity = Object.fromEntries(severityKeys.map((s) => [s, 0]));
    newSeverityCounts.forEach((item) => {
      newBySeverity[item.severity] = item._count ?? 0;
    });

    const byType = Object.fromEntries(typeKeys.map((t) => [t, 0]));
    typeCounts.forEach((item) => {
      byType[item.type] = item._count ?? 0;
    });

    const newByType = Object.fromEntries(typeKeys.map((t) => [t, 0]));
    newTypeCounts.forEach((item) => {
      newByType[item.type] = item._count ?? 0;
    });

    return {
      totalIssues,
      newIssues,
      bySeverity,
      newBySeverity,
      byType,
      newByType,
    };
  }

  async saveAnalysisMetrics(analysisId: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { id: true, projectId: true, branchId: true },
    });
    if (!analysis) return;

    const summary = await this.summary(analysisId);
    const metrics: Array<{ key: string; value: number }> = [
      { key: 'issues_total', value: summary.totalIssues },
      { key: 'issues_new', value: summary.newIssues },
      { key: 'issues_blocker', value: summary.bySeverity.BLOCKER ?? 0 },
      { key: 'issues_critical', value: summary.bySeverity.CRITICAL ?? 0 },
      { key: 'issues_major', value: summary.bySeverity.MAJOR ?? 0 },
      { key: 'issues_minor', value: summary.bySeverity.MINOR ?? 0 },
      { key: 'issues_info', value: summary.bySeverity.INFO ?? 0 },
      { key: 'issues_new_blocker', value: summary.newBySeverity.BLOCKER ?? 0 },
      { key: 'issues_new_critical', value: summary.newBySeverity.CRITICAL ?? 0 },
      { key: 'issues_new_major', value: summary.newBySeverity.MAJOR ?? 0 },
      { key: 'issues_new_minor', value: summary.newBySeverity.MINOR ?? 0 },
      { key: 'issues_new_info', value: summary.newBySeverity.INFO ?? 0 },
    ];

    if (!metrics.length) return;

    // Prisma client typing may lag during CI; cast to any to avoid compile-time mismatch.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as any).analysisMetric.createMany({
      data: metrics.map((m) => ({
        analysisId: analysis.id,
        projectId: analysis.projectId,
        branchId: analysis.branchId ?? null,
        metricKey: m.key,
        value: m.value,
      })),
    });

    // Calculate and save technical debt
    await this.calculateAndSaveTechnicalDebt(analysisId);
  }

  async calculateAndSaveTechnicalDebt(analysisId: string): Promise<void> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        projectId: true,
        branchId: true,
      },
    });

    if (!analysis) return;

    // Get all OPEN issues for this analysis
    const issues = await this.prisma.issue.findMany({
      where: {
        analysisId,
        status: IssueStatus.OPEN,
      },
      select: {
        severity: true,
      },
    });

    // Get lines of code from metrics if available, otherwise use default
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const locMetric = await (this.prisma as any).analysisMetric.findFirst({
      where: {
        analysisId,
        metricKey: 'lines_of_code',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const linesOfCode = locMetric ? Number(locMetric.value) : 10000;

    // Calculate technical debt
    const debtResult = this.technicalDebtService.calculateDebtRatio(issues, linesOfCode);

    // Update analysis with technical debt metrics
    await this.prisma.analysis.update({
      where: { id: analysisId },
      data: {
        debtRatio: debtResult.debtRatio,
        remediationCost: debtResult.remediationCost,
        maintainabilityRating: debtResult.rating,
      },
    });

    // Save debt_ratio as a metric for quality gates
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as any).analysisMetric.create({
      data: {
        analysisId: analysis.id,
        projectId: analysis.projectId,
        branchId: analysis.branchId ?? null,
        metricKey: 'debt_ratio',
        value: debtResult.debtRatio,
      },
    });

    this.logger.log({
      analysisId,
      debtRatio: debtResult.debtRatio,
      rating: debtResult.rating,
      remediationTime: debtResult.formattedRemediationTime,
    }, 'Technical debt calculated');
  }

  async getTechnicalDebt(analysisId: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        debtRatio: true,
        remediationCost: true,
        maintainabilityRating: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    const formattedRemediationTime = analysis.remediationCost
      ? this.technicalDebtService.formatTime(analysis.remediationCost)
      : '0min';

    return {
      analysisId: analysis.id,
      debtRatio: analysis.debtRatio ? Number(analysis.debtRatio) : null,
      remediationCost: analysis.remediationCost,
      formattedRemediationTime,
      maintainabilityRating: analysis.maintainabilityRating,
    };
  }

  private async checkQuotas(projectId: string): Promise<void> {
    // Count total running analyses
    const totalRunning = await this.prisma.analysis.count({
      where: { status: AnalysisStatus.RUNNING },
    });

    if (totalRunning >= this.maxRunningAnalyses) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Maximum concurrent analyses limit reached (${this.maxRunningAnalyses} running). Please wait for some analyses to complete.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Count running analyses for this project
    const projectRunning = await this.prisma.analysis.count({
      where: {
        projectId,
        status: AnalysisStatus.RUNNING,
      },
    });

    if (projectRunning >= this.maxRunningPerProject) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Maximum concurrent analyses per project limit reached (${this.maxRunningPerProject} running for this project). Please wait for some analyses to complete.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private resolveTarget(
    dto: CreateAnalysisDto,
  ): {
    target:
      | { kind: 'BRANCH'; branchName: string }
      | {
          kind: 'PR';
          provider: PullRequestProvider;
          repo: string;
          prNumber: number;
          sourceBranch: string;
          targetBranch: string;
        };
  } {
    if (!dto.commitSha) {
      throw new BadRequestException('commitSha is required');
    }

    const hasBranch = Boolean(dto.branch?.trim());
    const hasPrNumber = dto.prNumber !== undefined && dto.prNumber !== null;

    if (hasBranch && hasPrNumber) {
      throw new BadRequestException('Provide either branch or pullRequest, not both');
    }
    if (!hasBranch && !hasPrNumber) {
      throw new BadRequestException('branch or pullRequest is required');
    }

    if (hasPrNumber) {
      if (Number.isNaN(Number(dto.prNumber))) {
        throw new BadRequestException('prNumber must be a number');
      }
      if (!dto.provider) {
        throw new BadRequestException('provider is required for pull requests');
      }
      if (!dto.repo) {
        throw new BadRequestException('repo is required for pull requests');
      }
      if (!dto.sourceBranch) {
        throw new BadRequestException('sourceBranch is required for pull requests');
      }
      if (!dto.targetBranch) {
        throw new BadRequestException('targetBranch is required for pull requests');
      }
      return {
        target: {
          kind: 'PR',
          provider: dto.provider,
          repo: dto.repo,
          prNumber: Number(dto.prNumber),
          sourceBranch: dto.sourceBranch,
          targetBranch: dto.targetBranch,
        },
      };
    }

    return { target: { kind: 'BRANCH', branchName: dto.branch!.trim() } };
  }

  private async createAnalysisRecord(
    projectId: string,
    dto: CreateAnalysisDto,
    target:
      | { kind: 'BRANCH'; branchName: string }
      | {
          kind: 'PR';
          provider: PullRequestProvider;
          repo: string;
          prNumber: number;
          sourceBranch: string;
          targetBranch: string;
        },
  ) {
    if (target.kind === 'BRANCH') {
      let branch = await this.prisma.branch.findFirst({
        where: { projectId, name: target.branchName },
      });

      if (!branch) {
        const existingDefault = await this.prisma.branch.findFirst({
          where: { projectId, isDefault: true },
          select: { id: true },
        });
        branch = await this.prisma.branch.create({
          data: {
            name: target.branchName,
            isDefault: !existingDefault || target.branchName === 'main',
            projectId,
          },
        });
      }

      const analysis = await this.prisma.analysis.create({
        data: {
          projectId,
          branchId: branch.id,
          commitSha: dto.commitSha,
          status: AnalysisStatus.PENDING,
        },
        include: {
          branch: true,
          project: true,
          pullRequest: true,
        },
      });

      return { analysis, branchNameForPayload: target.branchName, pullRequestInfo: null };
    }

    const pullRequest = await this.prisma.pullRequest.upsert({
      where: {
        projectId_provider_repo_prNumber: {
          projectId,
          provider: target.provider,
          repo: target.repo,
          prNumber: target.prNumber,
        },
      },
      update: {
        commitSha: dto.commitSha,
        sourceBranch: target.sourceBranch,
        targetBranch: target.targetBranch,
      },
      create: {
        projectId,
        provider: target.provider,
        repo: target.repo,
        prNumber: target.prNumber,
        sourceBranch: target.sourceBranch,
        targetBranch: target.targetBranch,
        commitSha: dto.commitSha,
      },
    });

    const analysis = await this.prisma.analysis.create({
      data: {
        projectId,
        pullRequestId: pullRequest.id,
        commitSha: dto.commitSha,
        status: AnalysisStatus.PENDING,
      },
      include: {
        branch: true,
        project: true,
        pullRequest: true,
      },
    });

    const branchNameForPayload = target.sourceBranch || target.targetBranch || `pr-${target.prNumber}`;
    const pullRequestInfo = {
      id: pullRequest.id,
      provider: target.provider,
      repo: target.repo,
      prNumber: target.prNumber,
      sourceBranch: target.sourceBranch,
      targetBranch: target.targetBranch,
    };

    return { analysis, branchNameForPayload, pullRequestInfo };
  }

  private async ensureAnalysisExists(id: string) {
    const exists = await this.prisma.analysis.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Analysis ${id} not found`);
    }
  }

  private async setBaseline(
    analysis: { id: string; projectId: string; branchId?: string | null; pullRequestId?: string | null },
    target:
      | { kind: 'BRANCH'; branchName: string }
      | {
          kind: 'PR';
          provider: PullRequestProvider;
          repo: string;
          prNumber: number;
          sourceBranch: string;
          targetBranch: string;
        },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: analysis.projectId },
      select: { leakPeriodType: true, leakPeriodValue: true },
    });
    if (!project) return;

    let baselineAnalysisId: string | null = null;

    if (target.kind === 'PR') {
      baselineAnalysisId = await this.findBaselineForPr(analysis.projectId, target.targetBranch, analysis.id);
    } else {
      baselineAnalysisId = await this.findBaselineForBranch(
        analysis.projectId,
        analysis.branchId,
        project.leakPeriodType,
        project.leakPeriodValue,
        analysis.id,
      );
    }

    if (baselineAnalysisId) {
      await this.prisma.analysis.update({
        where: { id: analysis.id },
        data: { baselineAnalysisId },
      });
    }
  }

  private async findBaselineForPr(projectId: string, targetBranch: string, currentAnalysisId: string) {
    const targetBranchEntity = await this.prisma.branch.findFirst({
      where: { projectId, name: targetBranch },
      select: { id: true },
    });

    const baseline = await this.prisma.analysis.findFirst({
      where: {
        projectId,
        branchId: targetBranchEntity?.id ?? undefined,
        status: AnalysisStatus.SUCCESS,
        NOT: { id: currentAnalysisId },
      },
      orderBy: [
        { finishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: { id: true },
    });

    return baseline?.id ?? null;
  }

  private async findBaselineForBranch(
    projectId: string,
    branchId: string | null | undefined,
    leakType: LeakPeriodType,
    leakValue: string | null,
    currentAnalysisId: string,
  ): Promise<string | null> {
    switch (leakType) {
      case LeakPeriodType.DATE: {
        if (!leakValue) return null;
        const cutoff = new Date(leakValue);
        if (Number.isNaN(cutoff.getTime())) return null;
        const baseline = await this.prisma.analysis.findFirst({
          where: {
            projectId,
            branchId: branchId ?? undefined,
            status: AnalysisStatus.SUCCESS,
            createdAt: { lt: cutoff },
            NOT: { id: currentAnalysisId },
          },
          orderBy: [
            { finishedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          select: { id: true },
        });
        return baseline?.id ?? null;
      }
      case LeakPeriodType.BASE_BRANCH: {
        if (!leakValue) return null;
        const baseBranch = await this.prisma.branch.findFirst({
          where: { projectId, name: leakValue },
          select: { id: true },
        });
        if (!baseBranch) return null;
        const baseline = await this.prisma.analysis.findFirst({
          where: {
            projectId,
            branchId: baseBranch.id,
            status: AnalysisStatus.SUCCESS,
            NOT: { id: currentAnalysisId },
          },
          orderBy: [
            { finishedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          select: { id: true },
        });
        return baseline?.id ?? null;
      }
      case LeakPeriodType.LAST_ANALYSIS:
      default: {
        const baseline = await this.prisma.analysis.findFirst({
          where: {
            projectId,
            branchId: branchId ?? undefined,
            status: AnalysisStatus.SUCCESS,
            NOT: { id: currentAnalysisId },
          },
          orderBy: [
            { finishedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          select: { id: true },
        });
        return baseline?.id ?? null;
      }
    }
  }

  private async computeMetricsByScopeWithCoverage(
    analysisId: string,
    issues: Array<{ severity: IssueSeverity; type: IssueType; isNew: boolean }>,
  ): Promise<Record<'ALL' | 'NEW', Record<string, number>>> {
    const base = () => ({
      issues_total: 0,
      issues_blocker: 0,
      issues_critical: 0,
      issues_major: 0,
      issues_minor: 0,
      issues_info: 0,
      vulnerabilities_total: 0,
    });

    const metricsALL = base();
    const metricsNEW = base();

    const addIssue = (target: Record<string, number>, severity: IssueSeverity, type: IssueType) => {
      target.issues_total += 1;
      if (type === IssueType.VULNERABILITY) target.vulnerabilities_total += 1;
      switch (severity) {
        case IssueSeverity.BLOCKER:
          target.issues_blocker += 1;
          break;
        case IssueSeverity.CRITICAL:
          target.issues_critical += 1;
          break;
        case IssueSeverity.MAJOR:
          target.issues_major += 1;
          break;
        case IssueSeverity.MINOR:
          target.issues_minor += 1;
          break;
        case IssueSeverity.INFO:
          target.issues_info += 1;
          break;
        default:
          break;
      }
    };

    issues.forEach((issue) => {
      addIssue(metricsALL, issue.severity, issue.type);
      if (issue.isNew) {
        addIssue(metricsNEW, issue.severity, issue.type);
      }
    });

    // Add coverage metrics from database
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const coverageMetrics = await (this.prisma as any).analysisMetric.findMany({
      where: {
        analysisId,
        metricKey: { in: ['coverage', 'new_coverage', 'coverage_lines', 'coverage_branches'] },
      },
    });

    // Add coverage metrics to ALL scope
    for (const metric of coverageMetrics) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const key: string = metric.metricKey;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      const value = Number(metric.value);

      if (key === 'new_coverage') {
        (metricsNEW as Record<string, number>)[key] = value;
      } else {
        (metricsALL as Record<string, number>)[key] = value;
      }
    }

    return { ALL: metricsALL, NEW: metricsNEW };
  }

  private computeMetricsByScope(
    issues: Array<{ severity: IssueSeverity; type: IssueType; isNew: boolean }>,
  ): Record<'ALL' | 'NEW', Record<string, number>> {
    const base = () => ({
      issues_total: 0,
      issues_blocker: 0,
      issues_critical: 0,
      issues_major: 0,
      issues_minor: 0,
      issues_info: 0,
      vulnerabilities_total: 0,
    });

    const metricsALL = base();
    const metricsNEW = base();

    const addIssue = (target: Record<string, number>, severity: IssueSeverity, type: IssueType) => {
      target.issues_total += 1;
      if (type === IssueType.VULNERABILITY) target.vulnerabilities_total += 1;
      switch (severity) {
        case IssueSeverity.BLOCKER:
          target.issues_blocker += 1;
          break;
        case IssueSeverity.CRITICAL:
          target.issues_critical += 1;
          break;
        case IssueSeverity.MAJOR:
          target.issues_major += 1;
          break;
        case IssueSeverity.MINOR:
          target.issues_minor += 1;
          break;
        case IssueSeverity.INFO:
          target.issues_info += 1;
          break;
        default:
          break;
      }
    };

    issues.forEach((issue) => {
      addIssue(metricsALL, issue.severity, issue.type);
      if (issue.isNew) {
        addIssue(metricsNEW, issue.severity, issue.type);
      }
    });

    return { ALL: metricsALL, NEW: metricsNEW };
  }

  private evaluateCondition(
    condition: QualityGateCondition,
    metricsByScope: Record<'ALL' | 'NEW', Record<string, number>>,
  ) {
    const scope = condition.scope ?? 'ALL';
    const metrics = metricsByScope[scope] ?? metricsByScope.ALL;
    const value = metrics[condition.metric] ?? 0;
    const threshold = Number(condition.threshold);

    let passed = false;
    switch (condition.operator) {
      case QualityGateOperator.GT:
        passed = value > threshold;
        break;
      case QualityGateOperator.LT:
        passed = value < threshold;
        break;
      case QualityGateOperator.EQ:
        passed = value === threshold;
        break;
      default:
        passed = false;
    }

    return {
      metric: condition.metric,
      operator: condition.operator,
      threshold,
      value,
      scope,
      passed,
    };
  }

  async resolveIssue(issueId: string, dto: ResolveIssueDto, userId?: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        analysis: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with id ${issueId} not found`);
    }

    // Update issue status
    const updatedIssue = await this.prisma.issue.update({
      where: { id: issueId },
      data: { status: dto.status as IssueStatus },
    });

    // Create resolution record
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const resolution = await (this.prisma as any).issueResolution.create({
      data: {
        issueId,
        status: dto.status as IssueStatus,
        comment: dto.comment,
        author: dto.author,
      },
    });

    // Audit log for issue resolution
    await this.auditService.log({
      actorUserId: userId || dto.author,
      action: AuditAction.ISSUE_RESOLVE,
      targetType: 'Issue',
      targetId: issueId,
      metadata: {
        analysisId: issue.analysisId,
        projectKey: issue.analysis.project.key,
        projectId: issue.analysis.projectId,
        status: dto.status,
        previousStatus: issue.status,
        severity: issue.severity,
        type: issue.type,
        filePath: issue.filePath,
      },
    });

    return {
      issue: updatedIssue,
      resolution,
    };
  }

  async getIssueResolutions(issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with id ${issueId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const resolutions = await (this.prisma as any).issueResolution.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      issueId,
      currentStatus: issue.status,
      resolutions,
    };
  }

  async enqueueLlmResolveIssue(issueId: string, userId?: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        analysis: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with id ${issueId} not found`);
    }

    const llmRun = await this.prisma.llmRun.create({
      data: {
        issueId: issue.id,
        projectId: issue.analysis.projectId,
        status: 'QUEUED',
        requestedByUserId: userId ?? null,
      },
    });

    await this.queueService.enqueueLlmResolveIssue({
      llmRunId: llmRun.id,
      issueId: issue.id,
    });

    this.logger.log(
      { issueId: issue.id, llmRunId: llmRun.id, projectId: issue.analysis.projectId },
      'LLM resolve job enqueued',
    );

    return llmRun;
  }

  async listIssueLlmRuns(issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with id ${issueId} not found`);
    }

    const runs = await this.prisma.llmRun.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
      include: { pullRequest: true },
    });

    return {
      issueId,
      runs,
    };
  }
}
