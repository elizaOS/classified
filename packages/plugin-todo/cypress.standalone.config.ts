import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // Use data URL to avoid server dependency for standalone tests
    baseUrl: 'data:text/html,<html><body><h1>Cypress Test Page</h1></body></html>',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/standalone-*.cy.{js,jsx,ts,tsx}',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    chromeWebSecurity: false,
  },
});
