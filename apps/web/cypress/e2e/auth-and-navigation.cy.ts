describe('Web E2E - Auth and Navigation', () => {
  it('protects private routes and displays the main navigation once authenticated', () => {
    cy.clearCookies();
    cy.clearLocalStorage();

    cy.visit('/projects');
    cy.location('pathname').should('eq', '/login');
    cy.getByDataCyOr('login-email', 'input#email').should('be.visible');
    cy.getByDataCyOr('login-password', 'input#password').should('be.visible');
    cy.getByDataCyOr('login-submit', 'button[type="submit"]').should('be.visible');

    cy.visitAsAdmin('/dashboard');
    cy.getByDataCyOr('nav-dashboard', 'a[href="/dashboard"]').should('be.visible');
    cy.getByDataCyOr('nav-projects', 'a[href="/projects"]').should('be.visible');
    cy.getByDataCyOr('nav-portfolio', 'a[href="/portfolio"]').should('be.visible');
    cy.getByDataCyOr('dashboard-section', 'section.card').should('be.visible');
  });
});
