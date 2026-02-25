import 'dotenv/config';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Queue, QueueEvents, Worker } from 'bullmq';
import {
  PrismaClient,
  AnalysisStatus,
  IssueSeverity,
  IssueType,
  PullRequestProvider,
  QualityGateCondition,
  QualityGateOperator,
  QualityGateScope,
} from '@prisma/client';
import { createDecipheriv, createHash, randomUUID } from 'crypto';
import {
  AnalysisJobPayload,
  LlmResolveIssueJobPayload,
  assertLlmOutputScope,
  parseLlmOutputJson,
} from '@qubeless/shared';
import { createLogger } from './logger';
import { DockerRunner } from './docker-runner';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import unzipper from 'unzipper';
import { pipeline } from 'node:stream/promises';
import { sendChatNotifications } from './chat-notifications';
import { createVcsClient, VcsProvider } from './vcs';

const logger = createLogger();
const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

const queueName = process.env.WORKER_QUEUE ?? 'analysis-queue';
const workerConcurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);
const workerJobAttempts = Number(process.env.WORKER_JOB_ATTEMPTS ?? 2);
const workerBackoffMs = Number(process.env.WORKER_BACKOFF_MS ?? 5000);

// Analyzer Docker resource limits
const analyzerTimeoutMs = Number(process.env.ANALYZER_TIMEOUT_MS ?? 600000);
const analyzerMemoryMb = process.env.ANALYZER_MEMORY_MB ? Number(process.env.ANALYZER_MEMORY_MB) : undefined;
const analyzerCpuLimit = process.env.ANALYZER_CPU_LIMIT ? Number(process.env.ANALYZER_CPU_LIMIT) : undefined;

const prisma = new PrismaClient();
const dockerRunner = new DockerRunner();
const workspaceDefault = process.env.WORKSPACE_PATH ?? '/workspace';
const outBase = process.env.OUT_BASE ?? '/tmp/analyzer-out';
const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT ?? 'http://minio:9000',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minio',
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minio123',
  },
  forcePathStyle: true,
});
const sourcesBucket = process.env.MINIO_BUCKET_SOURCES ?? 'sources';
const artifactsBucket = process.env.MINIO_BUCKET_ARTIFACTS ?? 'artifacts';
const githubToken = process.env.GITHUB_TOKEN ?? process.env.GITHUB_STATUS_TOKEN;
const gitlabToken = process.env.GITLAB_TOKEN ?? process.env.GITLAB_STATUS_TOKEN;
const bitbucketToken = process.env.BITBUCKET_TOKEN ?? process.env.BITBUCKET_STATUS_TOKEN;
const gitlabBaseUrl = normalizeGitlabBaseUrl(process.env.GITLAB_BASE_URL);
const gitlabApiBaseUrl = `${gitlabBaseUrl}/api/v4`;
const webAppBase = (process.env.WEB_APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const COMMENT_MARKER_PREFIX = '<!-- qubeless-analysis:';

/**
 * Détecte le langage d'un fichier basé sur son extension
 * Retourne null si le langage n'est pas reconnu
 */
function detectLanguageFromFilePath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  // Mapping des extensions vers les langages
  const extensionMap: Record<string, string> = {
    '.js': 'JavaScript/TypeScript',
    '.jsx': 'JavaScript/TypeScript',
    '.ts': 'JavaScript/TypeScript',
    '.tsx': 'JavaScript/TypeScript',
    '.mjs': 'JavaScript/TypeScript',
    '.cjs': 'JavaScript/TypeScript',
    '.py': 'Python',
    '.pyw': 'Python',
    '.pyx': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.php': 'PHP',
    '.rs': 'Rust',
    '.cs': 'C#',
    '.rb': 'Ruby',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin',
  };

  // Fichiers de configuration spéciaux
  const configFileMap: Record<string, string> = {
    'package.json': 'JavaScript/TypeScript',
    'tsconfig.json': 'JavaScript/TypeScript',
    'requirements.txt': 'Python',
    'setup.py': 'Python',
    'pom.xml': 'Java',
    'build.gradle': 'Java',
    'go.mod': 'Go',
    'composer.json': 'PHP',
    'Cargo.toml': 'Rust',
    'Gemfile': 'Ruby',
    'Package.swift': 'Swift',
  };

  // Vérifier d'abord les fichiers de config par nom
  if (configFileMap[fileName]) {
    return configFileMap[fileName];
  }

  // Puis par extension
  return extensionMap[ext] || null;
}

function normalizeGitlabBaseUrl(value?: string) {
  const fallback = 'https://gitlab.com';
  if (!value) return fallback;
  let base = value.trim();
  if (!base) return fallback;
  base = base.replace(/\/+$/, '');
  if (base.endsWith('/api/v4')) {
    base = base.slice(0, -'/api/v4'.length);
  }
  return base || fallback;
}

/**
 * Détecte les langages utilisés dans le workspace en scannant les fichiers
 * Retourne un tableau de noms de langages uniques détectés
 */
async function detectLanguagesInWorkspace(workspacePath: string): Promise<string[]> {
  const languageCounts = new Map<string, number>();
  const maxDepth = 10;
  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    '.svn',
    'dist',
    'build',
    'target',
    'bin',
    'obj',
    '.next',
    '.nuxt',
    'coverage',
    '__pycache__',
    '.pytest_cache',
    'vendor',
    '.idea',
    '.vscode',
  ]);

  async function scanDirectory(dirPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Ignorer les répertoires cachés et communs
          if (ignoredDirs.has(entry.name) || entry.name.startsWith('.')) {
            continue;
          }
          await scanDirectory(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const language = detectLanguageFromFilePath(fullPath);
          if (language) {
            languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs de lecture (permissions, etc.)
      logger.debug({ dirPath, error }, 'Failed to scan directory for language detection');
    }
  }

  await scanDirectory(workspacePath, 0);

  // Retourner les langages triés par nombre de fichiers (décroissant)
  const sortedLanguages = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([language]) => language);

  return sortedLanguages;
}

async function performReadinessChecks() {
  const checks: Array<{ name: string; status: 'ok' | 'error'; latency?: number; error?: string }> = [];

  // Check Postgres
  const pgStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'postgres', status: 'ok', latency: Date.now() - pgStart });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    checks.push({ name: 'postgres', status: 'error', latency: Date.now() - pgStart, error: errorMessage });
    logger.error({ error: errorMessage }, 'Postgres readiness check failed');
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    const testQueue = new Queue('health-check', { connection });
    const client = await testQueue.client;
    await client.ping();
    await testQueue.close();
    checks.push({ name: 'redis', status: 'ok', latency: Date.now() - redisStart });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    checks.push({ name: 'redis', status: 'error', latency: Date.now() - redisStart, error: errorMessage });
    logger.error({ error: errorMessage }, 'Redis readiness check failed');
  }

  // Check MinIO - try to access the S3 client to ensure it's configured correctly
  const minioStart = Date.now();
  try {
    // Simple check: create a command (doesn't actually execute without send)
    // This verifies S3Client is properly initialized
    const testCommand = new GetObjectCommand({ Bucket: sourcesBucket, Key: 'health-check-test' });
    // Actually, let's just verify the client exists and is configured
    if (!s3Client) {
      throw new Error('S3Client not initialized');
    }
    checks.push({ name: 'minio', status: 'ok', latency: Date.now() - minioStart });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    checks.push({ name: 'minio', status: 'error', latency: Date.now() - minioStart, error: errorMessage });
    logger.error({ error: errorMessage }, 'MinIO readiness check failed');
  }

  // Check Docker
  const dockerStart = Date.now();
  try {
    await dockerRunner.checkHealth();
    checks.push({ name: 'docker', status: 'ok', latency: Date.now() - dockerStart });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    checks.push({ name: 'docker', status: 'error', latency: Date.now() - dockerStart, error: errorMessage });
    logger.error({ error: errorMessage }, 'Docker readiness check failed');
  }

  const allOk = checks.every((check) => check.status === 'ok');

  if (allOk) {
    logger.info({ checks }, 'Worker READY - all systems operational');
  } else {
    const failedChecks = checks.filter((check) => check.status === 'error');
    logger.error({ checks, failedChecks }, 'Worker NOT READY - some systems unavailable');
    throw new Error(`Readiness checks failed: ${failedChecks.map((c) => c.name).join(', ')}`);
  }
}

