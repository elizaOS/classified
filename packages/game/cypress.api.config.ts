import { defineConfig } from 'cypress';

export default defineConfig({
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 30000,
  requestTimeout: 30000,
  responseTimeout: 30000,
  pageLoadTimeout: 60000,
  retries: {
    runMode: 2,
    openMode: 0
  },
  
  e2e: {
    // No baseUrl - we'll use absolute URLs in tests
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/api-only-*.cy.{js,jsx,ts,tsx}',
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // Add simple logging task
      on('task', {
        log(message: string) {
          console.log(message);
          return null;
        }
      });
    },
  },
});