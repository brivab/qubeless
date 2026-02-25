type DemoAnalyzer = {
  id: string;
  key: string;
  name: string;
  dockerImage: string;
  enabled: boolean;
  createdAt: string;
};

type DemoProjectAnalysis = {
  id: string;
  projectId: string;
  branchId: string;
  commitSha: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING';
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  branch: {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
  };
  project: {
    id: string;
    key: string;
    name: string;
    description: string;
    createdAt: string;
  };
};

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60_000).toISOString();
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

export function buildDemoAnalyzerCatalog(): DemoAnalyzer[] {
  return [
    {
      id: 'an-eslint',
      key: 'eslint',
      name: 'ESLint TypeScript',
      dockerImage: 'ghcr.io/qubeless/analyzer-eslint:v2.3.1',
      enabled: true,
      createdAt: isoDaysAgo(60),
    },
    {
      id: 'an-semgrep',
      key: 'semgrep',
      name: 'Semgrep SAST',
      dockerImage: 'ghcr.io/qubeless/analyzer-semgrep:v1.89.0',
      enabled: true,
      createdAt: isoDaysAgo(45),
    },
    {
      id: 'an-trivy',
      key: 'trivy',
      name: 'Trivy Dependencies',
      dockerImage: 'ghcr.io/qubeless/analyzer-trivy:v0.59.1',
      enabled: true,
      createdAt: isoDaysAgo(30),
    },
    {
      id: 'an-jscpd',
      key: 'jscpd',
      name: 'JSCPD Duplication',
      dockerImage: 'ghcr.io/qubeless/analyzer-jscpd:v4.0.2',
      enabled: false,
      createdAt: isoDaysAgo(20),
    },
  ];
}

