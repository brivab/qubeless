type LlmSeedData = {
  projectKey: string;
  llmProviderName: string;
  llmPromptName: string;
  analysisId: string | null;
  issueId: string | null;
};

describe('Web E2E - LLM Integration and Auto-fix', () => {
  let seed: LlmSeedData;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('exposes providers/prompts and project-level LLM settings', () => {
    const now = new Date().toISOString();
    const providerId = 'provider-e2e';
    const provider = {
      id: providerId,
      name: seed.llmProviderName,
      providerType: 'openai',
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o-mini',
      headersJson: null,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      tokenMasked: '***e2e12345',
      hasToken: true,
    };
    const prompt = {
      id: 'prompt-e2e',
      name: seed.llmPromptName,
      version: 'v1',
      systemPrompt: 'You are a careful code remediation assistant.',
      taskPrompt: 'Propose the safest fix and provide a concise rationale.',
      createdAt: now,
      isActive: true,
    };

    cy.intercept('GET', '**/admin/llm-providers', {
      statusCode: 200,
      body: [provider],
    }).as('getAdminLlmProviders');

    cy.intercept('GET', '**/admin/llm-prompts', {
      statusCode: 200,
      body: [prompt],
    }).as('getAdminLlmPrompts');

    cy.intercept('GET', `**/projects/${seed.projectKey}/llm-settings`, {
      statusCode: 200,
      body: {
        projectKey: seed.projectKey,
        provider: {
          id: providerId,
          name: seed.llmProviderName,
          providerType: 'openai',
          model: 'gpt-4o-mini',
          isDefault: true,
        },
        selectedProviderId: providerId,
        overrides: null,
        source: 'project',
        providers: [
          {
            id: providerId,
            name: seed.llmProviderName,
            providerType: 'openai',
            model: 'gpt-4o-mini',
            isDefault: true,
          },
        ],
      },
    }).as('getProjectLlmSettings');

    cy.visitAsAdmin('/admin/llm-providers');
    cy.wait('@getAdminLlmProviders');
    cy.get(`[data-cy="admin-llm-provider-card-${seed.llmProviderName}"]`, { timeout: 10000 })
      .should('contain.text', seed.llmProviderName);

    cy.visitAsAdmin('/admin/llm-prompts');
    cy.wait('@getAdminLlmPrompts');
    cy.get(`[data-cy="admin-llm-prompt-card-${seed.llmPromptName}"]`, { timeout: 10000 })
      .should('contain.text', seed.llmPromptName);

    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.wait('@getProjectLlmSettings');
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-llm"]').length > 0) {
        cy.get('[data-cy="project-tab-llm"]').click();
      } else {
        cy.contains('.main-tab-button', /^LLM$/).click();
      }
    });
    cy.getByDataCyOr('project-llm-provider', '.llm-form select')
      .find('option')
      .contains(seed.llmProviderName, { timeout: 10000 });
  });

  it('opens LLM runs modal and renders PR/MR information for auto-fix runs', () => {
    const analysisId = seed.analysisId ?? 'e2e-fallback-analysis';
    const issueId = seed.issueId ?? 'e2e-fallback-issue';
    const now = new Date().toISOString();

    if (!seed.analysisId) {
      cy.intercept('GET', `**/analyses/${analysisId}`, {
        statusCode: 200,
        body: {
          id: analysisId,
          projectId: 'project-e2e',
          branchId: 'branch-main',
          commitSha: '2f2a99f7c5c24bfa80b6fcdf8a8d7c0e5bdb1234',
          status: 'SUCCESS',
          startedAt: now,
          finishedAt: now,
          createdAt: now,
          branch: {
            id: 'branch-main',
            name: 'main',
            isDefault: true,
            createdAt: now,
          },
          project: {
            id: 'project-e2e',
            key: seed.projectKey,
            name: seed.projectKey,
            description: null,
            createdAt: now,
          },
        },
      });
    }

    if (!seed.issueId) {
      cy.intercept('GET', `**/analyses/${analysisId}/issues*`, {
        statusCode: 200,
        body: [
          {
            id: issueId,
            analysisId,
            analyzerKey: seed.projectKey,
            ruleKey: 'demo:no-eval',
            severity: 'CRITICAL',
            type: 'VULNERABILITY',
            status: 'OPEN',
            filePath: 'src/security.ts',
            line: 33,
            message: 'Potential unsafe dynamic code execution',
            fingerprint: 'fallback-issue-fingerprint',
            createdAt: now,
            isNew: true,
          },
        ],
      });
    }

    const llmRun = {
      id: 'run-e2e-1',
      issueId,
      projectId: 'project-e2e',
      status: 'SUCCESS',
      promptVersion: 'v1',
      createdAt: now,
      outputSummary: 'Automated fix proposal generated.',
      outputPatch: '[{"path":"src/security.ts","content":"- eval(input)\\n+ safeParse(input)"}]',
      pullRequest: {
        id: 'pr-e2e-1',
        provider: 'GITHUB',
        prNumber: 42,
        repo: 'demo/repo',
        sourceBranch: 'fix/e2e',
        targetBranch: 'main',
        commitSha: '2f2a99f7c5c24bfa80b6fcdf8a8d7c0e5bdb1234',
        projectId: 'project-e2e',
        createdAt: now,
        url: 'https://github.com/demo/repo/pull/42',
      },
    };

    cy.intercept('GET', `**/issues/${issueId}/llm-runs`, {
      statusCode: 200,
      body: {
        issueId,
        runs: [llmRun],
      },
    }).as('getLlmRuns');

    cy.intercept('POST', `**/issues/${issueId}/resolve`, {
      statusCode: 200,
      body: llmRun,
    }).as('resolveViaLlm');

    cy.visitAsAdmin(`/analyses/${analysisId}`);
    cy.get('body').then(($body) => {
      if ($body.find(`[data-cy="analysis-issue-llm-runs-${issueId}"]`).length > 0) {
        cy.get(`[data-cy="analysis-issue-llm-runs-${issueId}"]`).click();
      } else {
        cy.contains('.issue-actions button', /LLM runs|Runs LLM/i).first().click();
      }
    });
    cy.wait('@getLlmRuns');
    cy.getByDataCyOr('analysis-llm-runs-modal', '.modal-content').should('be.visible');
    cy.getByDataCyOr('analysis-llm-resolve', '.llm-modal-actions button').first().click();
    cy.wait('@resolveViaLlm');
    cy.contains(/PR #42|MR #42/).should('be.visible');
  });
});
