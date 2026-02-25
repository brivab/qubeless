function normalizeApiUrl(rawUrl: string) {
  const trimmed = rawUrl.replace(/\/$/, '');
  if (trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

Cypress.Commands.add('visitAsAdmin', (path = '/dashboard') => {
  const apiUrl = normalizeApiUrl(String(Cypress.env('apiUrl') ?? 'http://localhost:3001/api'));
  const adminEmail = String(Cypress.env('adminEmail') ?? 'admin@example.com');
  const adminPassword = String(Cypress.env('adminPassword') ?? 'admin123');
  const sessionId = `admin:${apiUrl}:${adminEmail}`;

  cy.session(
    sessionId,
    () => {
      cy.task('getAdminAuth', {
        apiUrl,
        adminEmail,
        adminPassword,
      }).then((auth) => {
        const body = auth as { token: string; user: unknown };
        const authState = JSON.stringify({
          token: body.token,
          user: body.user ?? null,
        });

        cy.visit('/', {
          onBeforeLoad(win) {
            win.localStorage.setItem('qubeless_auth', authState);
            win.localStorage.setItem('qubeless.locale', 'en');
          },
        });
      });
    },
    {
      cacheAcrossSpecs: true,
    },
  );

  // Always load the app shell from root to avoid server-side route collisions (e.g. /admin/*).
  cy.visit('/');
  if (path !== '/') {
    cy.window().then((win) => {
      if (win.location.pathname !== path) {
        win.history.pushState({}, '', path);
        win.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  }
});

Cypress.Commands.add('seedFeatureData', () => {
  return cy.task('seedFeatureData', {
    apiUrl: Cypress.env('apiUrl'),
    adminEmail: Cypress.env('adminEmail'),
    adminPassword: Cypress.env('adminPassword'),
    force: true,
  });
});

Cypress.Commands.add('getByDataCyOr', (dataCy: string, fallbackSelector: string) => {
  return cy.get('body').then(($body) => {
    if ($body.find(`[data-cy="${dataCy}"]`).length > 0) {
      return cy.get(`[data-cy="${dataCy}"]`);
    }
    return cy.get(fallbackSelector);
  });
});

Cypress.Commands.add('clickByDataCyOr', (dataCy: string, fallbackSelector: string) => {
  return cy.getByDataCyOr(dataCy, fallbackSelector).first().click();
});

Cypress.Commands.add('demoPause', (ms = 900) => {
  cy.wait(ms, { log: false });
});

Cypress.Commands.add('showDemoStep', (title: string, subtitle?: string, pauseMs = 1200) => {
  cy.window().then((win) => {
    const doc = win.document;
    const existing = doc.getElementById('cypress-demo-overlay');
    if (existing) {
      existing.remove();
    }

    const overlay = doc.createElement('div');
    overlay.id = 'cypress-demo-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '24px';
    overlay.style.bottom = '24px';
    overlay.style.zIndex = '2147483647';
    overlay.style.maxWidth = '620px';
    overlay.style.padding = '14px 18px';
    overlay.style.borderRadius = '12px';
    overlay.style.background = 'rgba(13, 18, 28, 0.86)';
    overlay.style.color = '#f4f7fb';
    overlay.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.35)';
    overlay.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    overlay.style.pointerEvents = 'none';
    overlay.innerHTML = subtitle
      ? `<div style="font-size:18px;font-weight:700;line-height:1.3;">${title}</div><div style="font-size:14px;opacity:0.9;margin-top:4px;line-height:1.4;">${subtitle}</div>`
      : `<div style="font-size:18px;font-weight:700;line-height:1.3;">${title}</div>`;

    doc.body.appendChild(overlay);
  });

  cy.wait(pauseMs, { log: false });
});

Cypress.Commands.add('captureDemoScreen', (screenId: string, pauseMs = 350) => {
  let previousTheme: 'light' | 'dark' = 'light';
  const applyTheme = (theme: 'light' | 'dark') => {
    cy.window().then((win) => {
      win.localStorage.setItem('theme', theme);
      win.document.documentElement.setAttribute('data-theme', theme);
    });
    cy.wait(180, { log: false });
  };

  cy.viewport(1920, 1080);
  cy.get('body').should('be.visible');
  cy.window().then((win) => {
    if (win.innerWidth !== 1920 || win.innerHeight !== 1080) {
      throw new Error(
        `Viewport is ${win.innerWidth}x${win.innerHeight}; expected 1920x1080. Run demo in headless mode with Chromium launch window >= 1920x1080.`,
      );
    }
  });
  cy.window().then((win) => {
    const doc = win.document;
    const existing = doc.getElementById('cypress-demo-hide-scrollbars');
    if (existing) {
      existing.remove();
    }

    const style = doc.createElement('style');
    style.id = 'cypress-demo-hide-scrollbars';
    style.textContent = `
      html, body {
        overflow: hidden !important;
      }
      * {
        scrollbar-width: none !important;
      }
      *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `;
    doc.head.appendChild(style);
  });
  cy.wait(200, { log: false });
  cy.window().then((win) => {
    const currentTheme = win.document.documentElement.getAttribute('data-theme') ?? win.localStorage.getItem('theme');
    previousTheme = currentTheme === 'dark' ? 'dark' : 'light';
  });

  applyTheme('light');
  cy.screenshot(`demo/${screenId}-light`, {
    capture: 'viewport',
    overwrite: true,
  });

  applyTheme('dark');
  cy.screenshot(`demo/${screenId}-dark`, {
    capture: 'viewport',
    overwrite: true,
  });
  applyTheme(previousTheme);

  cy.window().then((win) => {
    win.document.getElementById('cypress-demo-hide-scrollbars')?.remove();
  });
  cy.wait(pauseMs, { log: false });
});