async function bootstrap() {
  logger.info(
    { queueName, connection, workerConcurrency, workerJobAttempts, workerBackoffMs },
    'Worker service starting',
  );

  // Perform readiness checks before starting the worker
  await performReadinessChecks();

  const worker = new Worker(
    queueName,
    async (job) => {
      const attemptNumber = job.attemptsMade + 1;

      if (job.name === 'analysis') {
        const payload = job.data as AnalysisJobPayload;
        const correlationId = payload.analysisId;

        logger.info(
          { jobId: job.id, correlationId, analysisId: correlationId, attempt: attemptNumber, maxAttempts: workerJobAttempts },
          'Processing analysis job',
        );

        await handleAnalysisJob(payload, job.attemptsMade, workerJobAttempts);
        return;
      }

      if (job.name === 'llm:resolve-issue') {
        const payload = job.data as LlmResolveIssueJobPayload;
        const correlationId = payload.llmRunId;

        logger.info(
          { jobId: job.id, correlationId, llmRunId: payload.llmRunId, issueId: payload.issueId, attempt: attemptNumber, maxAttempts: workerJobAttempts },
          'Processing LLM resolve issue job',
        );

        await handleLlmResolveIssueJob(payload, job.attemptsMade, workerJobAttempts);
        return;
      }

      logger.warn({ jobId: job.id, name: job.name }, 'Unknown job type; skipping');
    },
    {
      connection,
      concurrency: workerConcurrency,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          const delay = workerBackoffMs * Math.pow(2, attemptsMade - 1);
          logger.info({ attemptsMade, delay }, 'Backoff strategy applied');
          return delay;
        },
      },
    },
  );

  const queue = new Queue(queueName, { connection });
  const events = new QueueEvents(queueName, { connection });

  events.on('waiting', ({ jobId }) => logger.info({ jobId }, 'Job waiting'));
  events.on('failed', ({ jobId, failedReason }) =>
    logger.error({ jobId, failedReason }, 'Job failed'),
  );

  worker.on('ready', () => logger.info({ concurrency: workerConcurrency }, 'Worker ready'));
  worker.on('error', (err) => logger.error({ err }, 'Worker error'));

  const shutdown = async () => {
    logger.info('Shutting down worker');
    await Promise.allSettled([worker.close(), queue.close(), events.close(), prisma.$disconnect()]);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Failed to start worker');
  process.exit(1);
});

async function handleAnalysisJob(payload: AnalysisJobPayload, attemptsMade: number, maxAttempts: number) {
  const { analysisId, commitSha } = payload;
  const isFirstAttempt = attemptsMade === 0;
  const isLastAttempt = attemptsMade >= maxAttempts - 1;

  // Set status to RUNNING only on first attempt
  if (isFirstAttempt) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: AnalysisStatus.RUNNING, startedAt: new Date() },
    });
    await publishPrStatus(payload, 'pending', 'Analysis pending');
    logger.info({ analysisId, correlationId: analysisId }, 'Analysis status set to RUNNING');
  } else {
    logger.info(
      { analysisId, correlationId: analysisId, attempt: attemptsMade + 1, maxAttempts },
      'Retrying analysis job',
    );
  }

  try {
    const gateStatus = await processAnalyzers(payload);
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: AnalysisStatus.SUCCESS, finishedAt: new Date() },
    });
    if (gateStatus === 'FAIL') {
      await publishPrStatus(payload, 'failure', 'Quality gate FAIL');
    } else {
      await publishPrStatus(
        payload,
        'success',
        gateStatus === 'PASS' ? 'Quality gate PASS' : 'Analysis completed',
      );
    }
    await publishPrComment(payload, gateStatus ?? 'UNKNOWN');

    // Send chat notifications
    await sendChatNotificationsForAnalysis(analysisId, payload, gateStatus);

    logger.info({ analysisId, correlationId: analysisId, gateStatus }, 'Analysis completed successfully');
  } catch (error) {
    logger.error(
      {
        analysisId,
        correlationId: analysisId,
        error: error instanceof Error ? error.message : String(error),
        attempt: attemptsMade + 1,
        maxAttempts,
        isLastAttempt,
      },
      'Analysis failed',
    );

    // Only mark as FAILED if this is the last attempt
    if (isLastAttempt) {
      logger.error(
        { analysisId, correlationId: analysisId, totalAttempts: attemptsMade + 1 },
        'All retry attempts exhausted, marking analysis as FAILED',
      );
      await publishPrStatus(payload, 'failure', 'Analysis failed');
      await publishPrComment(payload, 'FAIL');
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: AnalysisStatus.FAILED, finishedAt: new Date() },
      });
    } else {
      logger.info(
        { analysisId, correlationId: analysisId, nextAttempt: attemptsMade + 2, maxAttempts },
        'Analysis will be retried',
      );
    }

    throw error;
  }
}

async function handleLlmResolveIssueJob(payload: LlmResolveIssueJobPayload, attemptsMade: number, maxAttempts: number) {
  const { llmRunId, issueId } = payload;
  const isFirstAttempt = attemptsMade === 0;
  const isLastAttempt = attemptsMade >= maxAttempts - 1;

  if (isFirstAttempt) {
    await prisma.llmRun.update({
      where: { id: llmRunId },
      data: { status: 'RUNNING' },
    });
    logger.info({ llmRunId, correlationId: llmRunId }, 'LLM run status set to RUNNING');
  } else {
    logger.info(
      { llmRunId, correlationId: llmRunId, attempt: attemptsMade + 1, maxAttempts },
      'Retrying LLM resolve job',
    );
  }

  let outputPatch: string | null = null;
  let outputSummary: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let cost: number | null = null;
  let requestedByUserId: string | null = null;

  try {
    const llmRun = await prisma.llmRun.findUnique({
      where: { id: llmRunId },
      select: { requestedByUserId: true },
    });
    requestedByUserId = llmRun?.requestedByUserId ?? null;

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        analysis: {
          include: {
            project: true,
            pullRequest: true,
            branch: true,
          },
        },
      },
    });

    if (!issue) {
      throw new Error(`Issue with id ${issueId} not found`);
    }

    const { provider, overrides } = await getEffectiveLlmProvider(issue.analysis.projectId);
    if (!provider) {
      throw new Error('No LLM provider configured for this project');
    }

    const promptTemplate = await getActivePromptTemplate();
    if (!promptTemplate) {
      throw new Error('No active LLM prompt template found');
    }

    const promptVersion = `${promptTemplate.name}@${promptTemplate.version}`;

    await prisma.llmRun.update({
      where: { id: llmRunId },
      data: {
        providerId: provider.id,
        promptVersion,
      },
    });

    const sourceArtifact = await findSourceArtifact(issue.analysisId, issue.analyzerKey);
    if (!sourceArtifact) {
      throw new Error('SOURCE_ZIP artifact not found for this issue');
    }

    const workspacePath = await downloadAndExtractSource(sourceArtifact.objectKey, issue.analysisId, sourceArtifact.bucket);
    const codeContext = await buildIssueContext(workspacePath, issue.filePath, issue.line);

    const promptInput = buildLlmPromptInput(issue, codeContext);
    const outputFormatHint = [
      'OUTPUT FORMAT (strict JSON only):',
      '{"summary":"...","files":[{"path":"path/to/file","content":"<full file content>"}],"notes":[]}',
      'Rules:',
      '- Return ONLY JSON. No markdown, no backticks, no extra text.',
      '- summary must be a non-empty string.',
      '- files must be a non-empty array of {path, content}.',
      '- Each content must be the full file content after the fix.',
      '- Use context.fullFileContent as the base and apply the smallest possible edit.',
      `- Only modify ${issue.filePath}.`,
    ].join('\n');
    const promptText = [
      promptTemplate.taskPrompt,
      '',
      'INPUT:',
      JSON.stringify(promptInput, null, 2),
      '',
      outputFormatHint,
    ].join('\n');

    const llmResponse = await callLlmProvider({
      provider,
      systemPrompt: promptTemplate.systemPrompt,
      userPrompt: promptText,
      overrides,
    });

    inputTokens = llmResponse.inputTokens ?? null;
    outputTokens = llmResponse.outputTokens ?? null;
    cost = llmResponse.cost ?? null;

    const output = parseLlmOutput(llmResponse.content);
    assertLlmOutputScope(output, [issue.filePath]);

    const normalizedFiles = output.files.map((file: { path: string; content: string }) => ({
      path: normalizeLlmFilePath(file.path),
      content: file.content,
    }));

    outputSummary = output.summary;
    outputPatch = JSON.stringify(normalizedFiles, null, 2);

    const vcsContext = await resolveVcsContext(issue, requestedByUserId ?? undefined);
    const prDetails = await createLlmPullRequest({
      issueId: issue.id,
      provider: vcsContext.provider,
      repo: vcsContext.repo,
      baseBranch: vcsContext.baseBranch,
      token: vcsContext.token,
      baseUrl: vcsContext.baseUrl,
      llmRunId,
      files: normalizedFiles,
      summary: output.summary,
    });

    const pullRequestRecord = await prisma.pullRequest.upsert({
      where: {
        projectId_provider_repo_prNumber: {
          projectId: issue.analysis.projectId,
          provider: vcsContext.provider,
          repo: vcsContext.repo,
          prNumber: prDetails.prNumber,
        },
      },
      update: {
        sourceBranch: prDetails.sourceBranch,
        targetBranch: prDetails.targetBranch,
        commitSha: prDetails.commitSha,
        url: prDetails.prUrl,
      },
      create: {
        projectId: issue.analysis.projectId,
        provider: vcsContext.provider,
        repo: vcsContext.repo,
        prNumber: prDetails.prNumber,
        sourceBranch: prDetails.sourceBranch,
        targetBranch: prDetails.targetBranch,
        commitSha: prDetails.commitSha,
        url: prDetails.prUrl,
      },
    });

    await prisma.llmRun.update({
      where: { id: llmRunId },
      data: {
        status: 'SUCCESS',
        inputTokens,
        outputTokens,
        cost,
        outputPatch,
        outputSummary,
        errorMessage: null,
        pullRequestId: pullRequestRecord.id,
      },
    });

    logger.info({ llmRunId, correlationId: llmRunId }, 'LLM resolve job completed successfully');
  } catch (error) {
    logger.error(
      {
        llmRunId,
        correlationId: llmRunId,
        error: error instanceof Error ? error.message : String(error),
        attempt: attemptsMade + 1,
        maxAttempts,
        isLastAttempt,
      },
      'LLM resolve job failed',
    );

    if (isLastAttempt) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.llmRun.update({
        where: { id: llmRunId },
        data: {
          status: 'FAILED',
          errorMessage,
          inputTokens,
          outputTokens,
          cost,
          outputPatch,
          outputSummary,
        },
      });
      logger.error({ llmRunId, correlationId: llmRunId }, 'All retry attempts exhausted, marking LLM run as FAILED');
    } else {
      logger.info(
        { llmRunId, correlationId: llmRunId, nextAttempt: attemptsMade + 2, maxAttempts },
        'LLM resolve job will be retried',
      );
    }

    throw error;
  }
}

