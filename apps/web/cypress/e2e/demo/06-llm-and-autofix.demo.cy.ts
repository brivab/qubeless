import { buildDemoAnalysisDetail, computeAnalysisSummary } from '../../support/demo-fixtures';

type DemoLlmSeed = {
  projectKey: string;
  analysisId: string | null;
  issueId: string | null;
};

describe('Demo Video - 06 LLM and Auto-fix', () => {
  let seed: DemoLlmSeed;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows LLM settings and an auto-fix run with PR evidence', () => {
    const now = new Date().toISOString();
    const providerId = 'provider-demo-llm';
    const providerName = 'OpenAI GPT-4o (Production)';
    const promptName = 'Security Remediation v3';
    const analysisId = seed.analysisId ?? 'anl-20260220-1800';
    const detail = buildDemoAnalysisDetail(seed.projectKey, analysisId);
    let issues = detail.issues.map((issue) => ({ ...issue }));
    const issueId = seed.issueId ?? issues[0].id;

    cy.intercept('GET', '**/admin/llm-providers', {
      statusCode: 200,
      body: [
        {
          id: providerId,
          name: providerName,
          providerType: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o',
          headersJson: null,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
          tokenMasked: '***a4f9c812',
          hasToken: true,
        },
      ],
    }).as('demoGetProviders');

    cy.intercept('GET', '**/admin/llm-prompts', {
      statusCode: 200,
      body: [
        {
          id: 'prompt-demo-llm',
          name: promptName,
          version: 'v3',
          systemPrompt: 'You are a senior AppSec reviewer focused on safe and minimal remediations.',
          taskPrompt: 'Propose the smallest safe fix and include rollback considerations.',
          createdAt: now,
          isActive: true,
        },
      ],
    }).as('demoGetPrompts');

    cy.intercept('GET', `**/projects/${seed.projectKey}/llm-settings`, {
      statusCode: 200,
      body: {
        projectKey: seed.projectKey,
        provider: {
          id: providerId,
          name: providerName,
          providerType: 'openai',
          model: 'gpt-4o',
          isDefault: true,
        },
        selectedProviderId: providerId,
        overrides: {
          temperature: 0.2,
          topP: 0.9,
          maxTokens: 2500,
        },
        source: 'project',
        providers: [
          {
            id: providerId,
            name: providerName,
            providerType: 'openai',
            model: 'gpt-4o',
            isDefault: true,
          },
        ],
      },
    }).as('demoGetProjectLlmSettings');

    cy.showDemoStep('LLM Administration', 'Providers and prompts are centrally managed');
    cy.visitAsAdmin('/admin/llm-providers');
    cy.wait('@demoGetProviders');
    cy.get(`[data-cy="admin-llm-provider-card-${providerName}"]`).should('be.visible');
    cy.captureDemoScreen('06-llm-admin-providers');
    cy.demoPause(800);

    cy.visitAsAdmin('/admin/llm-prompts');
    cy.wait('@demoGetPrompts');
    cy.get(`[data-cy="admin-llm-prompt-card-${promptName}"]`).should('be.visible');
    cy.captureDemoScreen('06-llm-admin-prompts');
    cy.demoPause(1000);

    cy.showDemoStep('Project LLM Settings', 'Project can pin provider and generation parameters');
    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.wait('@demoGetProjectLlmSettings');
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-llm"]').length > 0) {
        cy.get('[data-cy="project-tab-llm"]').click();
      } else {
        cy.contains('.main-tab-button', /^LLM$/).click();
      }
    });
    cy.getByDataCyOr('project-llm-provider', '.llm-form select').should('contain.text', providerName);
    cy.getByDataCyOr('project-llm-temperature', 'input').should('have.value', '0.2');
    cy.getByDataCyOr('project-llm-top-p', 'input').should('have.value', '0.9');
    cy.captureDemoScreen('06-llm-project-settings');
    cy.demoPause(1000);

    const llmRun = {
      id: 'run-demo-llm-1',
      issueId,
      projectId: 'project-demo',
      status: 'SUCCESS',
      promptVersion: 'v3',
      createdAt: now,
      outputSummary: 'Created a safe parameterized query and added regression test guidance.',
      outputPatch: '[{"path":"src/repositories/report.repository.ts","content":"- const query = `SELECT * FROM report WHERE owner = ${owner}`\\n+ const query = \"SELECT * FROM report WHERE owner = $1\"\\n+ const values = [owner]"}]',
      pullRequest: {
        id: 'pr-demo-llm-1',
        provider: 'GITHUB',
        prNumber: 314,
        repo: 'acme/storefront-api',
        sourceBranch: 'fix/sql-injection-guard',
        targetBranch: 'main',
        commitSha: '85bfe6175802d468de700da6f3f24696e2a9f11c',
        projectId: 'project-demo',
        createdAt: now,
        url: 'https://github.com/acme/storefront-api/pull/314',
      },
    };

    cy.intercept('GET', `**/analyses/${analysisId}`, {
      statusCode: 200,
      body: detail.analysis,
    });

    cy.intercept('GET', `**/analyses/${analysisId}/issues*`, (req) => {
      const url = new URL(req.url);
      const severity = url.searchParams.get('severity');
      const type = url.searchParams.get('type');
      const filePath = url.searchParams.get('filePath');
      const onlyNew = url.searchParams.get('onlyNew') === 'true';
      let filtered = [...issues];
      if (severity) {
        filtered = filtered.filter((issue) => issue.severity === severity);
      }
      if (type) {
        filtered = filtered.filter((issue) => issue.type === type);
      }
      if (filePath) {
        filtered = filtered.filter((issue) => issue.filePath.toLowerCase().includes(filePath.toLowerCase()));
      }
      if (onlyNew) {
        filtered = filtered.filter((issue) => issue.isNew);
      }
      req.reply({
        statusCode: 200,
        body: filtered,
      });
    }).as('demoGetIssues');

    cy.intercept('GET', `**/analyses/${analysisId}/summary`, (req) => {
      req.reply({
        statusCode: 200,
        body: computeAnalysisSummary(issues),
      });
    }).as('demoGetSummary');
    cy.intercept('GET', `**/analyses/${analysisId}/quality-gate-status`, {
      statusCode: 200,
      body: detail.qualityGate,
    });
    cy.intercept('GET', `**/analyses/${analysisId}/artifacts`, {
      statusCode: 200,
      body: detail.artifacts,
    });
    cy.intercept('GET', `**/analyses/${analysisId}/debt`, {
      statusCode: 200,
      body: detail.debt,
    });
    cy.intercept('GET', `**/analyses/${analysisId}/coverage`, {
      statusCode: 200,
      body: detail.coverage,
    });
    cy.intercept('GET', `**/analyses/${analysisId}/duplication`, {
      statusCode: 200,
      body: detail.duplication,
    });
    cy.intercept('PUT', '**/issues/*/resolve', (req) => {
      const issueIdFromUrl = decodeURIComponent(req.url.split('/issues/')[1].split('/resolve')[0]);
      const payload = req.body as { status: 'OPEN' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK' | 'RESOLVED' };
      issues = issues.map((issue) => {
        if (issue.id !== issueIdFromUrl) {
          return issue;
        }
        return {
          ...issue,
          status: payload.status,
        };
      });
      const updated = issues.find((issue) => issue.id === issueIdFromUrl);
      req.reply({
        statusCode: 200,
        body: updated,
      });
    }).as('demoResolveIssue');

    cy.intercept('GET', `**/issues/${issueId}/llm-runs`, {
      statusCode: 200,
      body: {
        issueId,
        runs: [llmRun],
      },
    }).as('demoGetLlmRuns');

    cy.intercept('POST', `**/issues/${issueId}/resolve`, {
      statusCode: 200,
      body: llmRun,
    }).as('demoResolveLlm');

    cy.showDemoStep('LLM Auto-fix', 'Issue context opens LLM runs and PR/MR evidence');
    cy.visitAsAdmin(`/analyses/${analysisId}`);
    cy.wait('@demoGetIssues');
    cy.wait('@demoGetSummary');
    cy.contains('Code Coverage').should('be.visible');
    cy.contains('Code Duplication').should('be.visible');
    cy.contains('Technical Debt').should('be.visible');
    cy.captureDemoScreen('06-analysis-dashboard');
    cy.get('body').then(($body) => {
      if ($body.find('.main-tab-button').length > 0 && $body.find('.filter-bar select').length === 0) {
        cy.contains('.main-tab-button', /Issues/i).click();
      }
    });
    cy.get('.filter-bar select').eq(1).select('CRITICAL');
    cy.wait('@demoGetIssues');
    cy.get('.issues > [data-cy^="analysis-issue-"]').should('have.length', 2);
    cy.captureDemoScreen('06-issues-filtered-critical');
    cy.get('.filter-bar select').eq(1).select('All');
    cy.wait('@demoGetIssues');
    cy.get(`[data-cy="analysis-issue-${issueId}"] .issue-status-button`).click();
    cy.contains('.issue-status-menu button', /Resolved/i).click();
    cy.wait('@demoResolveIssue');
    cy.get(`[data-cy="analysis-issue-${issueId}"] [data-status="RESOLVED"]`).should('be.visible');
    cy.get(`[data-cy="analysis-issue-llm-runs-${issueId}"]`).click();
    cy.wait('@demoGetLlmRuns');
    cy.getByDataCyOr('analysis-llm-runs-modal', '.modal-content').should('be.visible');
    cy.getByDataCyOr('analysis-llm-resolve', '.llm-modal-actions button').first().click();
    cy.wait('@demoResolveLlm');
    cy.contains(/PR #314|MR #314/).should('be.visible');
    cy.captureDemoScreen('06-llm-runs-pr-evidence');
    cy.demoPause(1400);
  });
});
