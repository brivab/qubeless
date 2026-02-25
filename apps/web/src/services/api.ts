import { useAuthStore, AUTH_STORAGE_KEY } from '../stores/auth';

const RAW_API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '');
// Normalize to always have exactly one "/api" segment, avoiding "/api/api"
const API_URL = `${RAW_API_BASE.replace(/\/api$/, '')}/api`;

export type AnalysisStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type IssueSeverity = 'INFO' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER';
export type IssueType = 'BUG' | 'CODE_SMELL' | 'VULNERABILITY';
export type IssueStatus = 'OPEN' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK' | 'RESOLVED';
export type LlmRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type QualityGateOperator = 'GT' | 'LT' | 'EQ';
export type QualityGateScope = 'ALL' | 'NEW';
export type ArtifactKind = 'REPORT' | 'MEASURES' | 'LOG' | 'SOURCE_ZIP';
export type SsoProviderId = 'oidc' | 'saml';
export type ProjectRole = 'PROJECT_ADMIN' | 'PROJECT_MAINTAINER' | 'PROJECT_VIEWER';

export interface SsoProviderInfo {
  id: SsoProviderId;
  label: string;
  loginUrl: string;
}

export interface Branch {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  createdAt: string;
  branches?: Branch[];
}

export interface Analysis {
  id: string;
  projectId: string;
  branchId: string;
  commitSha: string;
  status: AnalysisStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  branch?: Branch;
  project?: Project;
}

export interface Issue {
  id: string;
  analysisId: string;
  analyzerKey: string;
  ruleKey: string;
  severity: IssueSeverity;
  type: IssueType;
  status: IssueStatus;
  filePath: string;
  line?: number | null;
  message: string;
  fingerprint: string;
  createdAt: string;
  isNew?: boolean;
}

export interface PullRequest {
  id: string;
  projectId: string;
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
  repo: string;
  prNumber: number;
  sourceBranch: string;
  targetBranch: string;
  commitSha: string;
  url?: string | null;
  createdAt: string;
}

export interface LlmRun {
  id: string;
  issueId: string;
  projectId: string;
  providerId?: string | null;
  pullRequestId?: string | null;
  status: LlmRunStatus;
  promptVersion?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cost?: number | string | null;
  outputPatch?: string | null;
  outputSummary?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  pullRequest?: PullRequest | null;
}

export interface IssueLlmRunsResponse {
  issueId: string;
  runs: LlmRun[];
}

export interface IssueCodeResponse {
  issueId: string;
  analysisId: string;
  filePath: string;
  line?: number | null;
  startLine?: number | null;
  endLine?: number | null;
  language?: string | null;
  snippet: string;
  fileExists: boolean;
}

export interface QualityGateConditionResult {
  metric: string;
  operator: QualityGateOperator;
  threshold: number;
  value: number;
  passed: boolean;
  scope?: QualityGateScope;
}

export interface QualityGateStatusResponse {
  status: 'PASS' | 'FAIL';
  gate: { id: string; name: string };
  conditions: QualityGateConditionResult[];
  metrics: Record<string, number>;
  metricsNew?: Record<string, number>;
}

export interface QualityGateCondition {
  id: string;
  metric: string;
  operator: QualityGateOperator;
  threshold: number;
  scope: QualityGateScope;
}

export interface QualityGate {
  id: string;
  name: string;
  projectId: string;
  conditions: QualityGateCondition[];
}

export interface QualityGateConditionInput {
  metric: string;
  operator: QualityGateOperator;
  threshold: number;
  scope?: QualityGateScope;
}

export interface QualityGateUpsertPayload {
  name: string;
  conditions?: QualityGateConditionInput[];
}

export interface AnalysisArtifact {
  id: string;
  analysisId: string;
  analyzerKey: string;
  kind: ArtifactKind;
  bucket: string;
  objectKey: string;
  contentType: string;
  size: number | string;
  createdAt: string;
}

export interface Analyzer {
  id: string;
  key: string;
  name: string;
  dockerImage: string;
  enabled: boolean;
  createdAt: string;
}