async function processAnalyzers(payload: AnalysisJobPayload): Promise<'PASS' | 'FAIL' | 'UNKNOWN'> {
  const { analysisId } = payload;
  const analyzers = await getActiveAnalyzersForProject(payload.projectKey);

  if (!analyzers.length) {
    logger.warn(
      { analysisId, correlationId: analysisId, projectKey: payload.projectKey },
      'No active analyzers found',
    );
    const outDir = await prepareOutDir(payload.analysisId, 'none');
    const logPath = path.join(outDir, 'run.log');
    await fsp.writeFile(logPath, 'No analyzers active for this project.\n', 'utf8');
    const metrics = computeMetricsFromIssues([]);
    const measuresPath = await writeMeasures(outDir, metrics);
    const reportPath = await writeReport(outDir, { analyzer: { name: 'aggregate', version: '0.0.0' }, issues: [] });
    await uploadArtifacts(payload.analysisId, 'none', outDir, {
      logPath,
      measuresPath,
      reportPath,
    });
    const gateStatus = await evaluateQualityGate(payload.analysisId);
    await markAnalysisMetrics(payload.analysisId);
    return gateStatus ?? 'UNKNOWN';
  }

  const workspacePath =
    (payload.sourceObjectKey
      ? await downloadAndExtractSource(payload.sourceObjectKey, payload.analysisId)
      : payload.workspacePath) ?? workspaceDefault;

  const hasFiles = await directoryHasFiles(workspacePath);
  if (!hasFiles) {
    logger.error(
      { analysisId, correlationId: analysisId, workspacePath },
      'Workspace is empty after extraction; aborting analyzers',
    );
    throw new Error(`Workspace is empty at ${workspacePath}`);
  }

  // Détecter les langages du projet et mettre à jour la base de données
  try {
    const detectedLanguages = await detectLanguagesInWorkspace(workspacePath);
    if (detectedLanguages.length > 0) {
      await prisma.project.update({
        where: { key: payload.projectKey },
        data: { languages: detectedLanguages },
      });
      logger.info(
        { analysisId, correlationId: analysisId, languages: detectedLanguages },
        'Detected and saved project languages',
      );
    }
  } catch (error) {
    // Ne pas bloquer l'analyse si la détection échoue
    logger.warn(
      { analysisId, correlationId: analysisId, error: error instanceof Error ? error.message : String(error) },
      'Failed to detect languages, continuing analysis',
    );
  }

  const aggregatedIssues: any[] = [];
  const aggregatedMetrics: Record<string, number> = {};
  const baselineData = await getBaselineFingerprints(payload.analysisId);

  for (const analyzer of analyzers) {
    const outDir = await prepareOutDir(payload.analysisId, analyzer.key);
    const env = {
      ANALYSIS_ID: payload.analysisId,
      PROJECT_KEY: payload.projectKey,
      COMMIT_SHA: payload.commitSha,
      ANALYZER_KEY: analyzer.key,
      ANALYZER_CONFIG: analyzer.configJson ? JSON.stringify(analyzer.configJson) : '',
    };

    const result = await dockerRunner.run({
      dockerImage: analyzer.dockerImage,
      workspacePath,
      outPath: outDir,
      env,
      timeoutMs: analyzerTimeoutMs,
      memoryMb: analyzerMemoryMb,
      cpuLimit: analyzerCpuLimit,
  });

  if (!result.success || !result.report) {
      let outFiles: string[] = [];
      try {
        outFiles = await fsp.readdir(outDir);
      } catch (err) {
        outFiles = [`<failed to list out dir: ${(err as Error)?.message}>`];
      }

      logger.error(
        {
          analysisId,
          correlationId: analysisId,
          analyzer: analyzer.key,
          dockerImage: analyzer.dockerImage,
          exitCode: result.exitCode,
          error: result.error,
          errorType: result.errorType,
          containerId: result.containerId,
          outDir,
          outFiles,
          hasReport: Boolean(result.reportPath),
          hasMeasures: Boolean(result.measuresPath),
          logPath: result.logPath,
        },
        'Analyzer run failed or report missing',
      );

      await uploadArtifacts(payload.analysisId, analyzer.key, outDir, result);
      throw new Error(result.error ?? `Analyzer ${analyzer.key} failed or missing report`);
    }

    const issues = result.report.issues ?? [];
    aggregatedIssues.push(...issues);

    // Register all rules from the report (if provided)
    if (result.report.rules && result.report.rules.length > 0) {
      await registerRulesFromCatalog(analyzer.key, result.report.rules);
    }

    await persistIssues(payload.analysisId, analyzer.key, issues, baselineData);

    const metrics: Record<string, number> = result.measures ?? computeMetricsFromIssues(issues);
    mergeMetrics(aggregatedMetrics, metrics);
    const measuresPath = result.measuresPath ?? (await writeMeasures(outDir, metrics));
    const reportPath = result.reportPath ?? (await writeReport(outDir, result.report));

    await uploadArtifacts(payload.analysisId, analyzer.key, outDir, {
      logPath: result.logPath,
      measuresPath,
      reportPath,
    });

    logger.info(
      { analysisId, correlationId: analysisId, analyzer: analyzer.key, out: outDir, issues: issues.length },
      'Analyzer run completed',
    );
  }

  const metricsForGate =
    Object.keys(aggregatedMetrics).length > 0 ? aggregatedMetrics : computeMetricsFromIssues(aggregatedIssues);
  const gateStatus = await evaluateQualityGate(payload.analysisId);
  await markAnalysisMetrics(payload.analysisId);
  await calculateAndSaveTechnicalDebt(payload.analysisId);
  return gateStatus ?? 'UNKNOWN';
}

type StatusState = 'pending' | 'success' | 'failure';

