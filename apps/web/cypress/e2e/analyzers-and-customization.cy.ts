type AnalyzerSeedData = {
  projectKey: string;
  analyzerKey: string;
};

describe('Web E2E - Modular and Custom Analyzers', () => {
  let seed: AnalyzerSeedData;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows analyzer inventory and allows project-level analyzer configuration', () => {
    cy.visitAsAdmin('/admin/analyzers');
    cy.getByDataCyOr('admin-analyzers-search', '.search-input').clear().type(seed.analyzerKey);
    cy.get('body').then(($body) => {
      if ($body.find(`[data-cy="admin-analyzer-card-${seed.analyzerKey}"]`).length > 0) {
        cy.get(`[data-cy="admin-analyzer-card-${seed.analyzerKey}"]`).should('be.visible');
      } else {
        cy.contains('.analyzer-card', seed.analyzerKey).should('be.visible');
      }
    });

    cy.intercept('PUT', `**/projects/${seed.projectKey}/analyzers/${seed.analyzerKey}`).as('saveAnalyzer');

    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-analyzers"]').length > 0) {
        cy.get('[data-cy="project-tab-analyzers"]').click();
      } else {
        cy.contains('.main-tab-button', /Analyzers/i).click();
      }
    });

    cy.get('body').then(($body) => {
      if ($body.find(`[data-cy="project-analyzer-card-${seed.analyzerKey}"]`).length > 0) {
        cy.get(`[data-cy="project-analyzer-config-${seed.analyzerKey}"]`)
          .clear()
          .type('{"threshold": 12}', { parseSpecialCharSequences: false });
        cy.get(`[data-cy="project-analyzer-save-${seed.analyzerKey}"]`).click();
      } else {
        cy.contains('.analyzer-card', seed.analyzerKey).within(() => {
          cy.get('textarea').first().clear().type('{"threshold": 12}', { parseSpecialCharSequences: false });
          cy.contains('button', /^Save$/).click();
        });
      }
    });

    cy.wait('@saveAnalyzer').its('response.statusCode').should('eq', 200);
  });
});