export function buildDemoProjectOverview(projectKey: string) {
  const projectId = 'proj-acme-storefront';
  const projectName = 'Acme Storefront API';
  const projectDescription = 'Node.js API for checkout, orders, and customer accounts.';
  const projectCreatedAt = isoDaysAgo(120);

  const analyses: DemoProjectAnalysis[] = [
    {
      id: 'anl-20260220-1800',
      projectId,
      branchId: 'branch-main',
      commitSha: 'a12f3cb9ef4c7931f9a7f0e8b7460af8f2ad5c11',
      status: 'SUCCESS',
      startedAt: isoMinutesAgo(100),
      finishedAt: isoMinutesAgo(95),
      createdAt: isoMinutesAgo(100),
      branch: {
        id: 'branch-main',
        name: 'main',
        isDefault: true,
        createdAt: projectCreatedAt,
      },
      project: {
        id: projectId,
        key: projectKey,
        name: projectName,
        description: projectDescription,
        createdAt: projectCreatedAt,
      },
    },
    {
      id: 'anl-20260219-1640',
      projectId,
      branchId: 'branch-main',
      commitSha: 'f01edc3413ad3c5e8f1bb3c4f56d7e9b1abce334',
      status: 'FAILED',
      startedAt: isoHoursAgo(20),
      finishedAt: isoHoursAgo(19),
      createdAt: isoHoursAgo(20),
      branch: {
        id: 'branch-main',
        name: 'main',
        isDefault: true,
        createdAt: projectCreatedAt,
      },
      project: {
        id: projectId,
        key: projectKey,
        name: projectName,
        description: projectDescription,
        createdAt: projectCreatedAt,
      },
    },
    {
      id: 'anl-20260218-1015',
      projectId,
      branchId: 'branch-main',
      commitSha: '01bc3ea9971640059da71633f89ce58c114f7791',
      status: 'SUCCESS',
      startedAt: isoDaysAgo(2),
      finishedAt: isoDaysAgo(2),
      createdAt: isoDaysAgo(2),
      branch: {
        id: 'branch-main',
        name: 'main',
        isDefault: true,
        createdAt: projectCreatedAt,
      },
      project: {
        id: projectId,
        key: projectKey,
        name: projectName,
        description: projectDescription,
        createdAt: projectCreatedAt,
      },
    },
  ];

  const latest = analyses[0];

  const metrics = [
    { analysisId: analyses[2].id, metricKey: 'issues_total', value: 71, createdAt: analyses[2].createdAt },
    { analysisId: analyses[2].id, metricKey: 'issues_new', value: 14, createdAt: analyses[2].createdAt },
    { analysisId: analyses[2].id, metricKey: 'issues_blocker', value: 1, createdAt: analyses[2].createdAt },
    { analysisId: analyses[2].id, metricKey: 'issues_critical', value: 5, createdAt: analyses[2].createdAt },
    { analysisId: analyses[1].id, metricKey: 'issues_total', value: 62, createdAt: analyses[1].createdAt },
    { analysisId: analyses[1].id, metricKey: 'issues_new', value: 9, createdAt: analyses[1].createdAt },
    { analysisId: analyses[1].id, metricKey: 'issues_blocker', value: 1, createdAt: analyses[1].createdAt },
    { analysisId: analyses[1].id, metricKey: 'issues_critical', value: 4, createdAt: analyses[1].createdAt },
    { analysisId: analyses[0].id, metricKey: 'issues_total', value: 48, createdAt: analyses[0].createdAt },
    { analysisId: analyses[0].id, metricKey: 'issues_new', value: 3, createdAt: analyses[0].createdAt },
    { analysisId: analyses[0].id, metricKey: 'issues_blocker', value: 0, createdAt: analyses[0].createdAt },
    { analysisId: analyses[0].id, metricKey: 'issues_critical', value: 1, createdAt: analyses[0].createdAt },
  ];

  return {
    project: {
      id: projectId,
      key: projectKey,
      name: projectName,
      description: projectDescription,
      createdAt: projectCreatedAt,
      branches: [
        {
          id: 'branch-main',
          name: 'main',
          isDefault: true,
          createdAt: projectCreatedAt,
        },
      ],
    },
    analyses,
    latestAnalysisId: latest.id,
    latestQualityGate: {
      status: 'PASS',
      gate: { id: 'qg-acme-main', name: 'Acme API Quality Gate' },
      conditions: [
        { metric: 'issues_critical', operator: 'GT', threshold: 1, value: 1, passed: true, scope: 'ALL' },
        { metric: 'coverage', operator: 'LT', threshold: 80, value: 87.3, passed: true, scope: 'ALL' },
      ],
      metrics: {
        issues_critical: 1,
        coverage: 87.3,
      },
      metricsNew: {
        issues_critical: 0,
        coverage: 91.2,
      },
    },
    latestSummary: {
      totalIssues: 48,
      newIssues: 3,
      bySeverity: {
        INFO: 12,
        MINOR: 20,
        MAJOR: 15,
        CRITICAL: 1,
        BLOCKER: 0,
      },
      newBySeverity: {
        INFO: 1,
        MINOR: 1,
        MAJOR: 1,
        CRITICAL: 0,
        BLOCKER: 0,
      },
      byType: {
        BUG: 9,
        CODE_SMELL: 34,
        VULNERABILITY: 5,
      },
      newByType: {
        BUG: 0,
        CODE_SMELL: 2,
        VULNERABILITY: 1,
      },
    },
    metrics,
  };
}