async function publishPrStatus(payload: AnalysisJobPayload, state: StatusState, description: string) {
  const pr = payload.pullRequest;
  if (!pr) return;
  const targetUrl = `${webAppBase}/analyses/${payload.analysisId}`;

  try {
    if (pr.provider === 'GITHUB' && githubToken) {
      const url = `https://api.github.com/repos/${pr.repo}/statuses/${payload.commitSha}`;
      const body = {
        state,
        context: 'Code Quality',
        description,
        target_url: targetUrl,
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'User-Agent': 'qubeless-worker',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        logger.warn({ url, status: res.status, text }, 'Failed to publish GitHub status');
      }
      return;
    }

    if (pr.provider === 'GITLAB' && gitlabToken) {
      const projectId = encodeURIComponent(pr.repo);
      const url = `${gitlabApiBaseUrl}/projects/${projectId}/statuses/${payload.commitSha}`;
      const body = new URLSearchParams({
        state: state === 'failure' ? 'failed' : state,
        context: 'Code Quality',
        description,
        target_url: targetUrl,
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Private-Token': gitlabToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        logger.warn({ url, status: res.status, text }, 'Failed to publish GitLab status');
      }
    }
  } catch (err: any) {
    logger.warn({ err, analysisId: payload.analysisId }, 'Error while publishing PR status');
  }
}

type GateStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

async function publishPrComment(payload: AnalysisJobPayload, gateStatus: GateStatus) {
  const pr = payload.pullRequest;
  if (!pr) return;
  const marker = `${COMMENT_MARKER_PREFIX}${payload.analysisId} -->`;
  const targetUrl = `${webAppBase}/analyses/${payload.analysisId}`;

  let summary: { totalNew: number; bySeverity: Record<string, number> } | null = null;
  try {
    summary = await getNewIssuesSummary(payload.analysisId);
  } catch (err: any) {
    logger.warn({ err, analysisId: payload.analysisId }, 'Failed to compute new issues summary for comment');
  }

  const body = buildCommentBody({
    marker,
    gateStatus,
    targetUrl,
    summary,
  });

  try {
    if (pr.provider === 'GITHUB' && githubToken) {
      await upsertGithubComment(pr.repo, pr.prNumber, marker, body);
    } else if (pr.provider === 'GITLAB' && gitlabToken) {
      await upsertGitlabComment(pr.repo, pr.prNumber, marker, body);
    }
  } catch (err: any) {
    logger.warn({ err, analysisId: payload.analysisId }, 'Failed to publish PR comment');
  }
}

function buildCommentBody(params: {
  marker: string;
  gateStatus: GateStatus;
  targetUrl: string;
  summary: { totalNew: number; bySeverity: Record<string, number> } | null;
}) {
  const lines: string[] = [];
  lines.push(params.marker);
  lines.push(`**Code Quality: ${params.gateStatus}**`);

  if (params.summary) {
    lines.push(`New issues: ${params.summary.totalNew}`);
    const sevOrder: Array<keyof typeof IssueSeverity> = [
      IssueSeverity.BLOCKER,
      IssueSeverity.CRITICAL,
      IssueSeverity.MAJOR,
      IssueSeverity.MINOR,
      IssueSeverity.INFO,
    ];
    const sevLabels: Record<string, string> = {
      [IssueSeverity.BLOCKER]: 'BLOCKER',
      [IssueSeverity.CRITICAL]: 'CRITICAL',
      [IssueSeverity.MAJOR]: 'MAJOR',
      [IssueSeverity.MINOR]: 'MINOR',
      [IssueSeverity.INFO]: 'INFO',
    };
    const parts = sevOrder.map((s) => `${sevLabels[s]}: ${params.summary!.bySeverity[s] ?? 0}`);
    lines.push(parts.join(' · '));
  }

  lines.push(`Analyse : ${params.targetUrl}`);
  return lines.join('\n');
}

async function getNewIssuesSummary(analysisId: string) {
  const sevValues = Object.values(IssueSeverity);
  const counts = await prisma.issue.groupBy({
    by: ['severity'],
    where: { analysisId, isNew: true },
    _count: true,
  });
  const map = Object.fromEntries(sevValues.map((s) => [s, 0]));
  counts.forEach((c) => {
    map[c.severity] = c._count ?? 0;
  });
  const total = counts.reduce((acc, cur) => acc + (cur._count ?? 0), 0);
  return { totalNew: total, bySeverity: map };
}

async function upsertGithubComment(repo: string, prNumber: number, marker: string, body: string) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    'User-Agent': 'qubeless-worker',
    Accept: 'application/vnd.github+json',
  };
  const listUrl = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=50`;
  const resList = await fetch(listUrl, { headers });
  if (!resList.ok) {
    logger.warn({ status: resList.status, url: listUrl }, 'Failed to list GitHub comments');
  }
  const comments = resList.ok ? ((await resList.json()) as Array<{ id: number; body: string }>) : [];
  const existing = comments.find((c) => c.body?.includes(marker));

  if (existing) {
    const updateUrl = `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ status: res.status, url: updateUrl, text }, 'Failed to update GitHub comment');
    }
    return;
  }

  const createUrl = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
  const resCreate = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  });
  if (!resCreate.ok) {
    const text = await resCreate.text();
    logger.warn({ status: resCreate.status, url: createUrl, text }, 'Failed to create GitHub comment');
  }
}

async function upsertGitlabComment(repo: string, prNumber: number, marker: string, body: string) {
  const projectId = encodeURIComponent(repo);
  const headers = {
    'Private-Token': gitlabToken as string,
  };
  const listUrl = `${gitlabApiBaseUrl}/projects/${projectId}/merge_requests/${prNumber}/notes?per_page=50`;
  const resList = await fetch(listUrl, { headers });
  if (!resList.ok) {
    logger.warn({ status: resList.status, url: listUrl }, 'Failed to list GitLab comments');
  }
  const notes = resList.ok ? ((await resList.json()) as Array<{ id: number; body: string }>) : [];
  const existing = notes.find((n) => n.body?.includes(marker));

  if (existing) {
    const updateUrl = `${gitlabApiBaseUrl}/projects/${projectId}/merge_requests/${prNumber}/notes/${existing.id}`;
    const res = await fetch(updateUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ status: res.status, url: updateUrl, text }, 'Failed to update GitLab comment');
    }
    return;
  }

  const createUrl = `${gitlabApiBaseUrl}/projects/${projectId}/merge_requests/${prNumber}/notes`;
  const resCreate = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  });
  if (!resCreate.ok) {
    const text = await resCreate.text();
    logger.warn({ status: resCreate.status, url: createUrl, text }, 'Failed to create GitLab comment');
  }
}

