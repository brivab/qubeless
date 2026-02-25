type MetricsSeedData = {
  projectKey: string;
  projectName: string;
};

describe('Web E2E - Metrics and Portfolio', () => {
  let seed: MetricsSeedData;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows metrics surfaces on dashboard, portfolio, and project overview', () => {
    cy.visitAsAdmin('/dashboard');
    cy.getByDataCyOr('dashboard-platform-status', '.status-card-wide').should('be.visible');
    cy.getByDataCyOr('dashboard-analyzers-catalog', '.analyzers-card').should('be.visible');

    cy.visitAsAdmin('/portfolio');
    cy.getByDataCyOr('portfolio-summary-projects', '.summary-cards .summary-card').should('be.visible');
    cy.getByDataCyOr('portfolio-table', '.portfolio-table').should('be.visible');
    cy.contains(seed.projectKey).should('be.visible');

    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-overview"]').length > 0) {
        cy.get('[data-cy="project-tab-overview"]').should('have.class', 'active');
      } else {
        cy.contains('.main-tab-button.active', /Overview|Vue d'ensemble/i).should('be.visible');
      }
    });
    cy.contains(seed.projectName).should('be.visible');
  });
});
