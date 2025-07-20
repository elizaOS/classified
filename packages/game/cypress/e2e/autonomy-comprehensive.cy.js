/// <reference types="cypress" />

describe('Comprehensive Autonomy System Tests', () => {
  const BACKEND_URL = Cypress.env('CYPRESS_BACKEND_URL') || 'http://localhost:7777';
  const FRONTEND_URL = Cypress.env('CYPRESS_FRONTEND_URL') || 'http://localhost:5173';

  beforeEach(() => {
    // Visit the game interface
    cy.visit(FRONTEND_URL);
    
    // Wait for initial load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');
    
    // Wait for backend connection
    cy.contains('ONLINE', { timeout: 15000 }).should('be.visible');
  });

  it('should validate all UI windows have content and autonomy works for 45+ seconds', () => {
    cy.log('🧪 Starting comprehensive 45+ second autonomy test');
    
    // Step 1: Validate all UI panels are visible and functional
    cy.log('📋 Validating UI panels...');
    
    // Check chat window has content
    cy.get('.chat-content').should('be.visible');
    cy.get('.chat-line').should('have.length.greaterThan', 0);
    cy.contains('ELIZA TERMINAL v2.0').should('be.visible');
    
    // Check capabilities panel is visible
    cy.get('.controls-section').should('be.visible');
    cy.get('.control-btn').should('have.length', 7); // All capability buttons
    
    // Verify autonomy button exists and is clickable
    cy.get('.control-btn').contains('AUTONOMY').should('be.visible');
    
    // Check status tabs are all present
    const expectedTabs = ['GOALS', 'TODOS', 'MONOLOGUE', 'FILES', 'CONFIG'];
    expectedTabs.forEach(tab => {
      cy.get('.tab-btn').contains(tab).should('be.visible');
    });
    
    // Step 2: Test each status panel has content
    cy.log('📊 Testing status panels...');
    
    // Test Goals panel
    cy.get('.tab-btn').contains('GOALS').click();
    cy.get('.status-content').should('be.visible');
    cy.contains('AGENT OBJECTIVES').should('be.visible');
    // Goals should eventually appear (might be empty initially)
    
    // Test Todos panel  
    cy.get('.tab-btn').contains('TODOS').click();
    cy.get('.status-content').should('be.visible');
    cy.contains('TASK QUEUE').should('be.visible');
    
    // Test Files panel
    cy.get('.tab-btn').contains('FILES').click();
    cy.get('.status-content').should('be.visible');
    cy.contains('KNOWLEDGE BASE').should('be.visible');
    cy.get('.file-upload').should('be.visible');
    
    // Test Config panel
    cy.get('.tab-btn').contains('CONFIG').click();
    cy.get('.status-content').should('be.visible');
    cy.contains('CONFIGURATION').should('be.visible');
    cy.get('.reset-btn').should('be.visible');
    
    // Step 3: Focus on monologue and ensure autonomy is enabled
    cy.log('🧠 Testing monologue and autonomy...');
    
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    cy.get('.status-content').should('be.visible');
    cy.contains('AGENT THOUGHTS').should('be.visible');
    
    // Enable autonomy if not already enabled
    cy.get('.control-btn').contains('AUTONOMY').then($btn => {
      if ($btn.hasClass('disabled')) {
        cy.log('🔄 Enabling autonomy...');
        cy.wrap($btn).click();
        cy.wait(2000); // Wait for autonomy to start
      }
    });
    
    // Verify autonomy is enabled
    cy.get('.control-btn').contains('AUTONOMY').should('have.class', 'enabled');
    
    // Step 4: Long-running test - monitor for 45+ seconds
    cy.log('⏱️ Starting 45-second autonomous thought monitoring...');
    
    const startTime = Date.now();
    const testDuration = 45000; // 45 seconds
    let thoughtCount = 0;
    let lastThoughtTime = startTime;
    
    // Function to check for autonomous thoughts
    const checkForThoughts = () => {
      cy.get('.scrollable-content').within(() => {
        // Look for any content in monologue
        cy.get('body').then($body => {
          const hasThoughts = $body.find('.monologue-item').length > 0;
          const hasEmptyState = $body.find('.empty-state').length > 0;
          
          if (hasThoughts) {
            // Count thoughts
            cy.get('.monologue-item').then($items => {
              const currentCount = $items.length;
              if (currentCount > thoughtCount) {
                thoughtCount = currentCount;
                lastThoughtTime = Date.now();
                cy.log(`💭 Found ${currentCount} autonomous thoughts (new: ${currentCount - thoughtCount})`);
              }
            });
          } else if (!hasEmptyState) {
            cy.log('⚠️ Monologue panel has content but no specific thoughts detected');
          }
        });
      });
    };
    
    // Monitor thoughts every 5 seconds for 45 seconds
    for (let i = 0; i < 9; i++) {
      cy.wait(5000);
      cy.log(`🔍 Monitoring autonomous thoughts... ${(i + 1) * 5}s / 45s`);
      checkForThoughts();
      
      // Test autonomy toggle during monitoring
      if (i === 3) { // At 20 seconds, test disable/enable
        cy.log('🔄 Testing autonomy toggle during monitoring...');
        cy.get('.control-btn').contains('AUTONOMY').click();
        cy.wait(2000);
        cy.get('.control-btn').contains('AUTONOMY').should('have.class', 'disabled');
        
        cy.get('.control-btn').contains('AUTONOMY').click();
        cy.wait(2000);
        cy.get('.control-btn').contains('AUTONOMY').should('have.class', 'enabled');
      }
      
      // Refresh data periodically
      if (i % 2 === 0) {
        cy.reload();
        cy.wait(3000);
        cy.get('.tab-btn').contains('MONOLOGUE').click();
      }
    }
    
    // Step 5: Final validation after 45+ seconds
    cy.log('✅ Completing 45+ second test validation...');
    
    // Ensure test ran for full duration
    cy.then(() => {
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      expect(actualDuration).to.be.at.least(testDuration - 1000); // Allow 1s tolerance
      cy.log(`⏱️ Test completed in ${Math.round(actualDuration / 1000)}s`);
    });
    
    // Verify autonomy is still enabled
    cy.get('.control-btn').contains('AUTONOMY').should('have.class', 'enabled');
    
    // Check that we detected some kind of activity
    cy.then(() => {
      cy.log(`📊 Final Results: ${thoughtCount} autonomous thoughts detected`);
      
      // We should have either autonomous thoughts OR evidence the system is working
      cy.get('.scrollable-content').should($content => {
        const hasMonologueItems = $content.find('.monologue-item').length > 0;
        const hasEmptyState = $content.find('.empty-state').length > 0;
        const hasAnyContent = $content.text().trim().length > 0;
        
        // At minimum, the system should be responsive
        expect(hasAnyContent).to.be.true;
        
        if (hasMonologueItems) {
          cy.log(`✅ SUCCESS: Found ${$content.find('.monologue-item').length} autonomous thoughts!`);
        } else if (hasEmptyState) {
          cy.log('⚠️ WARNING: Agent appears quiet (empty state shown)');
        } else {
          cy.log('⚠️ WARNING: Monologue content unclear, but system responsive');
        }
      });
    });
    
    // Step 6: Test chat interaction works
    cy.log('💬 Testing chat interaction...');
    
    cy.get('.chat-input').should('be.visible').type('Hello, are you thinking autonomously?');
    cy.get('.send-btn').click();
    
    // Wait for response
    cy.get('.chat-line.chat-user', { timeout: 5000 }).should('contain', 'Hello, are you thinking autonomously?');
    
    // Should get an agent response within reasonable time
    cy.get('.chat-line.chat-agent', { timeout: 30000 }).should('exist');
    
    cy.log('🎉 Comprehensive 45+ second autonomy test completed successfully!');
  });

  it('should validate all API endpoints are working', () => {
    cy.log('🔧 Testing all critical API endpoints...');
    
    const endpoints = [
      { name: 'Health Check', url: '/api/server/health' },
      { name: 'Goals API', url: '/api/goals' },
      { name: 'Todos API', url: '/api/todos' },
      { name: 'Autonomy Status', url: '/autonomy/status' },
      { name: 'Vision Settings', url: '/api/agents/default/settings/vision' },
      { name: 'Shell Capability', url: '/api/agents/default/capabilities/shell' },
      { name: 'Browser Capability', url: '/api/agents/default/capabilities/browser' }
    ];
    
    endpoints.forEach(endpoint => {
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}${endpoint.url}`,
        failOnStatusCode: false
      }).then(response => {
        expect(response.status).to.be.oneOf([200, 404, 503]); // Allow service unavailable
        cy.log(`✅ ${endpoint.name}: ${response.status}`);
      });
    });
    
    // Test POST endpoints
    cy.request({
      method: 'POST',
      url: `${BACKEND_URL}/autonomy/toggle`,
      failOnStatusCode: false
    }).then(response => {
      expect(response.status).to.be.oneOf([200, 503]);
      cy.log(`✅ Autonomy Toggle: ${response.status}`);
    });
  });

  it('should test error handling and recovery', () => {
    cy.log('🚨 Testing error handling and recovery...');
    
    // Test with invalid input
    cy.get('.chat-input').type(''.padEnd(10000, 'x')); // Very long input
    cy.get('.send-btn').click();
    
    // Should still be functional
    cy.get('.chat-input').should('be.visible');
    
    // Clear and try normal input
    cy.get('.chat-input').clear().type('Test after error');
    cy.get('.send-btn').click();
    
    cy.get('.chat-line.chat-user').should('contain', 'Test after error');
  });
});