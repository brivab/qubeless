import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

type JsonObject = {
  [key: string]: JsonValue;
};

type SeedFeatureDataOptions = {
  apiUrl?: string;
  adminEmail?: string;
  adminPassword?: string;
  force?: boolean;
};

type SeedFeatureDataResult = {
  projectKey: string;
  projectName: string;
  analyzerKey: string;
  llmProviderName: string;
  llmPromptName: string;
  analysisId: string | null;
  issueId: string | null;
};

type ApiRequestOptions = {
  apiUrl: string;
  token?: string;
  body?: JsonObject | FormData;
};

type ApiLoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    globalRole: string;
  };
};

type AdminAuthResult = {
  token: string;
  user: ApiLoginResponse['user'];
};

type ApiCreateAnalysisResponse = {
  analysisId: string;
  statusUrl: string;
  gateUrl: string;
};

type ApiAnalysis = {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
};

type ApiIssue = {
  id: string;
};

type ApiOrganization = {
  id: string;
  name: string;
  slug: string;
};

const authCache = new Map<string, AdminAuthResult>();
const seedCache = new Map<string, SeedFeatureDataResult>();
const seedCacheFile = path.join(os.tmpdir(), 'qubeless-cypress-seed-cache.json');
let resolvedApiUrlCache: string | null = null;

function normalizeApiUrl(rawUrl: string) {
  const trimmed = rawUrl.replace(/\/$/, '');
  if (trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function createUniqueId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createRandomSha() {
  return Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonOrText(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
}

async function apiRequest<T>(
  method: string,
  path: string,
  options: ApiRequestOptions,
): Promise<T> {
  const url = `${options.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    if (isFormData) {
      body = options.body as unknown as BodyInit;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body as JsonObject);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    throw new Error(`${method} ${path} failed before HTTP response (${url}): ${message}`);
  }

  const payload = await readJsonOrText(response);
  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed with status ${response.status}: ${
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      }`,
    );
  }

  return payload as T;
}

function loadSeedFileCache(): Record<string, SeedFeatureDataResult> {
  if (!fs.existsSync(seedCacheFile)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(seedCacheFile, 'utf8');
    if (!raw.trim()) {
      return {};
    }
    return JSON.parse(raw) as Record<string, SeedFeatureDataResult>;
  } catch {
    return {};
  }
}

function saveSeedFileCache(cache: Record<string, SeedFeatureDataResult>) {
  try {
    fs.writeFileSync(seedCacheFile, JSON.stringify(cache), 'utf8');
  } catch {
    // Non-blocking: keep in-memory cache even if file write fails.
  }
}

function toPayloadText(payload: JsonValue | string | null) {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload === null) {
    return 'null';
  }
  return JSON.stringify(payload);
}

function buildCacheKey(apiUrl: string, adminEmail: string) {
  return `${apiUrl}::${adminEmail}`;
}

function findComposeFilePath() {
  const explicitPath = process.env.CYPRESS_DOCKER_COMPOSE_FILE;
  const candidates = [
    explicitPath ?? '',
    path.resolve(process.cwd(), 'docker-compose.dev.yml'),
    path.resolve(process.cwd(), '../docker-compose.dev.yml'),
    path.resolve(process.cwd(), '../../docker-compose.dev.yml'),
    path.resolve(process.cwd(), '../../../docker-compose.dev.yml'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Cannot find docker-compose.dev.yml for Cypress SQL purge');
}

async function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `Command failed (${command} ${args.join(' ')}), exit=${code}\n${stderr || stdout}`,
        ),
      );
    });
  });
}

