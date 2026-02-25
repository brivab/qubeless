describe('Demo Video - 01 Auth and Navigation', () => {
  it('shows login protection and main navigation', () => {
    cy.showDemoStep('Authentication', 'Private pages redirect anonymous users to login');
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/projects');
    cy.location('pathname').should('eq', '/login');
    cy.getByDataCyOr('login-email', 'input#email').should('be.visible');
    cy.getByDataCyOr('login-password', 'input#password').should('be.visible');
    cy.captureDemoScreen('01-auth-login');
    cy.demoPause(1000);

    cy.showDemoStep('Admin Session', 'Dashboard and top-level navigation are available');
    cy.visitAsAdmin('/dashboard');
    cy.getByDataCyOr('nav-dashboard', 'a[href="/dashboard"]').should('be.visible');
    cy.getByDataCyOr('nav-projects', 'a[href="/projects"]').should('be.visible');
    cy.getByDataCyOr('nav-portfolio', 'a[href="/portfolio"]').should('be.visible');
    cy.getByDataCyOr('dashboard-section', 'section.card').should('be.visible');
    cy.captureDemoScreen('01-auth-dashboard-nav');
    cy.demoPause(1400);
  });
});