export function buildDemoPortfolio(projectKey: string) {
  return {
    summary: {
      totalProjects: 4,
      totalAnalyses: 73,
      totalIssues: 276,
      avgCoverage: 84.2,
      avgDebtRatio: 4.8,
    },
    projects: [
      {
        id: 'proj-acme-storefront',
        key: projectKey,
        name: 'Acme Storefront API',
        description: 'Checkout and customer APIs',
        organizationId: 'org-acme',
        organizationName: 'Acme Corp',
        lastAnalysis: {
          id: 'anl-20260220-1800',
          qualityGateStatus: 'PASSED',
          issuesCount: 48,
          coverage: 87.3,
          debtRatio: 3.4,
          createdAt: isoMinutesAgo(95),
          status: 'SUCCESS',
        },
      },
      {
        id: 'proj-acme-payments',
        key: 'acme-payments-core',
        name: 'Acme Payments Core',
        description: 'Card and wallet orchestration',
        organizationId: 'org-acme',
        organizationName: 'Acme Corp',
        lastAnalysis: {
          id: 'anl-20260220-1510',
          qualityGateStatus: 'FAILED',
          issuesCount: 71,
          coverage: 74.6,
          debtRatio: 7.9,
          createdAt: isoHoursAgo(4),
          status: 'SUCCESS',
        },
      },
      {
        id: 'proj-b2b-portal',
        key: 'b2b-partner-portal',
        name: 'B2B Partner Portal',
        description: 'Partner onboarding and SLA workflows',
        organizationId: 'org-contoso',
        organizationName: 'Contoso Group',
        lastAnalysis: {
          id: 'anl-20260219-2245',
          qualityGateStatus: 'PASSED',
          issuesCount: 39,
          coverage: 91.4,
          debtRatio: 2.8,
          createdAt: isoHoursAgo(18),
          status: 'SUCCESS',
        },
      },
      {
        id: 'proj-mobile-backend',
        key: 'mobile-backend',
        name: 'Mobile Backend',
        description: 'Notification and session services',
        organizationId: 'org-contoso',
        organizationName: 'Contoso Group',
        lastAnalysis: {
          id: 'anl-20260218-0930',
          qualityGateStatus: 'FAILED',
          issuesCount: 118,
          coverage: 63.2,
          debtRatio: 12.1,
          createdAt: isoDaysAgo(2),
          status: 'SUCCESS',
        },
      },
    ],
    total: 4,
  };
}