async function resolveReachableApiUrl(preferred?: string): Promise<string> {
  if (resolvedApiUrlCache) {
    return resolvedApiUrlCache;
  }

  const candidates = unique([
    preferred ?? '',
    process.env.CYPRESS_API_URL ?? '',
    process.env.VITE_API_URL ?? '',
    'http://localhost:3001/api',
    'http://127.0.0.1:3001/api',
    'http://host.docker.internal:3001/api',
  ]).map(normalizeApiUrl);

  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(`${candidate}/health`, { method: 'GET' }, 2500);
      if (response.ok || response.status === 503) {
        resolvedApiUrlCache = candidate;
        return candidate;
      }
      errors.push(`${candidate} -> HTTP ${response.status}`);
    } catch (error: any) {
      errors.push(`${candidate} -> ${error?.message ?? String(error)}`);
    }
  }

  throw new Error(`No reachable API URL. Tried: ${errors.join(' | ')}`);
}

async function loginAdminWithRetry(
  apiUrl: string,
  adminEmail: string,
  adminPassword: string,
): Promise<AdminAuthResult> {
  const cacheKey = buildCacheKey(apiUrl, adminEmail);
  const cached = authCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let waitMs = 1200;
  let lastError = 'Unknown error';

  for (let attempt = 1; attempt <= 7; attempt += 1) {
    let response: Response;
    let payload: JsonValue | string | null = null;
    try {
      response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      });
      payload = await readJsonOrText(response);
    } catch (error: any) {
      lastError = `network_error ${error?.message ?? String(error)}`;
      if (attempt < 7) {
        await sleep(waitMs);
        waitMs = Math.min(waitMs * 2, 8000);
        continue;
      }
      throw new Error(`POST /auth/login failed after retries: ${lastError}`);
    }

    if (response.ok && payload && typeof payload === 'object' && 'accessToken' in payload) {
      const login = payload as unknown as ApiLoginResponse;
      const result: AdminAuthResult = {
        token: login.accessToken,
        user: login.user,
      };
      authCache.set(cacheKey, result);
      return result;
    }

    lastError = `${response.status} ${toPayloadText(payload as JsonValue | string | null)}`;
    if (response.status === 429 && attempt < 7) {
      await sleep(waitMs);
      waitMs = Math.min(waitMs * 2, 8000);
      continue;
    }

    throw new Error(`POST /auth/login failed with status ${lastError}`);
  }

  throw new Error(`POST /auth/login failed after retries: ${lastError}`);
}

async function waitForAnalysisCompletion(
  apiUrl: string,
  token: string,
  analysisId: string,
): Promise<ApiAnalysis> {
  let current: ApiAnalysis | null = null;

  for (let i = 0; i < 20; i += 1) {
    current = await apiRequest<ApiAnalysis>('GET', `/analyses/${encodeURIComponent(analysisId)}`, {
      apiUrl,
      token,
    });

    if (current.status === 'SUCCESS' || current.status === 'FAILED') {
      return current;
    }

    await sleep(1000);
  }

  if (!current) {
    throw new Error('Could not read analysis status during seeding');
  }

  return current;
}

async function ensureOrganizationId(
  apiUrl: string,
  token: string,
  seedId: string,
): Promise<string> {
  const organizations = await apiRequest<ApiOrganization[]>('GET', '/organizations', {
    apiUrl,
    token,
  });

  if (organizations.length > 0 && organizations[0]?.id) {
    return organizations[0].id;
  }

  const slug = `cypress-e2e-${seedId}`.slice(0, 50);
  const created = await apiRequest<ApiOrganization>('POST', '/organizations', {
    apiUrl,
    token,
    body: {
      name: `Cypress E2E ${seedId}`.slice(0, 100),
      slug,
      description: 'Organization generated by Cypress seed task',
    },
  });

  return created.id;
}

function isMissingRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('status 404') || message.includes('status 405');
}

async function upsertVcsTokenForSeed(
  apiUrl: string,
  token: string,
  seedId: string,
) {
  const body = {
    provider: 'GITHUB',
    token: `ghp_e2e_${seedId.replace(/-/g, '')}`,
    baseUrl: null,
  };
  const attempts: Array<{ method: string; path: string }> = [
    { method: 'PUT', path: '/vcs-tokens' },
    { method: 'POST', path: '/vcs-tokens' },
    { method: 'POST', path: '/admin/vcs-tokens' },
  ];

  let lastError: unknown = null;

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      await apiRequest(attempt.method, attempt.path, {
        apiUrl,
        token,
        body,
      });
      return;
    } catch (error) {
      lastError = error;
      const isLastAttempt = i === attempts.length - 1;
      if (!isMissingRouteError(error) || isLastAttempt) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
}

