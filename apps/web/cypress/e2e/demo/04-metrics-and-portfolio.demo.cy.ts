import { buildDemoAnalyzerCatalog, buildDemoPortfolio, buildDemoProjectOverview } from '../../support/demo-fixtures';

type DemoMetricsSeed = {
  projectKey: string;
};

describe('Demo Video - 04 Metrics and Portfolio', () => {
  let seed: DemoMetricsSeed;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows dashboard, portfolio and project overview metrics', () => {
    const portfolio = buildDemoPortfolio(seed.projectKey);
    const overview = buildDemoProjectOverview(seed.projectKey);
    const analyzers = buildDemoAnalyzerCatalog();

    cy.intercept('GET', '**/api/status', {
      statusCode: 200,
      body: {
        status: 'operational',
        message: 'All systems operational. Last deploy 22 minutes ago.',
        services: {
          api: 'online',
          worker: 'online',
          database: 'online',
        },
        timestamp: new Date().toISOString(),
      },
    }).as('demoDashboardStatus');

    cy.intercept('GET', '**/api/ready', {
      statusCode: 200,
      body: {
        checks: {
          redis: { status: 'ok' },
          minio: { status: 'ok' },
        },
      },
    }).as('demoDashboardReady');

    cy.intercept('GET', '**/analyzers', {
      statusCode: 200,
      body: analyzers,
    }).as('demoDashboardAnalyzers');

    cy.intercept('GET', '**/portfolio*', {
      statusCode: 200,
      body: portfolio,
    }).as('demoPortfolioData');

    cy.intercept('GET', '**/organizations', {
      statusCode: 200,
      body: [
        {
          id: 'org-acme',
          name: 'Acme Corp',
          slug: 'acme-corp',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'org-contoso',
          name: 'Contoso Group',
          slug: 'contoso-group',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    cy.intercept('GET', `**/projects/${seed.projectKey}`, {
      statusCode: 200,
      body: overview.project,
    }).as('demoProjectData');
    cy.intercept('GET', `**/projects/${seed.projectKey}/analyses*`, {
      statusCode: 200,
      body: overview.analyses,
    }).as('demoProjectAnalyses');
    cy.intercept('GET', `**/analyses/${overview.latestAnalysisId}/quality-gate-status`, {
      statusCode: 200,
      body: overview.latestQualityGate,
    }).as('demoProjectGate');
    cy.intercept('GET', `**/analyses/${overview.latestAnalysisId}/summary`, {
      statusCode: 200,
      body: overview.latestSummary,
    }).as('demoProjectSummary');
    cy.intercept('GET', `**/projects/${seed.projectKey}/metrics*`, {
      statusCode: 200,
      body: overview.metrics,
    }).as('demoProjectMetrics');

    cy.showDemoStep('Dashboard Monitoring', 'Platform metrics are visible from the main dashboard');
    cy.visitAsAdmin('/dashboard');
    cy.wait('@demoDashboardStatus');
    cy.wait('@demoDashboardReady');
    cy.wait('@demoDashboardAnalyzers');
    cy.getByDataCyOr('dashboard-platform-status', '.status-card-wide').should('be.visible');
    cy.getByDataCyOr('dashboard-analyzers-catalog', '.analyzers-card').should('be.visible');
    cy.contains('All systems operational').should('be.visible');
    cy.get('[data-cy="dashboard-analyzer-eslint"]').should('be.visible');
    cy.captureDemoScreen('04-dashboard-platform-health');
    cy.demoPause(1000);

    cy.showDemoStep('Portfolio View', 'Cross-project status and trends are grouped in one table');
    cy.visitAsAdmin('/portfolio');
    cy.wait('@demoPortfolioData');
    cy.getByDataCyOr('portfolio-summary-projects', '.summary-cards .summary-card').should('be.visible');
    cy.getByDataCyOr('portfolio-table', '.portfolio-table').should('be.visible');
    cy.contains('Acme Storefront API').should('be.visible');
    cy.contains('Acme Payments Core').should('be.visible');
    cy.contains('87.3%').should('be.visible');
    cy.contains('74.6%').should('be.visible');
    cy.contains('❌ FAIL').should('be.visible');
    cy.contains('✅ PASS').should('be.visible');
    cy.captureDemoScreen('04-portfolio-overview-table');
    cy.getByDataCyOr('portfolio-toggle-filters', 'button').click();
    cy.demoPause(500);
    cy.contains('Quality Gate').should('be.visible');
    cy.get('select').first().select('Acme Corp');
    cy.get('button').contains('Apply').click();
    cy.captureDemoScreen('04-portfolio-filters');
    cy.demoPause(1000);

    cy.showDemoStep('Project Overview', 'Trend lines and latest quality gate support release decisions');
    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.wait('@demoProjectData');
    cy.wait('@demoProjectAnalyses');
    cy.wait('@demoProjectGate');
    cy.wait('@demoProjectSummary');
    cy.wait('@demoProjectMetrics');
    cy.get('[data-cy="project-tab-overview"]').click();
    cy.contains('Acme Storefront API').should('be.visible');
    cy.contains('Acme API Quality Gate').should('be.visible');
    cy.get('div.tab-content-wrapper').first().within(() => {
      cy.contains('anl-2026').should('be.visible');
    });
    cy.captureDemoScreen('04-project-overview-metrics');
    cy.get('[data-cy="project-tab-analyses"]').click();
    cy.get('[data-status="SUCCESS"]').should('be.visible');
    cy.get('[data-status="FAILED"]').should('be.visible');
    cy.captureDemoScreen('04-project-analyses-history');
    cy.get('[data-cy="project-tab-overview"]').click();
    cy.demoPause(1400);
  });
});
