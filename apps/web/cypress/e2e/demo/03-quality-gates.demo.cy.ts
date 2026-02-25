type DemoQualityGateSeed = {
  projectKey: string;
};

describe('Demo Video - 03 Quality Gates', () => {
  let seed: DemoQualityGateSeed;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows quality gate editing in project settings', () => {
    cy.intercept('PUT', `**/projects/${seed.projectKey}/quality-gate`).as('saveQualityGateDemo');

    cy.showDemoStep('Quality Gate', 'Policy thresholds are editable at project level');
    cy.visitAsAdmin(`/projects/${seed.projectKey}`);
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-tab-quality-gate"]').length > 0) {
        cy.get('[data-cy="project-tab-quality-gate"]').click();
      } else {
        cy.contains('.main-tab-button', /Quality Gate|Seuils/i).click();
      }
    });
    cy.getByDataCyOr('quality-gate-name', '.quality-gate-tab input[type="text"]').should('be.visible');
    cy.captureDemoScreen('03-quality-gate-editor');
    cy.demoPause(900);

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="quality-gate-condition-0"]').length > 0) {
        cy.get('[data-cy="quality-gate-condition-0"]').within(() => {
          cy.get('input[type="number"]').clear().type('2');
        });
      } else {
        cy.get('.quality-gate-tab .conditions-row').not('.head').first().within(() => {
          cy.get('input[type="number"]').clear().type('2');
        });
      }
    });
    cy.getByDataCyOr('quality-gate-save', '.quality-gate-tab .primary-button').click();
    cy.wait('@saveQualityGateDemo').its('response.statusCode').should('eq', 200);
    cy.captureDemoScreen('03-quality-gate-saved');
    cy.demoPause(1400);
  });
});
