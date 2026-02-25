import { buildDemoAnalyzerCatalog, buildDemoProjectOverview } from '../../support/demo-fixtures';

type DemoAnalyzerSeed = {
  projectKey: string;
};

describe('Demo Video - 02 Modular Analyzers', () => {
  let seed: DemoAnalyzerSeed;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows analyzer catalog, creation flow, and activation toggles', () => {
    let adminAnalyzers = buildDemoAnalyzerCatalog();
    const createdAt = new Date().toISOString();
    const projectOverview = buildDemoProjectOverview(seed.projectKey);
    let projectAnalyzers: Array<{
      analyzer: (typeof adminAnalyzers)[number];
      projectEnabled: boolean | null;
      effectiveEnabled: boolean;
      configJson: Record<string, unknown> | null;
    }> = adminAnalyzers.map((analyzer) => ({
      analyzer,
      projectEnabled: analyzer.key === 'eslint' || analyzer.key === 'semgrep' ? true : null,
      effectiveEnabled: analyzer.key === 'eslint' || analyzer.key === 'semgrep' ? true : analyzer.enabled,
      configJson: analyzer.key === 'semgrep' ? { ruleset: 'p/owasp-top-ten', maxFindings: 200 } : null,
    }));

    cy.intercept('GET', '**/analyzers', (req) => {
      req.reply({
        statusCode: 200,
        body: adminAnalyzers,
      });
    }).as('demoGetAdminAnalyzers');

    cy.intercept('POST', '**/analyzers', (req) => {
      const body = req.body as { key: string; name: string; dockerImage: string; enabled?: boolean };
      const created = {
        id: `an-${body.key}`,
        key: body.key,
        name: body.name,
        dockerImage: body.dockerImage,
        enabled: body.enabled ?? true,
        createdAt,
      };
      adminAnalyzers = [...adminAnalyzers, created];
      projectAnalyzers = [
        ...projectAnalyzers,
        {
          analyzer: created,
          projectEnabled: false,
          effectiveEnabled: false,
          configJson: { policyPack: 'iac-security-v1', failOnCritical: true },
        },
      ];
      req.reply({
        statusCode: 201,
        body: created,
      });
    }).as('demoCreateAnalyzer');

    cy.intercept('PUT', '**/analyzers/*', (req) => {
      const key = decodeURIComponent(req.url.split('/analyzers/')[1].split('?')[0]);
      const payload = req.body as { enabled?: boolean; name?: string; dockerImage?: string };
      const target = adminAnalyzers.find((analyzer) => analyzer.key === key);
      if (!target) {
        req.reply({ statusCode: 404, body: { message: 'Analyzer not found' } });
        return;
      }
      const updated = {
        ...target,
        ...payload,
      };
      adminAnalyzers = adminAnalyzers.map((analyzer) => (analyzer.key === key ? updated : analyzer));
      projectAnalyzers = projectAnalyzers.map((entry) => {
        if (entry.analyzer.key !== key) {
          return entry;
        }
        const effectiveEnabled =
          entry.projectEnabled === null ? updated.enabled : Boolean(entry.projectEnabled && updated.enabled);
        return {
          ...entry,
          analyzer: updated,
          effectiveEnabled,
        };
      });
      req.reply({
        statusCode: 200,
        body: updated,
      });
    }).as('demoUpdateAnalyzer');

    cy.intercept('GET', `**/projects/${seed.projectKey}`, {
      statusCode: 200,
      body: projectOverview.project,
    });
    cy.intercept('GET', `**/projects/${seed.projectKey}/analyses*`, {
      statusCode: 200,
      body: projectOverview.analyses,
    });
    cy.intercept('GET', `**/analyses/${projectOverview.latestAnalysisId}/quality-gate-status`, {
      statusCode: 200,
      body: projectOverview.latestQualityGate,
    });
    cy.intercept('GET', `**/analyses/${projectOverview.latestAnalysisId}/summary`, {
      statusCode: 200,
      body: projectOverview.latestSummary,
    });
    cy.intercept('GET', `**/projects/${seed.projectKey}/metrics*`, {
      statusCode: 200,
      body: projectOverview.metrics,
    });

    cy.intercept('GET', `**/projects/${seed.projectKey}/analyzers`, (req) => {
      req.reply({
        statusCode: 200,
        body: projectAnalyzers,
      });
    }).as('demoGetProjectAnalyzers');

    cy.intercept('PUT', `**/projects/${seed.projectKey}/analyzers/*`, (req) => {
      const key = decodeURIComponent(req.url.split('/analyzers/')[1].split('?')[0]);
      const payload = req.body as { enabled: boolean; configJson?: Record<string, unknown> | null };
      const target = projectAnalyzers.find((entry) => entry.analyzer.key === key);
      if (!target) {
        req.reply({ statusCode: 404, body: { message: 'Project analyzer not found' } });
        return;
      }
      const updated = {
        ...target,
        projectEnabled: payload.enabled,
        effectiveEnabled: Boolean(payload.enabled && target.analyzer.enabled),
        configJson: payload.configJson ?? null,
      };
      projectAnalyzers = projectAnalyzers.map((entry) => (entry.analyzer.key === key ? updated : entry));
      req.reply({
        statusCode: 200,
        body: updated,
      });
    }).as('demoUpdateProjectAnalyzer');

    cy.on('window:confirm', () => true);

    cy.showDemoStep('Analyzer Catalog', 'Browse analyzers and activation status by engine');
    cy.visitAsAdmin('/admin/analyzers');
    cy.wait('@demoGetAdminAnalyzers');
    cy.getByDataCyOr('admin-analyzers-search', '.search-input').clear();
    cy.get('[data-cy^="admin-analyzer-card-"]').its('length').should('be.gte', 4);
    cy.get('[data-cy="admin-analyzer-card-eslint"]').should('be.visible');
    cy.get('[data-cy="admin-analyzer-card-semgrep"]').should('be.visible');
    cy.get('[data-cy="admin-analyzer-card-jscpd"]').should('be.visible');
    cy.get('[data-cy="admin-analyzer-card-eslint"] .status-badge').should('contain.text', 'Enabled');
    cy.get('[data-cy="admin-analyzer-card-jscpd"] .status-badge').should('contain.text', 'Disabled');
    cy.scrollTo('top', { ensureScrollable: false });
    cy.captureDemoScreen('02-analyzers-catalog');
    cy.demoPause(900);

    cy.showDemoStep('Disable / Re-enable', 'Global toggle controls engine availability');
    cy.get('[data-cy="admin-analyzer-toggle-semgrep"]').click({ force: true });
    cy.wait('@demoUpdateAnalyzer');
    cy.demoPause(600);
    cy.getByDataCyOr('admin-analyzers-search', '.search-input').clear();
    cy.get('[data-cy="admin-analyzer-card-semgrep"] .status-badge').should('contain.text', 'Disabled');
    cy.get('[data-cy="admin-analyzer-card-eslint"] .status-badge').should('contain.text', 'Enabled');
    cy.scrollTo('top', { ensureScrollable: false });
    cy.captureDemoScreen('02-analyzers-toggle-global');
    cy.get('[data-cy="admin-analyzer-toggle-semgrep"]').click({ force: true });
    cy.wait('@demoUpdateAnalyzer');
    cy.demoPause(900);

    cy.showDemoStep('Create Analyzer', 'Register a new analyzer image for specific use cases');
    cy.getByDataCyOr('admin-analyzers-open-create', 'button').click();
    cy.get('input#key').should('be.visible');
    cy.captureDemoScreen('02-analyzers-create-modal');
    cy.get('input#key').clear().type('iac-policy');
    cy.get('input#name').clear().type('IaC Policy Guard');
    cy.get('input#dockerImage').clear().type('ghcr.io/acme/analyzer-iac-policy:v1.2.0');
    cy.get('button[type="submit"]').click();
    cy.wait('@demoCreateAnalyzer');
    cy.getByDataCyOr('admin-analyzers-search', '.search-input').clear().type('iac-policy');
    cy.get('[data-cy="admin-analyzer-card-iac-policy"]').should('be.visible');
    cy.captureDemoScreen('02-analyzers-created-iac-policy');
    cy.demoPause(1100);

    cy.showDemoStep('Project Activation', 'Enable analyzer only on selected projects and save config');
    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.get('[data-cy="project-tab-analyzers"]').click();
    cy.wait('@demoGetProjectAnalyzers');
    cy.get('[data-cy="project-analyzer-card-iac-policy"]').should('be.visible');
    cy.get('[data-cy="project-analyzer-toggle-iac-policy"]').click({ force: true });
    cy.get('[data-cy="project-analyzer-toggle-iac-policy"]').should('be.checked');
    cy.get('[data-cy="project-analyzer-config-iac-policy"]')
      .clear()
      .type('{"policyPack":"iac-security-v1","failOnCritical":true}', { parseSpecialCharSequences: false });
    cy.get('[data-cy="project-analyzer-save-iac-policy"]').click();
    cy.wait('@demoUpdateProjectAnalyzer');
    cy.captureDemoScreen('02-analyzers-project-activation');
    cy.demoPause(1400);
  });
});
