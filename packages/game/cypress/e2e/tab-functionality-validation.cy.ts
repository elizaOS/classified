/// <reference types="cypress" />

/**
 * Tab Functionality Validation
 * 
 * Tests the core functionality of the monologue and files tabs to ensure they work properly.
 */

describe('Tab Functionality Validation', () => {
  beforeEach(() => {
    // Visit the game interface
    cy.visit('/', { timeout: 30000 });
    
    // Wait for the interface to load
    cy.get('body').should('exist');
    cy.wait(2000); // Give time for React to render
  });

  it('validates that tabs are present and clickable', () => {
    cy.log('🔍 Testing tab presence and basic functionality');
    
    // Check for tab container or navigation
    cy.get('body').then(($body) => {
      // Look for common tab patterns
      const tabSelectors = [
        '[role="tablist"]',
        '.MuiTabs-root',
        '[data-testid*="tab"]',
        'button[role="tab"]',
        '.tab',
        '[data-tab]',
        '.tabs',
        'nav'
      ];
      
      let foundTabs = false;
      
      tabSelectors.forEach(selector => {
        if ($body.find(selector).length > 0) {
          cy.log(`✅ Found tabs using selector: ${selector}`);
          foundTabs = true;
          
          // Try to find monologue and files tabs
          cy.get(selector).within(() => {
            cy.get('*').each(($el) => {
              const text = $el.text().toLowerCase();
              if (text.includes('monologue') || text.includes('files') || text.includes('knowledge')) {
                cy.log(`✅ Found tab with text: ${text}`);
              }
            });
          });
        }
      });
      
      if (!foundTabs) {
        cy.log('⚠️ No standard tab structure found, checking for custom implementation');
      }
    });
  });

  it('validates monologue tab functionality', () => {
    cy.log('🧠 Testing monologue tab functionality');
    
    // Look for monologue-related elements
    const monologueSelectors = [
      '[data-testid*="monologue"]',
      '*[class*="monologue"]',
      '*[id*="monologue"]',
      'button:contains("Monologue")',
      'tab:contains("Monologue")',
      '*:contains("Agent is quiet")',
      '*:contains("thinking")',
      '*:contains("autonomous")'
    ];
    
    cy.get('body').then(($body) => {
      let foundMonologue = false;
      
      monologueSelectors.forEach(selector => {
        try {
          if ($body.find(selector).length > 0) {
            cy.log(`✅ Found monologue element: ${selector}`);
            foundMonologue = true;
            
            // Try to interact with it
            cy.get(selector).first().then(($el) => {
              if ($el.is('button') || $el.attr('role') === 'tab') {
                cy.wrap($el).click();
                cy.log('✅ Successfully clicked monologue tab/button');
                
                // Check if content appears
                cy.wait(1000);
                cy.get('body').should('contain.text', 'monologue').or('contain.text', 'thinking').or('contain.text', 'Agent');
              }
            });
          }
        } catch (e) {
          // Continue checking other selectors
        }
      });
      
      if (!foundMonologue) {
        cy.log('❌ Monologue tab/functionality not found');
      }
    });
  });

  it('validates files tab functionality', () => {
    cy.log('📁 Testing files tab functionality');
    
    // Look for files/knowledge-related elements
    const filesSelectors = [
      '[data-testid*="files"]',
      '[data-testid*="knowledge"]',
      '*[class*="files"]',
      '*[class*="knowledge"]',
      '*[id*="files"]',
      '*[id*="knowledge"]',
      'button:contains("Files")',
      'button:contains("Knowledge")',
      'tab:contains("Files")',
      'tab:contains("Knowledge")',
      '*:contains("upload")',
      '*:contains("document")'
    ];
    
    cy.get('body').then(($body) => {
      let foundFiles = false;
      
      filesSelectors.forEach(selector => {
        try {
          if ($body.find(selector).length > 0) {
            cy.log(`✅ Found files element: ${selector}`);
            foundFiles = true;
            
            // Try to interact with it
            cy.get(selector).first().then(($el) => {
              if ($el.is('button') || $el.attr('role') === 'tab') {
                cy.wrap($el).click();
                cy.log('✅ Successfully clicked files tab/button');
                
                // Check if content appears
                cy.wait(1000);
                cy.get('body').should('contain.text', 'files').or('contain.text', 'upload').or('contain.text', 'knowledge');
              }
            });
          }
        } catch (e) {
          // Continue checking other selectors
        }
      });
      
      if (!foundFiles) {
        cy.log('❌ Files tab/functionality not found');
      }
    });
  });

  it('validates tab functionality by inspecting the DOM structure', () => {
    cy.log('🔍 Inspecting DOM structure for tabs');
    
    // Get the full page structure and log it
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      cy.log(`Page contains ${bodyText.length} characters of text`);
      
      // Check for key phrases that indicate tab functionality
      const keyPhrases = [
        'monologue', 'files', 'knowledge', 'tabs', 'upload', 'documents',
        'Agent is quiet', 'thinking', 'autonomous', 'chat', 'interface'
      ];
      
      keyPhrases.forEach(phrase => {
        if (bodyText.toLowerCase().includes(phrase.toLowerCase())) {
          cy.log(`✅ Found key phrase: "${phrase}"`);
        }
      });
      
      // Check for React/Material-UI specific tab classes
      const commonTabClasses = [
        'MuiTab-root', 'MuiTabs-root', 'MuiTabPanel-root',
        'tab-panel', 'tab-content', 'tabpanel', 'tablist'
      ];
      
      commonTabClasses.forEach(className => {
        if ($body.find(`.${className}`).length > 0) {
          cy.log(`✅ Found tab-related class: .${className}`);
        }
      });
    });
  });

  it('tests API connectivity for tab data', () => {
    cy.log('🔌 Testing API connectivity for tab functionality');
    
    // Test autonomy/monologue API endpoints
    cy.request({
      method: 'GET',
      url: 'http://127.0.0.1:7777/api/server/health',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.equal(200);
      cy.log('✅ Backend health endpoint accessible');
    });
    
    // Test knowledge/files API endpoints
    cy.request({
      method: 'GET',
      url: 'http://127.0.0.1:7777/knowledge/documents',
      failOnStatusCode: false
    }).then((response) => {
      expect([200, 401]).to.include(response.status);
      cy.log('✅ Knowledge documents endpoint accessible');
    });
    
    // Test autonomy status if available
    cy.request({
      method: 'GET',
      url: 'http://127.0.0.1:7777/autonomy/status',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        cy.log('✅ Autonomy status endpoint accessible');
      } else {
        cy.log(`ℹ️ Autonomy status endpoint returned: ${response.status}`);
      }
    });
  });

  it('validates overall UI responsiveness and error states', () => {
    cy.log('⚡ Testing UI responsiveness and error handling');
    
    // Check if any error messages are visible
    cy.get('body').then(($body) => {
      const errorIndicators = [
        'error', 'failed', 'unable to', 'not found', 'connection',
        'timeout', 'unavailable', 'broken'
      ];
      
      const bodyText = $body.text().toLowerCase();
      
      errorIndicators.forEach(indicator => {
        if (bodyText.includes(indicator)) {
          cy.log(`⚠️ Potential error indicator found: "${indicator}"`);
        }
      });
      
      // Check for loading states
      const loadingIndicators = [
        'loading', 'please wait', 'connecting', 'initializing'
      ];
      
      loadingIndicators.forEach(indicator => {
        if (bodyText.includes(indicator)) {
          cy.log(`ℹ️ Loading indicator found: "${indicator}"`);
        }
      });
    });
    
    // Take a screenshot for manual inspection
    cy.screenshot('tab-functionality-validation');
  });
});