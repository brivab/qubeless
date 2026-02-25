type QualityGateSeedData = {
  projectKey: string;
};

describe('Web E2E - Quality Gates', () => {
  let seed: QualityGateSeedData;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('edits and saves quality gate conditions from project settings', () => {
    cy.intercept('PUT', `**/projects/${seed.projectKey}/quality-gate`).as('saveQualityGate');

    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-quality-gate"]').length > 0) {
        cy.get('[data-cy="project-tab-quality-gate"]').click();
      } else {
        cy.contains('.main-tab-button', /Quality Gate|Seuils/i).click();
      }
    });

    cy.getByDataCyOr('quality-gate-name', '.quality-gate-tab input[type="text"]').should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="quality-gate-condition-0"]').length > 0) {
        cy.get('[data-cy="quality-gate-condition-0"]').within(() => {
          cy.get('input[type="number"]').clear().type('1');
        });
      } else {
        cy.get('.quality-gate-tab .conditions-row').not('.head').first().within(() => {
          cy.get('input[type="number"]').clear().type('1');
        });
      }
    });

    cy.getByDataCyOr('quality-gate-save', '.quality-gate-tab .primary-button').click();

    cy.wait('@saveQualityGate').its('response.statusCode').should('eq', 200);
  });
});
