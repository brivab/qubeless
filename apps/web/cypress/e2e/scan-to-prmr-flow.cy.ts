type ScanFlowSeedData = {
  projectKey: string;
};

describe('Web E2E - Scan to PR/MR Workflow', () => {
  let seed: ScanFlowSeedData;

  before(() => {
    cy.seedFeatureData().then((data) => {
      seed = data;
    });
  });

  it('shows scanner quickstart and VCS token prerequisites for PR/MR automation', () => {
    cy.visitAsAdmin(`/projects/${seed.projectKey}/quickstart`);
    cy.getByDataCyOr('quickstart-ci-vars', '.code-block').should('be.visible');
    cy.getByDataCyOr('quickstart-command', '.code-block').should('be.visible');

    cy.visitAsAdmin('/vcs-tokens');
    cy.getByDataCyOr('vcs-token-item-GITHUB', '.token-item').should('be.visible');
    cy.contains('PRs/MRs').should('be.visible');
  });
});
