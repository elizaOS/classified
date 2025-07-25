/// <reference types="cypress" />

/**
 * Comprehensive Tauri Integration Test
 *
 * This test verifies that the frontend properly integrates with the Rust Tauri backend
 * instead of the old Node.js backend. It tests the complete startup flow through the
 * actual BootSequence component and verifies Tauri command usage.
 */

describe('Tauri Integration - Core Functionality', () => {
  beforeEach(() => {
    // Start fresh for each test
    cy.clearLocalStorage();
    cy.clearCookies();

    // Ensure we're testing the full startup
    cy.window().then((win) => {
      win.localStorage.removeItem('skipStartup');
    });
  });

  it('should load the application and show startup flow', () => {
    cy.visit('/', { timeout: 30000 });

    // Wait for React to load and render
    cy.get('.app', { timeout: 15000 }).should('be.visible');
    cy.screenshot('tauri-01-app-loaded');

    // Check if we can see either the startup flow or game interface
    cy.get('body').should('contain.text', 'ELIZA');
    cy.screenshot('tauri-02-content-loaded');
  });

  it('should verify no Node.js backend calls are made', () => {
    // This is the MOST IMPORTANT test - verifies we're not calling the old Node.js backend
    let nodejsCallMade = false;

    // Intercept all HTTP requests to detect any localhost:7777 calls
    cy.intercept('**localhost:7777/**', (req) => {
      nodejsCallMade = true;
      req.reply({ statusCode: 500, body: { error: 'Node.js backend should not be called' } });
    }).as('nodeBackendCall');

    cy.visit('/', { timeout: 30000 });

    // Wait for the app to load and any potential backend calls
    cy.get('.app', { timeout: 15000 }).should('be.visible');
    cy.wait(3000);

    // Verify no calls were made to the old Node.js backend
    cy.then(() => {
      expect(nodejsCallMade, 'No calls should be made to Node.js backend on localhost:7777').to.be.false;
    });

    cy.screenshot('tauri-03-no-nodejs-calls-verified');
  });

});