async function simulateAnalysis(payload: AnalysisJobPayload) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await createMockIssues(payload.analysisId, payload.commitSha);
  // create dummy artifacts
  const outDir = await prepareOutDir(payload.analysisId, 'mock');
  const logPath = path.join(outDir, 'run.log');
  await fsp.writeFile(logPath, 'Simulation completed\n', 'utf8');
  const measuresPath = path.join(outDir, 'measures.json');
  await fsp.writeFile(
    measuresPath,
    JSON.stringify({ metrics: { issues_total: 3, issues_critical: 1 } }, null, 2),
    'utf8',
  );
  const reportPath = path.join(outDir, 'report.json');
  await fsp.writeFile(
    reportPath,
    JSON.stringify(
      {
        analyzer: { name: 'mock', version: '0.0.0' },
        issues: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  await uploadArtifacts(payload.analysisId, 'mock', outDir, {
    logPath,
    measuresPath,
    reportPath,
  });
}

async function createMockIssues(analysisId: string, seed: string) {
  const { fingerprints: baselineFingerprints, baselineId } = await getBaselineFingerprints(analysisId);
  const mockIssues: Array<{
    ruleKey: string;
    severity: IssueSeverity;
    type: IssueType;
    filePath: string;
    line?: number;
    message: string;
  }> = [
    {
      ruleKey: 'js:S100',
      severity: IssueSeverity.MINOR,
      type: IssueType.CODE_SMELL,
      filePath: 'src/index.ts',
      line: 12,
      message: 'Dummy code smell: simplify this function',
    },
    {
      ruleKey: 'js:S200',
      severity: IssueSeverity.MAJOR,
      type: IssueType.BUG,
      filePath: 'src/app.ts',
      line: 42,
      message: 'Dummy bug: potential null dereference',
    },
    {
      ruleKey: 'js:S300',
      severity: IssueSeverity.CRITICAL,
      type: IssueType.VULNERABILITY,
      filePath: 'src/security.ts',
      line: 7,
      message: 'Dummy vulnerability: missing input validation',
    },
  ];

  const issuesData = mockIssues.map((issue) => {
    const fingerprint = buildFingerprint(seed, issue);
    const isNew = baselineFingerprints ? !baselineFingerprints.has(fingerprint) : false;
    return {
      analysisId,
      analyzerKey: 'mock',
      ruleKey: issue.ruleKey,
      severity: issue.severity,
      type: issue.type,
      filePath: issue.filePath,
      line: issue.line ?? null,
      message: issue.message,
      fingerprint,
      language: detectLanguageFromFilePath(issue.filePath),
      isNew,
      baselineAnalysisId: baselineId,
    };
  });

  await registerRules('mock', mockIssues);
  const disabledRuleKeys = await getDisabledRuleKeysForAnalysis(analysisId, issuesData.map((i) => i.ruleKey));
  const filteredIssuesData = issuesData.filter((issue) => !disabledRuleKeys.has(issue.ruleKey));
  if (!filteredIssuesData.length) return;

  await prisma.issue.createMany({
    data: filteredIssuesData,
    skipDuplicates: true,
  });
}

type BaselineData = { fingerprints: Set<string> | null; baselineId: string | null };

async function getBaselineFingerprints(analysisId: string): Promise<BaselineData> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: {
      id: true,
      projectId: true,
      branchId: true,
      pullRequestId: true,
      project: { select: { leakPeriodType: true, leakPeriodValue: true } },
      baselineAnalysisId: true,
    },
  });
  if (!analysis) return { fingerprints: new Set(), baselineId: null };

  if (analysis.baselineAnalysisId) {
    const baselineIssues = await prisma.issue.findMany({
      where: { analysisId: analysis.baselineAnalysisId },
      select: { fingerprint: true },
    });
    return {
      fingerprints: new Set(baselineIssues.map((i) => i.fingerprint)),
      baselineId: analysis.baselineAnalysisId,
    };
  }

  // fallback leak period logic kept for safety (legacy), but should not be used when baselineAnalysisId is set
  const leakType = (analysis.project as any)?.leakPeriodType ?? 'LAST_ANALYSIS';
  const leakValue = (analysis.project as any)?.leakPeriodValue ?? null;

  if (leakType === 'DATE') {
    if (!leakValue) return { fingerprints: new Set(), baselineId: null };
    const cutoff = new Date(leakValue);
    if (Number.isNaN(cutoff.getTime())) return { fingerprints: new Set(), baselineId: null };
    const issues = await prisma.issue.findMany({
      where: {
        analysis: {
          projectId: analysis.projectId,
          status: AnalysisStatus.SUCCESS,
          createdAt: { lte: cutoff },
          ...(analysis.pullRequestId
            ? { pullRequestId: analysis.pullRequestId }
            : analysis.branchId
              ? { branchId: analysis.branchId }
              : {}),
        },
      },
      select: { fingerprint: true },
    });
    return { fingerprints: new Set(issues.map((i) => i.fingerprint)), baselineId: null };
  }

  if (leakType === 'BASE_BRANCH') {
    if (!leakValue) return { fingerprints: new Set(), baselineId: null };
    const baseBranch = await prisma.branch.findFirst({
      where: { projectId: analysis.projectId, name: leakValue },
    });
    if (!baseBranch) return { fingerprints: new Set(), baselineId: null };
    const baseline = await prisma.analysis.findFirst({
      where: {
        projectId: analysis.projectId,
        branchId: baseBranch.id,
        status: AnalysisStatus.SUCCESS,
      },
      orderBy: [
        { finishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      include: { issues: { select: { fingerprint: true } } },
    });
    if (!baseline?.issues?.length) return { fingerprints: new Set(), baselineId: null };
    return { fingerprints: new Set(baseline.issues.map((issue) => issue.fingerprint)), baselineId: baseline.id };
  }

  const baseline = await prisma.analysis.findFirst({
    where: {
      projectId: analysis.projectId,
      ...(analysis.pullRequestId
        ? { pullRequestId: analysis.pullRequestId }
        : { branchId: analysis.branchId }),
      status: AnalysisStatus.SUCCESS,
      NOT: { id: analysisId },
    },
    orderBy: [
      { finishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    include: { issues: { select: { fingerprint: true } } },
  });

  if (!baseline?.issues?.length) return { fingerprints: new Set(), baselineId: null };
  return { fingerprints: new Set(baseline.issues.map((issue) => issue.fingerprint)), baselineId: baseline.id };
}

async function persistIssues(
  analysisId: string,
  analyzerKey: string,
  issues: any[],
  baselineData: BaselineData,
) {
  if (!issues?.length) {
    logger.warn({ analysisId, analyzerKey }, 'Analyzer report has no issues');
    return;
  }

  await registerRules(analyzerKey, issues);

  const disabledRuleKeys = await getDisabledRuleKeysForAnalysis(
    analysisId,
    issues.map((issue) => issue.ruleKey),
  );
  const filteredIssues = disabledRuleKeys.size
    ? issues.filter((issue) => !disabledRuleKeys.has(issue.ruleKey))
    : issues;

  if (!filteredIssues.length) {
    logger.info({ analysisId, analyzerKey, skipped: issues.length }, 'All issues skipped (disabled rules)');
    return;
  }

  const issuesData = filteredIssues.map((issue) => ({
    analysisId,
    analyzerKey,
    ruleKey: issue.ruleKey,
    severity: issue.severity as IssueSeverity,
    type: issue.type as IssueType,
    filePath: issue.filePath,
    line: issue.line ?? null,
    message: issue.message,
    fingerprint: issue.fingerprint,
    language: detectLanguageFromFilePath(issue.filePath),
    isNew: baselineData.fingerprints ? !baselineData.fingerprints.has(issue.fingerprint) : false,
    baselineAnalysisId: baselineData.baselineId,
  }));

  await prisma.issue.createMany({
    data: issuesData,
    skipDuplicates: true,
  });
}

async function ensureActiveRuleProfileId(projectId: string): Promise<string | null> {
  const project = (await (prisma as any).project.findUnique({
    where: { id: projectId },
    select: { id: true, activeRuleProfileId: true },
  })) as { id: string; activeRuleProfileId: string | null } | null;
  if (!project) return null;
  if (project.activeRuleProfileId) return project.activeRuleProfileId;

  return prisma.$transaction(async (tx) => {
    const existing = await (tx as any).ruleProfile.findFirst({
      where: { projectId: project.id, name: 'Default' },
      select: { id: true },
    });
    const ruleProfileId = existing?.id ?? randomUUID();
    if (!existing) {
      await (tx as any).ruleProfile.create({
        data: {
          id: ruleProfileId,
          name: 'Default',
          projectId: project.id,
        },
      });
    }
    await tx.project.update({
      where: { id: project.id },
      data: { activeRuleProfileId: ruleProfileId } as any,
    });
    return ruleProfileId;
  });
}

async function getDisabledRuleKeysForAnalysis(analysisId: string, ruleKeys: string[]): Promise<Set<string>> {
  const uniqueRuleKeys = Array.from(new Set((ruleKeys ?? []).filter(Boolean)));
  if (!uniqueRuleKeys.length) return new Set();

  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { id: true, projectId: true },
  });
  if (!analysis) return new Set();

  const profileId = await ensureActiveRuleProfileId(analysis.projectId);
  if (!profileId) return new Set();

  const disabled = await (prisma as any).ruleProfileRule.findMany({
    where: {
      ruleProfileId: profileId,
      enabled: false,
      ruleKey: { in: uniqueRuleKeys },
    },
    select: { ruleKey: true },
  });

  return new Set<string>(disabled.map((d: any) => d.ruleKey));
}

async function registerRulesFromCatalog(
  analyzerKey: string,
  rules: Array<{
    key: string;
    name: string;
    description: string;
    severity: IssueSeverity | string;
    type: IssueType | string;
  }>,
) {
  if (!rules || !rules.length) return;

  await (prisma as any).rule.createMany({
    data: rules.map((rule) => ({
      key: rule.key,
      analyzerKey,
      name: rule.name,
      description: rule.description,
      defaultSeverity: rule.severity as IssueSeverity,
    })),
    skipDuplicates: true,
  });

  logger.info(
    { analyzerKey, rulesCount: rules.length },
    'Registered rules from analyzer catalog',
  );
}

async function registerRules(
  analyzerKey: string,
  issues: Array<{
    ruleKey: string;
    severity?: IssueSeverity | string;
    ruleName?: string;
    ruleDescription?: string;
  }>,
) {
  const uniqueRules = new Map<
    string,
    { severity: IssueSeverity; name?: string; description?: string }
  >();

  for (const issue of issues ?? []) {
    if (!issue?.ruleKey) continue;
    if (uniqueRules.has(issue.ruleKey)) continue;

    uniqueRules.set(issue.ruleKey, {
      severity: (issue.severity as IssueSeverity) ?? IssueSeverity.INFO,
      name: issue.ruleName,
      description: issue.ruleDescription,
    });
  }

  if (!uniqueRules.size) return;

  await (prisma as any).rule.createMany({
    data: Array.from(uniqueRules.entries()).map(([ruleKey, metadata]) => ({
      key: ruleKey,
      analyzerKey,
      name: metadata.name || ruleKey,
      description: metadata.description || '',
      defaultSeverity: metadata.severity,
    })),
    skipDuplicates: true,
  });
}

async function prepareOutDir(analysisId: string, analyzerKey?: string) {
  await fsp.mkdir(outBase, { recursive: true });
  const prefix = analyzerKey ? `${analysisId}-${analyzerKey}-` : `${analysisId}-`;
  return await fsp.mkdtemp(path.join(outBase, prefix));
}

async function downloadAndExtractSource(objectKey: string, analysisId: string, bucket: string = sourcesBucket) {
  const workspaceRoot = path.join('/tmp/workspaces', analysisId);
  await fsp.rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  await fsp.mkdir(workspaceRoot, { recursive: true });

  const zipPath = path.join(workspaceRoot, 'source.zip');

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error('Empty source download');
  }

  await pipeline(response.Body as any, await fsp.open(zipPath, 'w').then((f) => f.createWriteStream()));

  await new Promise((resolve, reject) => {
    const unzipStream = unzipper.Extract({ path: path.join(workspaceRoot, 'repo') });
    unzipStream.on('close', resolve);
    unzipStream.on('error', reject);
    const readStream = fs.createReadStream(zipPath);
    readStream.pipe(unzipStream);
  });

  const repoPath = path.join(workspaceRoot, 'repo');
  const hasFiles = await directoryHasFiles(repoPath);
  if (!hasFiles) {
    throw new Error(`Extracted workspace is empty at ${repoPath}. Source archive may be empty.`);
  }

  return repoPath;
}

