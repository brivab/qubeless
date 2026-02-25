import { defineConfig } from 'cypress';
import { getAdminAuth, purgeCypressSqlData, seedFeatureData } from './cypress/tasks/seed';

export default defineConfig({
  video: true,
  videosFolder: 'cypress/videos',
  screenshotOnRunFailure: true,
  screenshotsFolder: 'cypress/screenshots',
  viewportWidth: 1440,
  viewportHeight: 900,
  retries: {
    runMode: 1,
    openMode: 0,
  },
  env: {
    apiUrl: process.env.CYPRESS_API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:3001/api',
    adminEmail: process.env.CYPRESS_ADMIN_EMAIL ?? 'admin@example.com',
    adminPassword: process.env.CYPRESS_ADMIN_PASSWORD ?? 'admin123',
  },
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:8081',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium') {
          launchOptions.args.push('--window-size=1920,1300');
          launchOptions.args.push('--force-device-scale-factor=1');
          launchOptions.args.push('--hide-scrollbars');
        }
        return launchOptions;
      });

      on('task', {
        async seedFeatureData(options?: {
          apiUrl?: string;
          adminEmail?: string;
          adminPassword?: string;
          force?: boolean;
        }) {
          return seedFeatureData(options);
        },
        async getAdminAuth(options?: {
          apiUrl?: string;
          adminEmail?: string;
          adminPassword?: string;
        }) {
          return getAdminAuth(options);
        },
      });

      on('after:run', async () => {
        const output = await purgeCypressSqlData();
        if (output) {
          console.log('[cypress-purge] SQL cleanup summary:\n' + output);
        }
      });
    },
  },
});
