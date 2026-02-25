export type UserRole = 'ADMIN' | 'USER';

export type ProjectRole = 'PROJECT_ADMIN' | 'PROJECT_MAINTAINER' | 'PROJECT_VIEWER';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembershipDTO {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface UserDTO {
  id: string;
  email: string;
  globalRole: UserRole;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMembershipDTO {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface LoginResponse extends AuthTokens {
  user: UserDTO;
}

// Analyzer contract types
export type AnalyzerIssueSeverity = 'INFO' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER';
export type AnalyzerIssueType = 'BUG' | 'CODE_SMELL' | 'VULNERABILITY';

export interface AnalyzerMetadata {
  name: string;
  version: string;
}

export interface AnalyzerIssue {
  ruleKey: string;
  severity: AnalyzerIssueSeverity;
  type: AnalyzerIssueType;
  filePath: string;
  line?: number | null;
  message: string;
  fingerprint: string;
  ruleName?: string;
  ruleDescription?: string;
}

export interface AnalyzerRule {
  key: string;
  name: string;
  description: string;
  severity: AnalyzerIssueSeverity;
  type: AnalyzerIssueType;
}

export interface AnalyzerReport {
  analyzer: AnalyzerMetadata;
  issues: AnalyzerIssue[];
  rules?: AnalyzerRule[];
}

export interface AnalyzerMeasures {
  metrics: Record<string, number>;
}

export {
  assertAnalyzerReport,
  assertAnalyzerMeasures,
  isAnalyzerReport,
  isAnalyzerMeasures,
} from './validators/analyzer';

export interface LlmOutputFile {
  path: string;
  content: string;
}

export interface LlmOutput {
  summary: string;
  files: LlmOutputFile[];
  notes: string[];
}

export {
  assertLlmOutput,
  assertLlmOutputScope,
  extractPatchFilePaths,
  isLlmOutput,
  parseLlmOutputJson,
} from './validators/llm';

// Queue payloads
export interface AnalysisJobAnalyzer {
  key: string;
  dockerImage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configJson?: any;
}

export interface AnalysisJobPayload {
  analysisId: string;
  projectKey: string;
  branchName: string;
  commitSha: string;
  analyzers: AnalysisJobAnalyzer[];
  repoUrl?: string;
  workspacePath?: string;
  sourceObjectKey?: string;
  pullRequestId?: string;
  pullRequest?: {
    id?: string;
    provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
    repo: string;
    prNumber: number;
    sourceBranch: string;
    targetBranch: string;
  };
}

export interface LlmResolveIssueJobPayload {
  llmRunId: string;
  issueId: string;
}
