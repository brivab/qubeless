type WalkthroughSeedData = {
  projectKey: string;
  projectName: string;
  analyzerKey: string;
  analysisId: string | null;
  issueId: string | null;
};

describe('Web E2E - Features Walkthrough (Video)', () => {
  let seed: WalkthroughSeedData;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('walks through the main product features in a sober demo flow', () => {
    cy.visitAsAdmin('/dashboard');
    cy.getByDataCyOr('dashboard-platform-status', '.status-card-wide').should('be.visible');
    cy.wait(400);

    cy.clickByDataCyOr('nav-projects', 'a[href="/projects"]');
    cy.get('body').then(($body) => {
      if ($body.find(`[data-cy="open-project-${seed.projectKey}"]`).length > 0) {
        cy.get(`[data-cy="open-project-${seed.projectKey}"]`).click();
      } else {
        cy.get(`a[href="/projects/${seed.projectKey}"]`).first().click();
      }
    });
    cy.contains(seed.projectName).should('be.visible');
    cy.wait(400);

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-analyzers"]').length > 0) {
        cy.get('[data-cy="project-tab-analyzers"]').click();
      } else {
        cy.contains('.main-tab-button', /Analyzers/i).click();
      }
    });
    cy.get('body').then(($body) => {
      if ($body.find(`[data-cy="project-analyzer-card-${seed.analyzerKey}"]`).length > 0) {
        cy.get(`[data-cy="project-analyzer-card-${seed.analyzerKey}"]`).should('be.visible');
      } else {
        cy.contains('.analyzer-card', seed.analyzerKey).should('be.visible');
      }
    });
    cy.wait(400);

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-quality-gate"]').length > 0) {
        cy.get('[data-cy="project-tab-quality-gate"]').click();
      } else {
        cy.contains('.main-tab-button', /Quality Gate|Seuils/i).click();
      }
    });
    cy.getByDataCyOr('quality-gate-name', '.quality-gate-tab input[type="text"]').should('be.visible');
    cy.wait(400);

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-llm"]').length > 0) {
        cy.get('[data-cy="project-tab-llm"]').click();
      } else {
        cy.contains('.main-tab-button', /^LLM$/).click();
      }
    });
    cy.getByDataCyOr('project-llm-provider', '.llm-form select').should('be.visible');
    cy.wait(400);

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-open-quickstart"]').length > 0) {
        cy.get('[data-cy="project-open-quickstart"]').click();
      } else {
        cy.contains('button', /Quickstart/i).click();
      }
    });
    cy.getByDataCyOr('quickstart-command', '.code-block').should('be.visible');
    cy.wait(400);

    cy.clickByDataCyOr('nav-vcs-tokens', 'a[href="/vcs-tokens"]');
    cy.getByDataCyOr('vcs-token-item-GITHUB', '.token-item').should('be.visible');
    cy.wait(400);

    if (seed.analysisId && seed.issueId) {
      const llmRun = {
        id: 'run-demo-1',
        issueId: seed.issueId,
        projectId: 'project-demo',
        status: 'SUCCESS',
        promptVersion: 'v1',
        createdAt: new Date().toISOString(),
        outputSummary: 'Demo auto-fix generated.',
        outputPatch: '[{"path":"src/demo.ts","content":"- console.log(value)\\n+ logger.info(value)"}]',
        pullRequest: {
          id: 'pr-demo-1',
          provider: 'GITLAB',
          prNumber: 9,
          repo: 'demo/repo',
          sourceBranch: 'fix/demo',
          targetBranch: 'main',
          commitSha: '4f5d2eb4798ffb90f63dcdeff9491b6d445f1234',
          projectId: 'project-demo',
          createdAt: new Date().toISOString(),
          url: 'https://gitlab.example.com/demo/repo/-/merge_requests/9',
        },
      };

      cy.intercept('GET', `**/issues/${seed.issueId}/llm-runs`, {
        statusCode: 200,
        body: {
          issueId: seed.issueId,
          runs: [llmRun],
        },
      });

      cy.visitAsAdmin(`/analyses/${seed.analysisId}`);
      cy.get('body').then(($body) => {
        if ($body.find(`[data-cy="analysis-issue-llm-runs-${seed.issueId}"]`).length > 0) {
          cy.get(`[data-cy="analysis-issue-llm-runs-${seed.issueId}"]`).click();
        } else {
          cy.contains('.issue-actions button', /LLM runs|Runs LLM/i).first().click();
        }
      });
      cy.getByDataCyOr('analysis-llm-runs-modal', '.modal-content').should('be.visible');
      cy.contains('MR #9').should('be.visible');
      cy.wait(800);
    }
  });
});
