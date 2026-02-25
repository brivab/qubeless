type DemoQuickstartSeed = {
  projectKey: string;
};

describe('Demo Video - 05 Quickstart and PR/MR Flow', () => {
  let seed: DemoQuickstartSeed;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows scanner quickstart and VCS prerequisites', () => {
    cy.showDemoStep('Scanner Quickstart', 'Ready-to-copy CI variables and scanner command');
    cy.visitAsAdmin(`/projects/${seed.projectKey}/quickstart`);
    cy.getByDataCyOr('quickstart-ci-vars', '.code-block').should('be.visible');
    cy.getByDataCyOr('quickstart-command', '.code-block').should('be.visible');
    cy.captureDemoScreen('05-quickstart');
    cy.demoPause(1100);

    cy.showDemoStep('VCS Tokens', 'PR/MR automation is enabled by repository provider tokens');
    cy.visitAsAdmin('/vcs-tokens');
    cy.getByDataCyOr('vcs-token-item-GITHUB', '.token-item').should('be.visible');
    cy.contains('PRs/MRs').should('be.visible');
    cy.captureDemoScreen('05-vcs-tokens');
    cy.demoPause(1400);
  });
});