export interface ProjectAnalyzerStatus {
  analyzer: Analyzer;
  projectEnabled: boolean | null;
  effectiveEnabled: boolean;
  configJson?: Record<string, unknown> | null;
}

export interface RuleProfile {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
}

export interface Rule {
  key: string;
  analyzerKey: string;
  name: string;
  description: string;
  defaultSeverity: IssueSeverity;
}

export interface RuleWithState extends Rule {
  enabled: boolean;
}

export interface ApiToken {
  id: string;
  name: string;
  projectId?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  token?: string; // only returned on creation
}

export interface VcsToken {
  id: string;
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  tokenMasked?: string | null;
  hasToken?: boolean;
  baseUrl?: string | null;
}

export interface LlmProvider {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  model?: string | null;
  headersJson?: Record<string, any> | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  tokenMasked?: string | null;
  hasToken?: boolean;
}

export interface LlmPromptTemplate {
  id: string;
  name: string;
  version: string;
  systemPrompt: string;
  taskPrompt: string;
  createdAt: string;
  isActive: boolean;
}

export interface LlmProviderSummary {
  id: string;
  name: string;
  providerType: string;
  model?: string | null;
  isDefault: boolean;
}

export interface ProjectLlmOverrides {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface ProjectLlmSettings {
  projectKey: string;
  provider: LlmProviderSummary | null;
  selectedProviderId: string | null;
  overrides: ProjectLlmOverrides | null;
  source: 'project' | 'default' | 'none';
  providers: LlmProviderSummary[];
}

export interface LlmProviderTestResult {
  success: boolean;
  status: number;
}

export type CoverageFormat = 'LCOV' | 'COBERTURA' | 'JACOCO';

export interface FileCoverage {
  filePath: string;
  lines: number;
  coveredLines: number;
  branches: number;
  coveredBranches: number;
  lineHits?: Record<string, number>;
  coveragePercent?: number;
}

export interface CoverageReport {
  id: number;
  analysisId: string;
  format: CoverageFormat;
  totalLines: number;
  coveredLines: number;
  totalBranches: number;
  coveredBranches: number;
  coveragePercent: number;
  createdAt: string;
  files: FileCoverage[];
}

export interface CoverageTrendPoint {
  analysisId: string;
  coveragePercent: number;
  date: string;
}

export interface DuplicationBlock {
  id: number;
  analysisId: string;
  file1Path: string;
  file1StartLine: number;
  file1EndLine: number;
  file2Path: string;
  file2StartLine: number;
  file2EndLine: number;
  lines: number;
  tokens: number;
  fingerprint: string;
  createdAt: string;
}

export interface DuplicationStats {
  duplicationPercent: number;
  duplicationBlocks: number;
  duplicatedLines: number;
  totalSources: number;
  totalClones: number;
  blocks?: DuplicationBlock[];
}

export function getAnalyzers() {
  return apiFetch<Analyzer[]>('/analyzers');
}

export function createAnalyzer(payload: {
  key: string;
  name: string;
  dockerImage: string;
  enabled?: boolean;
}) {
  return apiFetch<Analyzer>('/analyzers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAnalyzer(
  key: string,
  payload: { name?: string; dockerImage?: string; enabled?: boolean },
) {
  return apiFetch<Analyzer>(`/analyzers/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteAnalyzer(key: string) {
  return apiFetch<void>(`/analyzers/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}

export function getSsoProviders() {
  return apiFetch<SsoProviderInfo[]>('/auth/sso/providers');
}

export interface LdapLoginRequest {
  username: string;
  password: string;
  mfaCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: any;
}

export function loginWithLdap(credentials: LdapLoginRequest) {
  return apiFetch<LoginResponse>('/auth/login/ldap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

export function checkLdapEnabled() {
  return apiFetch<{ enabled: boolean }>('/auth/ldap/enabled');
}

export interface MfaStatusResponse {
  enabled: boolean;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export function getMfaStatus() {
  return apiFetch<MfaStatusResponse>('/auth/mfa/status');
}

export function setupMfa() {
  return apiFetch<MfaSetupResponse>('/auth/mfa/setup', { method: 'POST' });
}

export function confirmMfa(code: string) {
  return apiFetch<MfaStatusResponse>('/auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ code }) });
}

export function disableMfa(code: string) {
  return apiFetch<MfaStatusResponse>('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) });
}

function resolveToken(): string | null {
  // Prefer the store if it is available; fallback to localStorage for SSR/early calls.
  try {
    const store = useAuthStore();
    if (store?.token) return store.token;
  } catch {
    // Pinia not active yet
  }

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

function normalizeApiPath(path: string): string {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  if (withLeadingSlash === '/api') {
    return '/';
  }
  if (withLeadingSlash.startsWith('/api/')) {
    return withLeadingSlash.slice(4);
  }
  return withLeadingSlash;
}

function buildApiUrl(path: string) {
  return `${API_URL}${normalizeApiPath(path)}`;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const hasBody = options.body !== undefined;
  if (!isFormData && hasBody) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const token = resolveToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // force no-cache to avoid stale data in dev/prod caches
  const url = buildApiUrl(path);
  console.log('[api] request', { url, method: options.method ?? 'GET' });
  const response = await fetch(url, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text();
    console.error('[api] error', { url, status: response.status, body: text });
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  const json = (await response.json()) as T;
  console.log('[api] response', { url, status: response.status, data: json });
  return json;
}

export function getProjects(language?: string) {
  const params = new URLSearchParams();
  if (language) {
    params.set('language', language);
  }
  const queryString = params.toString();
  return apiFetch<Project[]>(`/projects${queryString ? '?' + queryString : ''}`);
}

export function getProject(key: string) {
  return apiFetch<Project>(`/projects/${encodeURIComponent(key)}`);
}

export function getAnalysesByProject(key: string, branch?: string) {
  const search = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return apiFetch<Analysis[]>(`/projects/${encodeURIComponent(key)}/analyses${search}`);
}

export function getAnalysis(id: string) {
  return apiFetch<Analysis>(`/analyses/${encodeURIComponent(id)}`);
}

export function getIssues(
  analysisId: string,
  params?: { severity?: IssueSeverity; type?: IssueType; language?: string; filePath?: string; onlyNew?: boolean },
) {
  const search = new URLSearchParams();
  if (params?.severity) search.set('severity', params.severity);
  if (params?.type) search.set('type', params.type);
  if (params?.language) search.set('language', params.language);
  if (params?.filePath) search.set('filePath', params.filePath);
  if ((params as any)?.onlyNew) search.set('onlyNew', 'true');

  const query = search.toString();
  const path = `/analyses/${encodeURIComponent(analysisId)}/issues${query ? `?${query}` : ''}`;
  return apiFetch<Issue[]>(path);
}

export function getIssueCode(issueId: string, options: { full?: boolean } = {}) {
  const search = new URLSearchParams();
  if (options.full) {
    search.set('full', 'true');
  }
  const query = search.toString();
  return apiFetch<IssueCodeResponse>(`/issues/${encodeURIComponent(issueId)}/code${query ? `?${query}` : ''}`);
}

export function getQualityGateStatus(analysisId: string) {
  return apiFetch<QualityGateStatusResponse>(`/analyses/${encodeURIComponent(analysisId)}/quality-gate-status`);
}

export function getProjectQualityGate(projectKey: string) {
  return apiFetch<QualityGate>(`/projects/${encodeURIComponent(projectKey)}/quality-gate`);
}

export function upsertProjectQualityGate(projectKey: string, payload: QualityGateUpsertPayload) {
  return apiFetch<QualityGate>(`/projects/${encodeURIComponent(projectKey)}/quality-gate`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export interface AnalysisSummary {
  totalIssues: number;
  newIssues: number;
  bySeverity: Record<string, number>;
  newBySeverity: Record<string, number>;
  byType: Record<string, number>;
  newByType: Record<string, number>;
}

export function getAnalysisSummary(analysisId: string) {
  return apiFetch<AnalysisSummary>(`/analyses/${encodeURIComponent(analysisId)}/summary`);
}

export type MaintainabilityRating = 'A' | 'B' | 'C' | 'D' | 'E';

export interface TechnicalDebt {
  analysisId: string;
  debtRatio: number | null;
  remediationCost: number | null;
  formattedRemediationTime: string;
  maintainabilityRating: MaintainabilityRating | null;
}

export function getTechnicalDebt(analysisId: string) {
  return apiFetch<TechnicalDebt>(`/analyses/${encodeURIComponent(analysisId)}/debt`);
}

export function getCoverage(analysisId: string) {
  return apiFetch<CoverageReport>(`/analyses/${encodeURIComponent(analysisId)}/coverage`);
}

export function getCoverageTrend(projectKey: string, branch?: string, limit?: number) {
  const params = new URLSearchParams();
  if (branch) params.append('branch', branch);
  if (limit) params.append('limit', limit.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<CoverageTrendPoint[]>(`/projects/${encodeURIComponent(projectKey)}/coverage/trend${query}`);
}

export function getFileCoverage(analysisId: string, filePath: string) {
  return apiFetch<FileCoverage>(`/analyses/${encodeURIComponent(analysisId)}/coverage/file?path=${encodeURIComponent(filePath)}`);
}

export function getDuplication(analysisId: string) {
  return apiFetch<DuplicationStats>(`/analyses/${encodeURIComponent(analysisId)}/duplication`);
}

export function getDuplicationBlocks(analysisId: string) {
  return apiFetch<DuplicationBlock[]>(`/analyses/${encodeURIComponent(analysisId)}/duplication/blocks`);
}

export function createAnalysis(projectKey: string, payload: {
  commitSha: string;
  branch: string;
  analyzerIds?: string[];
}) {
  return apiFetch<{ analysisId: string; statusUrl: string; gateUrl: string }>(`/projects/${encodeURIComponent(projectKey)}/analyses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createAnalysisWithZip(projectKey: string, payload: { commitSha: string; branch?: string; sourceZip: File }) {
  const form = new FormData();
  form.append('commitSha', payload.commitSha);
  if (payload.branch) form.append('branch', payload.branch);
  form.append('sourceZip', payload.sourceZip);
  return apiFetch<Analysis>(`/projects/${encodeURIComponent(projectKey)}/analyses`, {
    method: 'POST',
    body: form,
  });
}

export function getArtifacts(analysisId: string) {
  return apiFetch<AnalysisArtifact[]>(`/analyses/${encodeURIComponent(analysisId)}/artifacts`);
}

async function fetchArtifactResponse(analysisId: string, kind: ArtifactKind, analyzerKey?: string) {
  const token = resolveToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params = new URLSearchParams();
  if (analyzerKey) params.set('analyzerKey', analyzerKey);
  const query = params.toString() ? `?${params.toString()}` : '';
  const url = buildApiUrl(
    `/analyses/${encodeURIComponent(analysisId)}/artifacts/${encodeURIComponent(kind)}/download${query}`,
  );
  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[api] artifact download error', { url, status: response.status, body: text });
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response;
}

function extractFilename(response: Response, fallback: string) {
  const disposition = response.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

export async function downloadArtifact(analysisId: string, kind: ArtifactKind, analyzerKey?: string) {
  const response = await fetchArtifactResponse(analysisId, kind, analyzerKey);
  const blob = await response.blob();
  const filename = extractFilename(response, `${kind.toLowerCase()}-${analysisId}`);
  return { blob, filename };
}

export async function getArtifactText(analysisId: string, kind: ArtifactKind, analyzerKey?: string) {
  const response = await fetchArtifactResponse(analysisId, kind, analyzerKey);
  const text = await response.text();
  const filename = extractFilename(response, `${kind.toLowerCase()}-${analysisId}`);
  return { text, filename };
}

export function getProjectAnalyzers(projectKey: string) {
  return apiFetch<ProjectAnalyzerStatus[]>(`/projects/${encodeURIComponent(projectKey)}/analyzers`);
}

export function updateProjectAnalyzer(
  projectKey: string,
  analyzerKey: string,
  payload: { enabled: boolean; configJson?: Record<string, unknown> | null },
) {
  return apiFetch<ProjectAnalyzerStatus>(`/projects/${encodeURIComponent(projectKey)}/analyzers/${encodeURIComponent(analyzerKey)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function detectProjectLanguages(projectKey: string) {
  return apiFetch<DetectLanguagesResponse>(
    `/projects/${encodeURIComponent(projectKey)}/detect-languages`
  );
}

export function getProjectRuleProfile(projectKey: string) {
  return apiFetch<RuleProfile>(`/projects/${encodeURIComponent(projectKey)}/rule-profile`);
}

export function getProjectRules(projectKey: string, params?: { analyzerKey?: string }) {
  const search = new URLSearchParams();
  if (params?.analyzerKey) search.set('analyzerKey', params.analyzerKey);
  const query = search.toString() ? `?${search.toString()}` : '';
  return apiFetch<{ profile: RuleProfile; rules: RuleWithState[] }>(
    `/projects/${encodeURIComponent(projectKey)}/rules${query}`,
  );
}

export function updateProjectRules(
  projectKey: string,
  payload: { rules: Array<{ ruleKey: string; enabled: boolean }> },
) {
  return apiFetch<{ profile: RuleProfile; updated: number }>(`/projects/${encodeURIComponent(projectKey)}/rules`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listProjectRuleProfiles(projectKey: string) {
  return apiFetch<{ activeRuleProfileId: string | null; profiles: RuleProfile[] }>(
    `/projects/${encodeURIComponent(projectKey)}/rule-profiles`,
  );
}

export function createProjectRuleProfile(projectKey: string, payload: { name: string }) {
  return apiFetch<RuleProfile>(`/projects/${encodeURIComponent(projectKey)}/rule-profiles`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function activateProjectRuleProfile(projectKey: string, ruleProfileId: string) {
  return apiFetch<RuleProfile>(
    `/projects/${encodeURIComponent(projectKey)}/rule-profiles/${encodeURIComponent(ruleProfileId)}/activate`,
    { method: 'PUT', body: JSON.stringify({}) },
  );
}

export function getApiTokens() {
  return apiFetch<ApiToken[]>('/tokens');
}

export function createApiToken(payload: { name: string; projectKey?: string }) {
  return apiFetch<ApiToken & { token: string }>('/tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteApiToken(id: string) {
  return apiFetch<{ id: string }>(`/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function deleteApiTokens(ids: string[]) {
  return apiFetch<{ deletedIds: string[]; missingIds: string[] }>('/tokens/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export function getVcsTokens() {
  return apiFetch<VcsToken[]>('/admin/vcs-tokens');
}

export function createVcsToken(payload: { provider: VcsToken['provider']; token: string; baseUrl?: string | null }) {
  return apiFetch<VcsToken>('/admin/vcs-tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateVcsToken(id: string, payload: { token?: string; baseUrl?: string | null }) {
  return apiFetch<VcsToken>(`/admin/vcs-tokens/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteVcsToken(id: string) {
  return apiFetch<{ id: string }>(`/admin/vcs-tokens/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getUserVcsTokens() {
  return apiFetch<VcsToken[]>('/vcs-tokens');
}

export function upsertUserVcsToken(payload: { provider: VcsToken['provider']; token: string; baseUrl?: string | null }) {
  return apiFetch<VcsToken>('/vcs-tokens', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteUserVcsToken(provider: VcsToken['provider']) {
  return apiFetch<{ id: string }>(`/vcs-tokens/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  });
}

export function getLlmProviders() {
  return apiFetch<LlmProvider[]>('/admin/llm-providers');
}

export function getLlmPrompts() {
  return apiFetch<LlmPromptTemplate[]>('/admin/llm-prompts');
}

export function createLlmPrompt(payload: {
  name: string;
  version: string;
  systemPrompt: string;
  taskPrompt: string;
  isActive?: boolean;
}) {
  return apiFetch<LlmPromptTemplate>('/admin/llm-prompts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateLlmPrompt(
  id: string,
  payload: {
    name?: string;
    version?: string;
    systemPrompt?: string;
    taskPrompt?: string;
    isActive?: boolean;
  },
) {
  return apiFetch<LlmPromptTemplate>(`/admin/llm-prompts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteLlmPrompt(id: string) {
  return apiFetch<{ id: string }>(`/admin/llm-prompts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function activateLlmPrompt(id: string) {
  return apiFetch<LlmPromptTemplate>(`/admin/llm-prompts/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
  });
}

export function createLlmProvider(payload: {
  name: string;
  providerType: string;
  baseUrl: string;
  model?: string | null;
  headersJson?: Record<string, any> | null;
  token?: string;
  isDefault?: boolean;
}) {
  return apiFetch<LlmProvider>('/admin/llm-providers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateLlmProvider(
  id: string,
  payload: {
    name?: string;
    providerType?: string;
    baseUrl?: string;
    model?: string | null;
    headersJson?: Record<string, any> | null;
    token?: string | null;
    isDefault?: boolean;
  },
) {
  return apiFetch<LlmProvider>(`/admin/llm-providers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteLlmProvider(id: string) {
  return apiFetch<{ id: string }>(`/admin/llm-providers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function testLlmProviderConnection(id: string) {
  return apiFetch<LlmProviderTestResult>(`/admin/llm-providers/${encodeURIComponent(id)}/test`, {
    method: 'POST',
  });
}

export function getProjectLlmSettings(projectKey: string) {
  return apiFetch<ProjectLlmSettings>(`/projects/${encodeURIComponent(projectKey)}/llm-settings`);
}

export function updateProjectLlmSettings(
  projectKey: string,
  payload: { llmProviderId?: string | null; overrides?: ProjectLlmOverrides | null },
) {
  return apiFetch<ProjectLlmSettings>(`/projects/${encodeURIComponent(projectKey)}/llm-settings`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export interface ProjectMetricPoint {
  createdAt: string;
  value: number;
  metricKey: string;
  branchId?: string | null;
  analysisId: string;
}

export function getProjectMetrics(
  projectKey: string,
  params: { branch?: string; metricKey?: string; limit?: number },
) {
  const search = new URLSearchParams();
  if (params.branch) search.set('branch', params.branch);
  if (params.metricKey) search.set('metricKey', params.metricKey);
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString() ? `?${search.toString()}` : '';
  return apiFetch<ProjectMetricPoint[]>(`/projects/${encodeURIComponent(projectKey)}/metrics${query}`);
}

export function createRule(payload: {
  key: string;
  analyzerKey: string;
  name: string;
  description: string;
  defaultSeverity: IssueSeverity;
}) {
  return apiFetch<Rule>('/projects/rules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getAllRules(analyzerKey?: string) {
  const search = analyzerKey ? `?analyzerKey=${encodeURIComponent(analyzerKey)}` : '';
  return apiFetch<Rule[]>(`/projects/rules${search}`);
}

export function resolveIssue(
  issueId: string,
  payload: {
    status: IssueStatus;
    author: string;
    comment?: string;
  },
) {
  return apiFetch(`/issues/${encodeURIComponent(issueId)}/resolve`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function resolveIssueViaLlm(issueId: string) {
  return apiFetch<LlmRun>(`/issues/${encodeURIComponent(issueId)}/resolve`, {
    method: 'POST',
  });
}

export function getIssueLlmRuns(issueId: string) {
  return apiFetch<IssueLlmRunsResponse>(`/issues/${encodeURIComponent(issueId)}/llm-runs`);
}

// Project Members API
export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
}

export function getProjectMembers(projectKey: string) {
  return apiFetch<ProjectMember[]>(`/projects/${encodeURIComponent(projectKey)}/members`);
}

export function addProjectMember(projectKey: string, payload: { email: string; role: ProjectRole }) {
  return apiFetch<ProjectMember>(`/projects/${encodeURIComponent(projectKey)}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProjectMember(projectKey: string, memberId: string, payload: { role: ProjectRole }) {
  return apiFetch<ProjectMember>(`/projects/${encodeURIComponent(projectKey)}/members/${encodeURIComponent(memberId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function removeProjectMember(projectKey: string, memberId: string) {
  return apiFetch(`/projects/${encodeURIComponent(projectKey)}/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

// Audit Logs
export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
  };
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
}

export function getAdminAuditLogs(params: Record<string, string> = {}) {
  const queryString = new URLSearchParams(params).toString();
  return apiFetch<AuditLogsResponse>(`/admin/audit-logs${queryString ? `?${queryString}` : ''}`);
}

// Portfolio
export type QualityGateStatusType = 'PASSED' | 'FAILED' | 'UNKNOWN';
export type PortfolioSortBy = 'name' | 'issues' | 'coverage' | 'debt' | 'lastAnalysis';
export type SortOrder = 'asc' | 'desc';

export interface PortfolioSummary {
  totalProjects: number;
  totalAnalyses: number;
  totalIssues: number;
  avgCoverage: number;
  avgDebtRatio: number;
}

export interface PortfolioProjectAnalysis {
  id: string;
  qualityGateStatus: string;
  issuesCount: number;
  coverage: number | null;
  debtRatio: number | null;
  createdAt: string;
  status: string;
}

export interface PortfolioProject {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  organizationId: string;
  organizationName: string;
  lastAnalysis?: PortfolioProjectAnalysis | null;
}

export interface PortfolioResponse {
  summary: PortfolioSummary;
  projects: PortfolioProject[];
  total: number;
}

export interface PortfolioQueryParams {
  organizationId?: string;
  qualityGateStatus?: QualityGateStatusType;
  minCoverage?: number;
  maxCoverage?: number;
  minDebtRatio?: number;
  maxDebtRatio?: number;
  sortBy?: PortfolioSortBy;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
}

// Organizations
export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    projects: number;
    members: number;
  };
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  fileCount: number;
  suggestedAnalyzers: string[];
  frameworks?: string[];
}

export interface DetectLanguagesResponse {
  languages: LanguageDetectionResult[];
  totalFiles: number;
  projectPath: string;
}

export function getPortfolio(params?: PortfolioQueryParams) {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, value.toString());
      }
    });
  }
  const queryString = queryParams.toString();
  return apiFetch<PortfolioResponse>(`/portfolio${queryString ? `?${queryString}` : ''}`);
}

export function exportPortfolioCSV(params?: PortfolioQueryParams): Promise<Blob> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, value.toString());
      }
    });
  }
  const queryString = queryParams.toString();
  const token = resolveToken();
  return fetch(`${API_URL}/portfolio/export${queryString ? `?${queryString}` : ''}`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  });
}

export function getOrganizations() {
  return apiFetch<Organization[]>('/organizations');
}

export function getOrganization(slug: string) {
  return apiFetch<Organization>(`/organizations/${encodeURIComponent(slug)}`);
}

export function createOrganization(payload: { name: string; slug: string; description?: string }) {
  return apiFetch<Organization>('/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateOrganization(slug: string, payload: { name?: string; description?: string }) {
  return apiFetch<Organization>(`/organizations/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteOrganization(slug: string) {
  return apiFetch<void>(`/organizations/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}

export function getOrganizationMembers(slug: string) {
  return apiFetch<OrganizationMember[]>(`/organizations/${encodeURIComponent(slug)}/members`);
}

export function addOrganizationMember(slug: string, payload: { email: string; role: OrgRole }) {
  return apiFetch<OrganizationMember>(`/organizations/${encodeURIComponent(slug)}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removeOrganizationMember(slug: string, userId: string) {
  return apiFetch<void>(`/organizations/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export function getOrganizationProjects(slug: string) {
  return apiFetch<Project[]>(`/organizations/${encodeURIComponent(slug)}/projects`);
}

// Simple api object for generic requests
export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T = any>(path: string, body?: any) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = any>(path: string, body?: any) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = any>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