async function uploadArtifacts(
  analysisId: string,
  analyzerKey: string,
  outDir: string,
  result: { reportPath?: string; measuresPath?: string; logPath: string },
) {
  const artifacts: Array<{ kind: 'REPORT' | 'MEASURES' | 'LOG'; path?: string; contentType: string }> = [
    { kind: 'REPORT', path: result.reportPath, contentType: 'application/json' },
    { kind: 'MEASURES', path: result.measuresPath, contentType: 'application/json' },
    { kind: 'LOG', path: result.logPath, contentType: 'text/plain' },
  ];

  for (const artifact of artifacts) {
    if (!artifact.path) continue;
    let stat;
    try {
      stat = await fsp.stat(artifact.path);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        logger.warn(
          { analysisId, analyzerKey, kind: artifact.kind, path: artifact.path },
          'Artifact file not found, skipping upload',
        );
        continue;
      }
      throw err;
    }
    const stream = fs.createReadStream(artifact.path);
    const objectKey = path.posix.join('artifacts', analysisId, analyzerKey, path.basename(artifact.path));
    await s3Client.send(
      new PutObjectCommand({
        Bucket: artifactsBucket,
        Key: objectKey,
        Body: stream,
        ContentType: artifact.contentType,
      }),
    );

    await prisma.analysisArtifact.upsert({
      where: {
        analysisId_analyzerKey_kind: {
          analysisId,
          analyzerKey,
          kind: artifact.kind,
        },
      },
      create: {
        analysisId,
        analyzerKey,
        kind: artifact.kind,
        bucket: artifactsBucket,
        objectKey,
        contentType: artifact.contentType,
        size: BigInt(stat.size),
      },
      update: {
        bucket: artifactsBucket,
        objectKey,
        contentType: artifact.contentType,
        size: BigInt(stat.size),
        analyzerKey,
      },
    });
  }
}

async function getActiveAnalyzersForProject(projectKey: string) {
  const project = await prisma.project.findUnique({ where: { key: projectKey } });
  if (!project) {
    throw new Error(`Project ${projectKey} not found`);
  }

  const [analyzers, overrides] = await Promise.all([
    prisma.analyzer.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.projectAnalyzer.findMany({ where: { projectId: project.id } }),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.analyzerId, o]));

  return analyzers
    .map((analyzer) => {
      const override = overrideMap.get(analyzer.id);
      const projectEnabled = override?.enabled ?? null;
      const effectiveEnabled = analyzer.enabled && (projectEnabled ?? true);
      return {
        key: analyzer.key,
        dockerImage: analyzer.dockerImage,
        configJson: override?.configJson ?? null,
        enabled: effectiveEnabled,
      };
    })
    .filter((item) => item.enabled && item.dockerImage);
}

function mergeMetrics(target: Record<string, number>, source: Record<string, number>) {
  for (const [key, value] of Object.entries(source)) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) continue;
    target[key] = (target[key] ?? 0) + num;
  }
}

async function directoryHasFiles(dir: string) {
  const stack: string[] = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      } else if (entry.isFile()) {
        return true;
      }
    }
  }
  return false;
}

async function writeMeasures(outDir: string, metrics: Record<string, number>) {
  const measuresPath = path.join(outDir, 'measures.json');
  await fsp.writeFile(measuresPath, JSON.stringify({ metrics }, null, 2), 'utf8');
  return measuresPath;
}

async function writeReport(outDir: string, report: any) {
  const reportPath = path.join(outDir, 'report.json');
  await fsp.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}

function normalizeIssueMetrics(metrics: Record<string, number>): Record<string, number> {
  const total = metrics.total_issues ?? metrics.issues_total ?? 0;
  const blocker = metrics.blocker_issues ?? metrics.issues_blocker ?? 0;
  const critical = metrics.critical_issues ?? metrics.issues_critical ?? 0;
  const major = metrics.major_issues ?? metrics.issues_major ?? 0;
  const minor = metrics.minor_issues ?? metrics.issues_minor ?? 0;
  const info = metrics.info_issues ?? metrics.issues_info ?? 0;

  return {
    ...metrics,
    // Canonical keys expected by quality gates
    total_issues: total,
    blocker_issues: blocker,
    critical_issues: critical,
    major_issues: major,
    minor_issues: minor,
    info_issues: info,
    // Legacy keys still used by some analyzers
    issues_total: metrics.issues_total ?? total,
    issues_blocker: metrics.issues_blocker ?? blocker,
    issues_critical: metrics.issues_critical ?? critical,
    issues_major: metrics.issues_major ?? major,
    issues_minor: metrics.issues_minor ?? minor,
    issues_info: metrics.issues_info ?? info,
  };
}

function computeMetricsFromIssues(issues: any[]) {
  const metrics = {
    total_issues: issues.length,
    blocker_issues: 0,
    critical_issues: 0,
    major_issues: 0,
    minor_issues: 0,
    info_issues: 0,
    vulnerabilities_total: 0,
  };

  issues.forEach((issue) => {
    if (issue.type === IssueType.VULNERABILITY) {
      metrics.vulnerabilities_total += 1;
    }
    switch (issue.severity) {
      case IssueSeverity.BLOCKER:
        metrics.blocker_issues += 1;
        break;
      case IssueSeverity.CRITICAL:
        metrics.critical_issues += 1;
        break;
      case IssueSeverity.MAJOR:
        metrics.major_issues += 1;
        break;
      case IssueSeverity.MINOR:
        metrics.minor_issues += 1;
        break;
      case IssueSeverity.INFO:
        metrics.info_issues += 1;
        break;
      default:
        break;
    }
  });

  return normalizeIssueMetrics(metrics);
}

async function evaluateQualityGate(analysisId: string): Promise<'PASS' | 'FAIL' | null> {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) return null;

  const gate = await prisma.qualityGate.findFirst({
    where: { projectId: analysis.projectId },
    include: { conditions: true },
  });
  if (!gate) return null;

  const issues = await prisma.issue.findMany({
    where: { analysisId },
    select: { severity: true, type: true, isNew: true },
  });

  const metricsByScope = computeMetricsByScope(issues);
  const results = gate.conditions.map((condition) => evaluateCondition(condition, metricsByScope));

  const status = results.every((r) => r.passed) ? 'PASS' : 'FAIL';
  logger.info({ analysisId, status, results }, 'Quality gate evaluated');
  return status;
}

async function markAnalysisMetrics(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { id: true, projectId: true, branchId: true },
  });
  if (!analysis) return;

  const totalIssues = await prisma.issue.count({ where: { analysisId } });
  const newIssues = await prisma.issue.count({ where: { analysisId, isNew: true } });
  const bySeverity = await prisma.issue.groupBy({
    by: ['severity'],
    where: { analysisId },
    _count: true,
  });
  const newBySeverity = await prisma.issue.groupBy({
    by: ['severity'],
    where: { analysisId, isNew: true },
    _count: true,
  });

  const sevMapAll: Record<string, number> = {
    BLOCKER: 0,
    CRITICAL: 0,
    MAJOR: 0,
    MINOR: 0,
    INFO: 0,
  };
  const sevMapNew: Record<string, number> = { ...sevMapAll };
  bySeverity.forEach((s) => {
    sevMapAll[s.severity] = s._count ?? 0;
  });
  newBySeverity.forEach((s) => {
    sevMapNew[s.severity] = s._count ?? 0;
  });

  const metrics: Array<{ key: string; value: number }> = [
    { key: 'issues_total', value: totalIssues },
    { key: 'issues_new', value: newIssues },
    { key: 'issues_blocker', value: sevMapAll.BLOCKER },
    { key: 'issues_critical', value: sevMapAll.CRITICAL },
    { key: 'issues_major', value: sevMapAll.MAJOR },
    { key: 'issues_minor', value: sevMapAll.MINOR },
    { key: 'issues_info', value: sevMapAll.INFO },
    { key: 'issues_new_blocker', value: sevMapNew.BLOCKER },
    { key: 'issues_new_critical', value: sevMapNew.CRITICAL },
    { key: 'issues_new_major', value: sevMapNew.MAJOR },
    { key: 'issues_new_minor', value: sevMapNew.MINOR },
    { key: 'issues_new_info', value: sevMapNew.INFO },
  ];

  if (!metrics.length) return;

  // Cast prisma to any to avoid typing lag when client is not regenerated yet.
  await (prisma as any).analysisMetric.createMany({
    data: metrics.map((m) => ({
      analysisId: analysis.id,
      projectId: analysis.projectId,
      branchId: analysis.branchId ?? null,
      metricKey: m.key,
      value: m.value,
    })),
  });
}