export async function seedFeatureData(
  options: SeedFeatureDataOptions = {},
): Promise<SeedFeatureDataResult> {
  const apiUrl = await resolveReachableApiUrl(options.apiUrl);
  const adminEmail = options.adminEmail ?? process.env.CYPRESS_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = options.adminPassword ?? process.env.CYPRESS_ADMIN_PASSWORD ?? 'admin123';
  const cacheKey = buildCacheKey(apiUrl, adminEmail);
  if (!options.force) {
    const cachedSeed = seedCache.get(cacheKey);
    if (cachedSeed) {
      return cachedSeed;
    }
    const fileCache = loadSeedFileCache();
    const fileCachedSeed = fileCache[cacheKey];
    if (fileCachedSeed) {
      seedCache.set(cacheKey, fileCachedSeed);
      return fileCachedSeed;
    }
  }
  const seedId = createUniqueId();
  const projectKey = `e2e-web-${seedId}`;
  const projectName = `E2E Web ${seedId}`;
  const analyzerKey = `e2e-analyzer-${seedId}`;
  const analyzerName = `E2E Analyzer ${seedId}`;
  const llmProviderName = `E2E Provider ${seedId}`;
  const llmPromptName = `e2e-prompt-${seedId}`;

  const auth = await loginAdminWithRetry(apiUrl, adminEmail, adminPassword);
  const token = auth.token;
  const organizationId = await ensureOrganizationId(apiUrl, token, seedId);

  await apiRequest('POST', '/analyzers', {
    apiUrl,
    token,
    body: {
      key: analyzerKey,
      name: analyzerName,
      dockerImage: 'qubeless/analyzer-eslint:latest',
      enabled: true,
    },
  });

  await apiRequest('POST', '/projects', {
    apiUrl,
    token,
    body: {
      key: projectKey,
      name: projectName,
      description: 'Project generated by Cypress seed task',
      organizationId,
    },
  });

  await apiRequest('PUT', `/projects/${encodeURIComponent(projectKey)}/analyzers/${encodeURIComponent(analyzerKey)}`, {
    apiUrl,
    token,
    body: {
      enabled: true,
      configJson: {
        sample: true,
      },
    },
  });

  await apiRequest('PUT', `/projects/${encodeURIComponent(projectKey)}/quality-gate`, {
    apiUrl,
    token,
    body: {
      name: `E2E Gate ${seedId}`,
      conditions: [
        {
          metric: 'issues_critical',
          operator: 'GT',
          threshold: 0,
          scope: 'ALL',
        },
      ],
    },
  });

  await apiRequest('POST', '/admin/llm-providers', {
    apiUrl,
    token,
    body: {
      name: llmProviderName,
      providerType: 'openai',
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o-mini',
      token: `sk-e2e-${seedId}`,
      headersJson: null,
      isDefault: true,
    },
  });

  await apiRequest('POST', '/admin/llm-prompts', {
    apiUrl,
    token,
    body: {
      name: llmPromptName,
      version: 'v1',
      systemPrompt: 'You are a careful code remediation assistant.',
      taskPrompt: 'Propose the safest fix and provide a concise rationale.',
      isActive: true,
    },
  });

  await upsertVcsTokenForSeed(apiUrl, token, seedId);

  let finalAnalysis: ApiAnalysis | null = null;
  let firstIssueId: string | null = null;

  try {
    const analysisCreate = await apiRequest<ApiCreateAnalysisResponse>(
      'POST',
      `/projects/${encodeURIComponent(projectKey)}/analyses`,
      {
        apiUrl,
        token,
        body: {
          commitSha: createRandomSha(),
          branch: 'main',
        },
      },
    );

    finalAnalysis = await waitForAnalysisCompletion(apiUrl, token, analysisCreate.analysisId);
    const issues = await apiRequest<ApiIssue[]>(
      'GET',
      `/analyses/${encodeURIComponent(analysisCreate.analysisId)}/issues`,
      { apiUrl, token },
    );
    firstIssueId = issues[0]?.id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Keep seed resilient when analysis execution infrastructure is not available in local environments.
    console.warn(`[cypress-seed] Analysis bootstrap skipped: ${message}`);
  }

  const result: SeedFeatureDataResult = {
    projectKey,
    projectName,
    analyzerKey,
    llmProviderName,
    llmPromptName,
    analysisId: finalAnalysis?.id ?? null,
    issueId: firstIssueId,
  };
  seedCache.set(cacheKey, result);
  const fileCache = loadSeedFileCache();
  fileCache[cacheKey] = result;
  saveSeedFileCache(fileCache);
  return result;
}

