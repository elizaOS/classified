/// <reference types="cypress" />

import { KnowledgeTestHelper } from './knowledge-helpers';
import { DatabaseTestHelper } from './database-helpers';

/**
 * Custom Cypress Commands
 * Provides reusable commands for common test operations
 */

// Add custom command types
declare global {
  namespace Cypress {
    interface Chainable {
      // Setup and Environment
      setupTestEnvironment(): Chainable<void>;
      waitForBackend(timeout?: number): Chainable<void>;
      clearTestData(): Chainable<void>;
      seedTestData(): Chainable<void>;
      bypassBoot(): Chainable<void>;
      setupApiKey(provider: 'openai' | 'anthropic', key: string): Chainable<void>;
      
      // UI Helpers
      elementExists(selector: string): Chainable<boolean>;
      safeClick(selector: string): Chainable<void>;
      
      // Knowledge Management
      uploadKnowledgeFile(fileName: string, content: string, fileType?: string): Chainable<any>;
      searchKnowledge(query: string, count?: number): Chainable<any[]>;
      deleteKnowledgeDocument(documentId: string): Chainable<void>;
      cleanupKnowledgeTests(): Chainable<void>;
      waitForDocumentProcessing(documentId: string, timeout?: number): Chainable<void>;
      
      // Capability Management
      toggleCapability(capability: string): Chainable<void>;
      getCapabilityStatus(capability: string): Chainable<boolean>;
      
      // Database Helpers
      authenticateDb(username?: string, password?: string): Chainable<string>;
      getDbTables(): Chainable<any[]>;
      cleanupDbTestRecords(tableName: string, searchPattern?: string): Chainable<void>;
    }
  }
}

// Initialize helpers
const knowledgeHelper = new KnowledgeTestHelper();
const dbHelper = new DatabaseTestHelper();

// Setup and Environment Commands
Cypress.Commands.add('setupTestEnvironment', () => {
  cy.log('Setting up test environment');
  cy.task('setupTestEnvironment');
});

Cypress.Commands.add('waitForBackend', (timeout = 30000) => {
  cy.log('Waiting for backend to be ready...');
  
  const checkBackend = (retries = 6) => {
    if (retries <= 0) {
      throw new Error('Backend failed to respond after 30 seconds');
    }
    
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false,
      timeout: 5000
    }).then((response) => {
      if (response.status === 200 && response.body.data?.status === 'healthy') {
        cy.log('✅ Backend is ready!');
      } else {
        cy.log(`⏳ Backend not ready (status: ${response.status}), retrying...`);
        cy.wait(5000);
        checkBackend(retries - 1);
      }
    });
  };
  
  checkBackend();
});

Cypress.Commands.add('clearTestData', () => {
  cy.log('Clearing test data');
  cy.task('clearTestData');
});

Cypress.Commands.add('seedTestData', () => {
  cy.log('Seeding test data');
  cy.task('seedTestData');
});

Cypress.Commands.add('bypassBoot', () => {
  cy.window().then((win) => {
    win.localStorage.setItem('skipBoot', 'true');
    win.localStorage.setItem('skipStartup', 'true');
  });
});

Cypress.Commands.add('setupApiKey', (provider: 'openai' | 'anthropic', key: string) => {
  cy.visit('/');
  cy.contains('ELIZA OS Configuration', { timeout: 40000 });
  
  if (provider === 'anthropic') {
    cy.get('select#modelProvider').select('anthropic');
    cy.get('input#anthropicKey').type(key);
  } else {
    cy.get('input#openaiKey').type(key);
  }
  
  cy.get('button').contains('Continue').click();
  cy.wait(3000);
});

// UI Helper Commands
Cypress.Commands.add('elementExists', (selector: string) => {
  cy.get('body').then($body => {
    return cy.wrap($body.find(selector).length > 0);
  });
});

Cypress.Commands.add('safeClick', (selector: string) => {
  cy.get(selector).should('be.visible').click({ force: true });
});

// Knowledge Management Commands
Cypress.Commands.add('uploadKnowledgeFile', (fileName: string, content: string, fileType?: string) => {
  return cy.wrap(knowledgeHelper.uploadFile(fileName, content, fileType || 'text/plain'));
});

Cypress.Commands.add('searchKnowledge', (query: string, count?: number) => {
  return cy.wrap(knowledgeHelper.search(query, count));
});

Cypress.Commands.add('deleteKnowledgeDocument', (documentId: string) => {
  return cy.wrap(knowledgeHelper.deleteDocument(documentId));
});

Cypress.Commands.add('cleanupKnowledgeTests', () => {
  return cy.wrap(knowledgeHelper.cleanupTestDocuments());
});

Cypress.Commands.add('waitForDocumentProcessing', (documentId: string, timeout?: number) => {
  return cy.wrap(knowledgeHelper.waitForDocumentProcessing(documentId, timeout));
});

// Capability Management Commands
Cypress.Commands.add('toggleCapability', (capability: string) => {
  const capabilityMap: Record<string, string> = {
    autonomy: 'autonomy-toggle',
    camera: 'camera-toggle',
    screen: 'screen-toggle',
    microphone: 'microphone-toggle',
    speaker: 'speakers-toggle',
    shell: 'shell-toggle',
    browser: 'browser-toggle'
  };
  
  const testId = capabilityMap[capability.toLowerCase()];
  if (testId) {
    cy.get(`[data-testid="${testId}"]`).click();
    cy.wait(1000); // Allow for API call
  } else {
    throw new Error(`Unknown capability: ${capability}`);
  }
});

Cypress.Commands.add('getCapabilityStatus', (capability: string) => {
  const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
  
  if (capability === 'autonomy') {
    return cy.request('GET', `${BACKEND_URL}/autonomy/status`)
      .then(response => response.body.data.enabled);
  } else {
    return cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/${capability}`)
      .then(response => response.body.data.enabled);
  }
});

// Database Helper Commands
Cypress.Commands.add('authenticateDb', (username?: string, password?: string) => {
  return dbHelper.authenticate(username, password);
});

Cypress.Commands.add('getDbTables', () => {
  return dbHelper.getTables();
});

Cypress.Commands.add('cleanupDbTestRecords', (tableName: string, searchPattern?: string) => {
  return dbHelper.cleanupTestRecords(tableName, searchPattern);
});

// Export for use in tests
export {};