// Technical Debt calculation constants (matching TechnicalDebtService)
const REMEDIATION_COST: Record<IssueSeverity, number> = {
  INFO: 5,      // 5 minutes
  MINOR: 10,    // 10 minutes
  MAJOR: 20,    // 20 minutes
  CRITICAL: 60, // 1 hour
  BLOCKER: 120, // 2 hours
};

const DEVELOPMENT_COST_PER_LINE = 0.576; // 30 days per 25000 lines

type MaintainabilityRating = 'A' | 'B' | 'C' | 'D' | 'E';

function getMaintainabilityRating(debtRatio: number): MaintainabilityRating {
  if (debtRatio <= 5) return 'A';
  if (debtRatio <= 10) return 'B';
  if (debtRatio <= 20) return 'C';
  if (debtRatio <= 50) return 'D';
  return 'E';
}

async function calculateAndSaveTechnicalDebt(analysisId: string): Promise<void> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: {
      id: true,
      projectId: true,
      branchId: true,
    },
  });

  if (!analysis) return;

  // Get all OPEN issues for this analysis
  const issues = await prisma.issue.findMany({
    where: {
      analysisId,
      status: 'OPEN',
    },
    select: {
      severity: true,
    },
  });

  // Calculate remediation cost (sum of all issue costs)
  const remediationCost = issues.reduce((total, issue) => {
    return total + REMEDIATION_COST[issue.severity];
  }, 0);

  // Get lines of code from metrics if available, otherwise use default
  const locMetric = await (prisma as any).analysisMetric.findFirst({
    where: {
      analysisId,
      metricKey: 'lines_of_code',
    },
  });

  const linesOfCode = locMetric ? Number(locMetric.value) : 10000;

  // Calculate development cost and debt ratio
  const developmentCost = linesOfCode * DEVELOPMENT_COST_PER_LINE;
  const debtRatio = developmentCost > 0 ? (remediationCost / developmentCost) * 100 : 0;
  const roundedDebtRatio = Math.round(debtRatio * 100) / 100;

  // Get maintainability rating
  const rating = getMaintainabilityRating(roundedDebtRatio);

  // Update analysis with technical debt metrics
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      debtRatio: roundedDebtRatio,
      remediationCost,
      maintainabilityRating: rating,
    },
  });

  // Save debt_ratio as a metric for quality gates
  await (prisma as any).analysisMetric.create({
    data: {
      analysisId: analysis.id,
      projectId: analysis.projectId,
      branchId: analysis.branchId ?? null,
      metricKey: 'debt_ratio',
      value: roundedDebtRatio,
    },
  });

  logger.info({
    analysisId,
    debtRatio: roundedDebtRatio,
    rating,
    remediationCost,
    linesOfCode,
  }, 'Technical debt calculated');
}

function computeMetricsByScope(
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
    if (issue.isNew) addIssue(metricsNEW, issue.severity, issue.type);
  });

  return { ALL: metricsALL, NEW: metricsNEW };
}

function evaluateCondition(
  condition: QualityGateCondition,
  metricsByScope: Record<'ALL' | 'NEW', Record<string, number>>,
) {
  const scope = condition.scope ?? QualityGateScope.ALL;
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

  return { metric: condition.metric, operator: condition.operator, threshold, value, scope, passed };
}

function buildFingerprint(
  seed: string,
  issue: { ruleKey: string; filePath: string; message: string; line?: number },
) {
  return createHash('sha256')
    .update([seed, issue.ruleKey, issue.filePath, issue.message, issue.line ?? ''].join('|'))
    .digest('hex');
}

async function sendChatNotificationsForAnalysis(
  analysisId: string,
  payload: AnalysisJobPayload,
  gateStatus: 'PASS' | 'FAIL' | 'UNKNOWN',
) {
  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        project: true,
        branch: true,
      },
    });

    if (!analysis) {
      logger.warn({ analysisId }, 'Analysis not found for chat notifications');
      return;
    }

    const issuesCount = await prisma.issue.count({
      where: { analysisId },
    });

    const newIssuesCount = await prisma.issue.count({
      where: { analysisId, isNew: true },
    });

    const chatPayload = {
      projectName: analysis.project.name,
      projectKey: analysis.project.key,
      branch: payload.branchName || analysis.branch?.name || 'unknown',
      status: (analysis.status === AnalysisStatus.SUCCESS ? 'SUCCESS' : 'FAILED') as 'SUCCESS' | 'FAILED',
      issuesCount,
      newIssuesCount,
      qualityGateStatus: gateStatus,
      url: `${webAppBase}/analyses/${analysisId}`,
      commitSha: payload.commitSha,
    };

    // Send analysis.completed notification
    await sendChatNotifications(prisma, analysis.projectId, 'analysis.completed', chatPayload, logger);

    // Send quality_gate.failed notification if gate failed
    if (gateStatus === 'FAIL') {
      await sendChatNotifications(prisma, analysis.projectId, 'quality_gate.failed', chatPayload, logger);
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), analysisId },
      'Failed to send chat notifications',
    );
  }
}

function getEncryptionKey(envKey: string): Buffer {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const raw = process.env[envKey] ?? (nodeEnv === 'production' ? null : 'default-key-change-in-production-32');
  if (!raw) {
    throw new Error(`${envKey} is required in production`);
  }
  return Buffer.from(raw.padEnd(32, '0').substring(0, 32));
}

const llmEncryptionKey = getEncryptionKey('LLM_PROVIDER_ENCRYPTION_KEY');
const vcsEncryptionKey = getEncryptionKey('VCS_TOKEN_ENCRYPTION_KEY');