export function buildDemoAnalysisDetail(projectKey: string, analysisId: string) {
  const createdAt = isoMinutesAgo(110);
  const issues = [
    {
      id: 'issue-auth-001',
      analysisId,
      analyzerKey: 'semgrep',
      ruleKey: 'auth.jwt-hardcoded-secret',
      severity: 'CRITICAL',
      type: 'VULNERABILITY',
      status: 'OPEN',
      filePath: 'src/auth/jwt.service.ts',
      line: 44,
      message: 'JWT secret appears hardcoded in source code.',
      fingerprint: 'f4a8ad33d3f44b2f',
      createdAt,
      isNew: true,
    },
    {
      id: 'issue-api-002',
      analysisId,
      analyzerKey: 'eslint',
      ruleKey: 'eslint.no-explicit-any',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      status: 'OPEN',
      filePath: 'src/controllers/orders.controller.ts',
      line: 91,
      message: 'Unexpected any. Please use a stricter type.',
      fingerprint: 'e13c2c92b98f46db',
      createdAt,
      isNew: false,
    },
    {
      id: 'issue-sql-003',
      analysisId,
      analyzerKey: 'semgrep',
      ruleKey: 'db.sql-string-concat',
      severity: 'CRITICAL',
      type: 'VULNERABILITY',
      status: 'OPEN',
      filePath: 'src/repositories/report.repository.ts',
      line: 137,
      message: 'Dynamic SQL built with string concatenation.',
      fingerprint: '28e4f10ab91e4dc4',
      createdAt,
      isNew: true,
    },
    {
      id: 'issue-dup-004',
      analysisId,
      analyzerKey: 'jscpd',
      ruleKey: 'duplication.large-block',
      severity: 'MINOR',
      type: 'CODE_SMELL',
      status: 'OPEN',
      filePath: 'src/services/checkout/price-calculator.ts',
      line: 12,
      message: 'Duplicated code block found in checkout services.',
      fingerprint: '5c0534ec37ff4f09',
      createdAt,
      isNew: false,
    },
  ];

  return {
    analysis: {
      id: analysisId,
      projectId: 'proj-acme-storefront',
      branchId: 'branch-main',
      commitSha: '9bd1406dcf8f8f7e0d14f77c3bfa605f9ee177b5',
      status: 'SUCCESS',
      startedAt: isoMinutesAgo(122),
      finishedAt: isoMinutesAgo(110),
      createdAt,
      branch: {
        id: 'branch-main',
        name: 'main',
        isDefault: true,
        createdAt: isoDaysAgo(120),
      },
      project: {
        id: 'proj-acme-storefront',
        key: projectKey,
        name: 'Acme Storefront API',
        description: 'Node.js API for checkout, orders, and customer accounts.',
        createdAt: isoDaysAgo(120),
      },
    },
    issues,
    qualityGate: {
      status: 'FAIL',
      gate: { id: 'qg-acme-main', name: 'Acme API Quality Gate' },
      conditions: [
        { metric: 'issues_critical', operator: 'GT', threshold: 0, value: 2, passed: false, scope: 'ALL' },
        { metric: 'coverage', operator: 'LT', threshold: 80, value: 86.1, passed: true, scope: 'ALL' },
      ],
      metrics: {
        issues_critical: 2,
        coverage: 86.1,
      },
      metricsNew: {
        issues_critical: 2,
        coverage: 88.7,
      },
    },
    artifacts: [
      {
        id: 'artifact-log-main',
        analysisId,
        analyzerKey: 'semgrep',
        kind: 'LOG',
        bucket: 'qubeless-artifacts',
        objectKey: `${projectKey}/${analysisId}/semgrep.log`,
        contentType: 'text/plain',
        size: 4921,
        createdAt: isoMinutesAgo(109),
      },
    ],
    debt: {
      analysisId,
      debtRatio: 4.2,
      remediationCost: 420,
      formattedRemediationTime: '7h',
      maintainabilityRating: 'B',
    },
    coverage: {
      id: 11,
      analysisId,
      format: 'LCOV',
      totalLines: 8124,
      coveredLines: 7001,
      totalBranches: 1490,
      coveredBranches: 1137,
      coveragePercent: 86.1,
      createdAt: isoMinutesAgo(109),
      files: [
        {
          filePath: 'src/auth/jwt.service.ts',
          lines: 142,
          coveredLines: 121,
          branches: 28,
          coveredBranches: 21,
          lineHits: { '44': 3 },
          coveragePercent: 85.2,
        },
      ],
    },
    duplication: {
      duplicationPercent: 3.8,
      duplicationBlocks: 7,
      duplicatedLines: 312,
      totalSources: 126,
      totalClones: 7,
    },
  };
}

export function computeAnalysisSummary(
  issues: Array<{ severity: string; type: string; isNew?: boolean }>,
) {
  const bySeverity: Record<string, number> = {
    INFO: 0,
    MINOR: 0,
    MAJOR: 0,
    CRITICAL: 0,
    BLOCKER: 0,
  };
  const byType: Record<string, number> = {
    BUG: 0,
    CODE_SMELL: 0,
    VULNERABILITY: 0,
  };
  const newBySeverity: Record<string, number> = {
    INFO: 0,
    MINOR: 0,
    MAJOR: 0,
    CRITICAL: 0,
    BLOCKER: 0,
  };
  const newByType: Record<string, number> = {
    BUG: 0,
    CODE_SMELL: 0,
    VULNERABILITY: 0,
  };

  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
    byType[issue.type] = (byType[issue.type] ?? 0) + 1;
    if (issue.isNew) {
      newBySeverity[issue.severity] = (newBySeverity[issue.severity] ?? 0) + 1;
      newByType[issue.type] = (newByType[issue.type] ?? 0) + 1;
    }
  }

  return {
    totalIssues: issues.length,
    newIssues: issues.filter((issue) => issue.isNew).length,
    bySeverity,
    newBySeverity,
    byType,
    newByType,
  };
}