export async function getAdminAuth(options: SeedFeatureDataOptions = {}): Promise<AdminAuthResult> {
  const apiUrl = await resolveReachableApiUrl(options.apiUrl);
  const adminEmail = options.adminEmail ?? process.env.CYPRESS_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = options.adminPassword ?? process.env.CYPRESS_ADMIN_PASSWORD ?? 'admin123';
  return loginAdminWithRetry(apiUrl, adminEmail, adminPassword);
}

export async function purgeCypressSqlData() {
  const composeFile = findComposeFilePath();
  const composeDir = path.dirname(composeFile);
  const dbService = process.env.CYPRESS_PURGE_DB_SERVICE ?? 'postgres';
  const dbUser = process.env.CYPRESS_PURGE_DB_USER ?? 'postgres';
  const dbName = process.env.CYPRESS_PURGE_DB_NAME ?? 'qubeless';
  const purgeSql = `
BEGIN;
WITH del_projects AS (
  DELETE FROM "Project"
  WHERE key LIKE 'e2e-web-%'
  RETURNING id
),
del_analyzers AS (
  DELETE FROM "Analyzer"
  WHERE key LIKE 'e2e-analyzer-%'
  RETURNING id
),
del_quality_gates AS (
  DELETE FROM "QualityGate"
  WHERE name LIKE 'E2E Gate %'
  RETURNING id
),
del_llm_providers AS (
  DELETE FROM "LlmProvider"
  WHERE name LIKE 'E2E Provider %'
  RETURNING id
),
del_llm_prompts AS (
  DELETE FROM "LlmPromptTemplate"
  WHERE name LIKE 'e2e-prompt-%'
  RETURNING id
),
del_organizations AS (
  DELETE FROM "Organization"
  WHERE slug LIKE 'cypress-e2e-%'
  RETURNING id
)
SELECT 'deleted_projects' AS item, (SELECT count(*)::int FROM del_projects) AS n
UNION ALL SELECT 'deleted_analyzers', (SELECT count(*)::int FROM del_analyzers)
UNION ALL SELECT 'deleted_quality_gates', (SELECT count(*)::int FROM del_quality_gates)
UNION ALL SELECT 'deleted_llm_providers', (SELECT count(*)::int FROM del_llm_providers)
UNION ALL SELECT 'deleted_llm_prompts', (SELECT count(*)::int FROM del_llm_prompts)
UNION ALL SELECT 'deleted_organizations', (SELECT count(*)::int FROM del_organizations);
COMMIT;
`.trim();

  const { stdout, stderr } = await runCommand(
    'docker',
    [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      dbService,
      'psql',
      '-U',
      dbUser,
      '-d',
      dbName,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      purgeSql,
    ],
    composeDir,
  );

  if (stderr.trim()) {
    console.log(`[cypress-purge] ${stderr.trim()}`);
  }
  return stdout.trim();
}