function decryptProviderToken(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = createDecipheriv('aes-256-cbc', llmEncryptionKey, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decryptVcsToken(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = createDecipheriv('aes-256-cbc', vcsEncryptionKey, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getEffectiveLlmProvider(projectId: string) {
  const settings = await prisma.projectLlmSettings.findUnique({
    where: { projectId },
    include: { llmProvider: true },
  });

  const providerFromSettings = settings?.llmProvider ?? null;
  const defaultProvider = providerFromSettings
    ? null
    : await prisma.llmProvider.findFirst({
        where: { isDefault: true },
        orderBy: { createdAt: 'desc' },
      });

  const provider = providerFromSettings ?? defaultProvider;
  const overrides =
    settings?.overridesJson && typeof settings.overridesJson === 'object' && !Array.isArray(settings.overridesJson)
      ? (settings.overridesJson as Record<string, number>)
      : null;

  return { provider, overrides };
}

async function getActivePromptTemplate() {
  return prisma.llmPromptTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function findSourceArtifact(analysisId: string, analyzerKey?: string) {
  if (analyzerKey) {
    const scoped = await prisma.analysisArtifact.findFirst({
      where: { analysisId, analyzerKey, kind: 'SOURCE_ZIP' },
      orderBy: { createdAt: 'desc' },
    });
    if (scoped) return scoped;
  }

  return prisma.analysisArtifact.findFirst({
    where: { analysisId, kind: 'SOURCE_ZIP' },
    orderBy: { createdAt: 'desc' },
  });
}

async function buildIssueContext(workspacePath: string, filePath: string, line?: number | null) {
  const absolutePath = path.join(workspacePath, filePath);
  let snippet = '';
  let fullFileContent = '';

  try {
    const content = await fsp.readFile(absolutePath, 'utf8');
    fullFileContent = content;
    snippet = buildSnippet(content, line ?? null).snippet;
  } catch (error) {
    logger.warn({ filePath, workspacePath, error }, 'Failed to read issue file for context');
  }

  return {
    primarySnippet: snippet,
    neighborSnippets: [] as string[],
    relatedFiles: [filePath],
    fullFileContent,
  };
}

function buildSnippet(content: string, line: number | null) {
  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;

  if (totalLines === 0) {
    return { snippet: '', startLine: 1, endLine: 1 };
  }

  const hasLine = typeof line === 'number' && Number.isFinite(line);
  const targetLine = hasLine ? Math.min(Math.max(1, line as number), totalLines) : null;
  const startLine = targetLine ? Math.max(1, targetLine - 15) : 1;
  const endLine = targetLine ? Math.min(totalLines, targetLine + 15) : Math.min(totalLines, 30);
  const snippet = lines.slice(startLine - 1, endLine).join('\n');

  return { snippet, startLine, endLine };
}

function buildLlmPromptInput(
  issue: {
    id: string;
    type: string;
    severity: string;
    message: string;
    filePath: string;
    line: number | null;
    language: string | null;
    analysis: { project: { key: string }; pullRequest: { provider: string; repo: string } | null };
  },
  context: { primarySnippet: string; neighborSnippets: string[]; relatedFiles: string[]; fullFileContent?: string },
) {
  const project: Record<string, string> = { key: issue.analysis.project.key };
  if (issue.analysis.pullRequest?.repo) {
    project.repo = issue.analysis.pullRequest.repo;
    project.provider = issue.analysis.pullRequest.provider;
  }

  return {
    issue: {
      id: issue.id,
      type: issue.type,
      severity: issue.severity,
      message: issue.message,
      filePath: issue.filePath,
      line: issue.line ?? undefined,
      language: issue.language ?? undefined,
    },
    project,
    context,
    constraints: {
      maxFiles: 1,
      noDependencyChanges: true,
      noTestsRequired: true,
      outputFormat: 'full-file-contents',
    },
  };
}

function normalizeLlmFilePath(value: string) {
  let normalized = value.trim();
  if (normalized.startsWith('a/') || normalized.startsWith('b/')) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

function stripJsonFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseLlmOutput(content: unknown) {
  if (typeof content === 'string') {
    return parseLlmOutputJson(stripJsonFences(content));
  }
  return content as any;
}

async function callLlmProvider(options: {
  provider: any;
  systemPrompt: string;
  userPrompt: string;
  overrides: Record<string, number> | null;
}) {
  const { provider, systemPrompt, userPrompt, overrides } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const rawHeaders = provider.headersJson;
  if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
    for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      headers[key] = typeof value === 'string' ? value : String(value);
    }
  }

  if (provider.tokenEncrypted) {
    const token = decryptProviderToken(provider.tokenEncrypted);
    if (!('Authorization' in headers) && !('authorization' in headers)) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const body = {
    model: provider.model ?? undefined,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: overrides?.temperature,
    top_p: overrides?.topP,
    max_tokens: overrides?.maxTokens,
    stream: false,
  };

  const response = await fetch(provider.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status}): ${responseText.slice(0, 200)}`);
  }

  let responseJson: any;
  try {
    responseJson = JSON.parse(responseText);
  } catch (error) {
    throw new Error('LLM response is not valid JSON');
  }

  let content: unknown = responseJson;
  if (responseJson?.choices?.[0]?.message?.content !== undefined) {
    content = responseJson.choices[0].message.content;
  } else if (responseJson?.choices?.[0]?.text !== undefined) {
    content = responseJson.choices[0].text;
  } else if (responseJson?.content !== undefined) {
    content = responseJson.content;
  }

  const usage = responseJson?.usage ?? {};
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? null;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? null;
  const cost = typeof responseJson?.cost === 'number' ? responseJson.cost : null;

  return {
    content,
    inputTokens: typeof inputTokens === 'number' ? inputTokens : null,
    outputTokens: typeof outputTokens === 'number' ? outputTokens : null,
    cost,
  };
}

type LlmVcsContext = {
  provider: VcsProvider;
  repo: string;
  baseBranch: string;
  token: string;
  baseUrl?: string | null;
};

type LlmPullRequestDetails = {
  prNumber: number;
  prUrl: string;
  sourceBranch: string;
  targetBranch: string;
  commitSha: string;
};

async function resolveVcsContext(issue: {
  id: string;
  analysis: {
    pullRequest: {
      provider: PullRequestProvider;
      repo: string;
      sourceBranch: string;
      targetBranch: string;
    } | null;
  };
}, userId?: string): Promise<LlmVcsContext> {
  const pr = issue.analysis.pullRequest;
  if (!pr) {
    throw new Error(`Missing pull request context for issue ${issue.id}`);
  }

  const provider = pr.provider as VcsProvider;
  if (provider !== 'GITHUB' && provider !== 'GITLAB' && provider !== 'BITBUCKET') {
    throw new Error(`Unsupported VCS provider: ${pr.provider}`);
  }

  const envToken = provider === 'GITHUB' ? githubToken : provider === 'BITBUCKET' ? bitbucketToken : gitlabToken;
  const userStored = userId
    ? await prisma.vcsToken.findFirst({ where: { provider, userId } })
    : null;
  const globalStored = await prisma.vcsToken.findFirst({ where: { provider, userId: null } });
  const storedToken = userStored?.tokenEncrypted
    ? decryptVcsToken(userStored.tokenEncrypted)
    : globalStored?.tokenEncrypted
      ? decryptVcsToken(globalStored.tokenEncrypted)
      : null;
  const tokenSource = userStored?.tokenEncrypted
    ? 'user'
    : globalStored?.tokenEncrypted
      ? 'global'
      : envToken
        ? 'env'
        : 'none';
  const baseUrl = userStored?.baseUrl ?? globalStored?.baseUrl ?? null;
  const token = storedToken || envToken;
  if (!token) {
    throw new Error(`Missing ${provider} token for VCS operations`);
  }

  const stored = userStored ?? globalStored;
  if (stored && storedToken) {
    prisma.vcsToken
      .update({
        where: { id: stored.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);
  }

  const baseBranch = pr.targetBranch || pr.sourceBranch;
  if (!baseBranch) {
    throw new Error('Missing base branch for VCS operations');
  }

  logger.info(
    {
      issueId: issue.id,
      provider,
      repo: pr.repo,
      baseBranch,
      tokenSource,
      gitlabBaseUrl: provider === 'GITLAB' ? (baseUrl ?? gitlabBaseUrl) : undefined,
      githubBaseUrl: provider === 'GITHUB' ? baseUrl ?? undefined : undefined,
      bitbucketBaseUrl: provider === 'BITBUCKET' ? baseUrl ?? undefined : undefined,
    },
    'Resolved VCS context for LLM PR',
  );

  return {
    provider,
    repo: pr.repo,
    baseBranch,
    token,
    baseUrl,
  };
}

function buildLlmPullRequestTitle(issueId: string) {
  return `Fix issue ${issueId}`;
}

function buildLlmPullRequestBody(summary: string | null, issueId: string) {
  const trimmedSummary = summary?.trim();
  const summaryText =
    trimmedSummary && trimmedSummary.length > 0
      ? trimmedSummary
      : `Automated fix for issue ${issueId}.`;
  return `${summaryText}\n\nTests: not run (CI in pipeline)`;
}

async function createLlmPullRequest(options: {
  issueId: string;
  llmRunId: string;
  provider: VcsProvider;
  repo: string;
  baseBranch: string;
  token: string;
  baseUrl?: string | null;
  files: { path: string; content: string }[];
  summary: string | null;
}): Promise<LlmPullRequestDetails> {
  const client = createVcsClient(options.provider, options.token, {
    gitlabBaseUrl: options.provider === 'GITLAB' ? options.baseUrl ?? gitlabBaseUrl : undefined,
    githubBaseUrl: options.provider === 'GITHUB' ? options.baseUrl ?? undefined : undefined,
    bitbucketBaseUrl: options.provider === 'BITBUCKET' ? options.baseUrl ?? undefined : undefined,
  });
  const title = buildLlmPullRequestTitle(options.issueId);
  const summaryText = typeof options.summary === 'string' ? options.summary : null;
  const body = buildLlmPullRequestBody(summaryText, options.issueId);
  const branchName = `llm/issue-${options.issueId}-${options.llmRunId.slice(0, 8)}`;

  try {
    await client.createBranch({
      repo: options.repo,
      branch: branchName,
      baseBranch: options.baseBranch,
    });

    const commitSha = await client.commitFiles({
      repo: options.repo,
      branch: branchName,
      message: title,
      files: options.files,
    });

    const pr = await client.createPullRequest({
      repo: options.repo,
      sourceBranch: branchName,
      targetBranch: options.baseBranch,
      title,
      body,
    });

    return {
      prNumber: pr.number,
      prUrl: pr.url,
      sourceBranch: branchName,
      targetBranch: options.baseBranch,
      commitSha,
    };
  } catch (error: any) {
    logger.error(
      {
        issueId: options.issueId,
        llmRunId: options.llmRunId,
        provider: options.provider,
        repo: options.repo,
        baseBranch: options.baseBranch,
        gitlabBaseUrl: options.provider === 'GITLAB' ? (options.baseUrl ?? gitlabBaseUrl) : undefined,
        githubBaseUrl: options.provider === 'GITHUB' ? options.baseUrl ?? undefined : undefined,
        bitbucketBaseUrl: options.provider === 'BITBUCKET' ? options.baseUrl ?? undefined : undefined,
        error: error instanceof Error ? error.message : String(error),
      },
      'LLM PR creation failed',
    );
    throw error;
  }
}
