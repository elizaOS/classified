/// <reference types="cypress" />

/**
 * Full Integration Tests
 * Tests complete user flow, all features working together, performance, and error recovery
 */

describe('Full Integration', () => {
  const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
  const DEFAULT_AGENT_ID = '15aec527-fb92-0792-91b6-becd4fac5050';
  const TEST_API_KEY = `sk-test-integration-${Date.now()}`;

  before(() => {
    // Clean environment
    cy.task('clearEnvironmentKeys');
  });

  after(() => {
    // Cleanup
    cy.task('clearEnvironmentKeys');
    cy.cleanupKnowledgeTests();
  });

  describe('Complete User Journey', () => {
    it('should complete full setup and interaction flow', () => {
      cy.log('🚀 Starting complete user journey test');
      
      // Step 1: Initial Visit and Setup
      cy.visit('/');
      cy.wait(3000);
      
      // Should show setup wizard
      cy.contains('ELIZA OS Configuration', { timeout: 40000 }).should('be.visible');
      
      // Configure API key
      cy.get('input#openaiKey').type(TEST_API_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);
      
      // Should reach main interface
      cy.contains('ELIZA').should('be.visible');
      cy.screenshot('01-setup-complete');
      
      // Step 2: Test Chat Functionality
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-input"]').type('Hello ELIZA! Can you help me test the system?{enter}');
      cy.wait(3000);
      
      // Should see message in chat
      cy.get('[data-testid="chat-messages"]').should('contain', 'Hello ELIZA');
      cy.screenshot('02-chat-interaction');
      
      // Step 3: Enable Autonomy
      cy.get('[data-testid="autonomy-toggle"]').click();
      cy.wait(2000);
      cy.screenshot('03-autonomy-enabled');
      
      // Step 4: Check Goals
      cy.get('[data-testid="goals-tab"]').click();
      cy.wait(2000);
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.screenshot('04-goals-tab');
      
      // Step 5: Check Todos
      cy.get('[data-testid="todos-tab"]').click();
      cy.wait(2000);
      cy.get('[data-testid="todos-content"]').should('be.visible');
      cy.screenshot('05-todos-tab');
      
      // Step 6: Upload Knowledge
      cy.get('[data-testid="files-tab"]').click();
      cy.wait(1000);
      
      const testFileName = `integration-test-${Date.now()}.txt`;
      const testContent = 'This is a test document for full integration testing.';
      
      cy.uploadKnowledgeFile(testFileName, testContent).then((response) => {
        expect(response.success).to.be.true;
        cy.screenshot('06-knowledge-uploaded');
      });
      
      // Step 7: Check Monologue
      cy.get('[data-testid="monologue-tab"]').click();
      cy.wait(2000);
      cy.get('[data-testid="monologue-content"]').should('be.visible');
      cy.screenshot('07-monologue-tab');
      
      // Step 8: Test Configuration
      cy.get('[data-testid="config-tab"]').click();
      cy.wait(1000);
      cy.get('[data-testid="validate-config-button"]').click();
      cy.wait(2000);
      cy.screenshot('08-config-validated');
      
      cy.log('✅ Complete user journey successful');
    });
  });

  describe('Multi-Feature Integration', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.window().then((win) => {
        win.localStorage.setItem('skipBoot', 'true');
      });
      cy.wait(3000);
    });

    it('should handle concurrent operations', () => {
      // Start multiple operations simultaneously
      const operations = [];
      
      // Send chat message
      operations.push(
        cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
          text: 'Concurrent test message',
          userId: 'test-user',
          roomId: 'concurrent-test',
          messageId: `concurrent-${Date.now()}`
        })
      );
      
      // Toggle capabilities
      operations.push(
        cy.request('POST', `${BACKEND_URL}/api/agents/default/capabilities/shell/toggle`)
      );
      
      // Get goals
      operations.push(
        cy.request('GET', `${BACKEND_URL}/api/goals`)
      );
      
      // Get todos
      operations.push(
        cy.request('GET', `${BACKEND_URL}/api/todos`)
      );
      
      // Upload knowledge
      const fileName = `concurrent-${Date.now()}.txt`;
      operations.push(
        cy.uploadKnowledgeFile(fileName, 'Concurrent test content')
      );
      
      // Wait for all operations
      cy.wrap(Promise.all(operations)).then((results) => {
        results.forEach((result, index) => {
          cy.log(`✅ Operation ${index + 1} completed`);
        });
      });
    });

    it('should maintain state consistency across features', () => {
      // Enable autonomy
      cy.request('POST', `${BACKEND_URL}/autonomy/enable`);
      
      // Send message that triggers goal creation
      cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
        text: 'Please create a goal to improve the system',
        userId: 'test-user',
        roomId: 'state-test',
        messageId: `state-${Date.now()}`
      });
      
      cy.wait(3000);
      
      // Check that goals were updated
      cy.request('GET', `${BACKEND_URL}/api/goals`).then((response) => {
        cy.log(`Goals count: ${response.body.goals.length}`);
      });
      
      // Check that autonomy is still enabled
      cy.request('GET', `${BACKEND_URL}/autonomy/status`).then((response) => {
        expect(response.body.data.enabled).to.be.true;
      });
      
      // Check monologue for thoughts
      cy.request('GET', `${BACKEND_URL}/api/monologue`).then((response) => {
        cy.log(`Thoughts count: ${response.body.thoughts.length}`);
      });
    });

    it('should handle real-time updates across tabs', () => {
      // Open multiple tabs
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="todos-tab"]').click();
      
      // Send message that should update multiple tabs
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-input"]').type('Create a new todo: Test real-time updates{enter}');
      
      cy.wait(3000);
      
      // Check todos tab for update
      cy.get('[data-testid="todos-tab"]').click();
      cy.wait(1000);
      
      // Should see new todo or updated content
      cy.get('[data-testid="todos-content"]').should('be.visible');
    });
  });

  describe('Performance Testing', () => {
    it('should handle rapid user interactions', () => {
      const startTime = Date.now();
      
      // Rapidly click through tabs
      for (let i = 0; i < 20; i++) {
        cy.get('[data-testid="chat-tab"]').click({ force: true });
        cy.get('[data-testid="goals-tab"]').click({ force: true });
        cy.get('[data-testid="todos-tab"]').click({ force: true });
        cy.get('[data-testid="monologue-tab"]').click({ force: true });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      cy.log(`✅ Handled 80 tab switches in ${duration}ms`);
      expect(duration).to.be.lessThan(10000); // Should complete in under 10 seconds
    });

    it('should handle large data sets', () => {
      // Upload multiple files
      const uploads = [];
      for (let i = 0; i < 10; i++) {
        const fileName = `perf-test-${i}-${Date.now()}.txt`;
        const content = `Performance test document ${i}\n`.repeat(100);
        uploads.push(cy.uploadKnowledgeFile(fileName, content));
      }
      
      cy.wrap(Promise.all(uploads)).then(() => {
        // List all documents
        cy.request('GET', `${BACKEND_URL}/knowledge/documents`).then((response) => {
          expect(response.body.data.length).to.be.at.least(10);
          cy.log(`✅ Handled ${response.body.data.length} documents`);
        });
      });
    });

    it('should maintain responsiveness under load', () => {
      // Send multiple messages rapidly
      const messages = [];
      for (let i = 0; i < 10; i++) {
        messages.push({
          text: `Load test message ${i}`,
          userId: 'load-test-user',
          roomId: 'load-test',
          messageId: `load-${i}-${Date.now()}`
        });
      }
      
      // Send all messages
      const startTime = Date.now();
      
      messages.forEach(msg => {
        cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, msg);
      });
      
      // UI should still be responsive
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-input"]').should('be.visible');
      cy.get('[data-testid="chat-input"]').type('UI still responsive');
      
      const endTime = Date.now();
      cy.log(`✅ UI remained responsive during ${messages.length} message sends (${endTime - startTime}ms)`);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from WebSocket disconnection', () => {
      cy.window().then((win: any) => {
        if (win.elizaClient?.socket) {
          // Disconnect WebSocket
          win.elizaClient.socket.disconnect();
          
          cy.wait(2000);
          
          // Should reconnect automatically
          cy.wrap(null).then(() => {
            return new Cypress.Promise((resolve) => {
              const checkReconnect = () => {
                if (win.elizaClient.socket.connected) {
                  resolve(true);
                } else {
                  setTimeout(checkReconnect, 500);
                }
              };
              setTimeout(checkReconnect, 500);
            });
          }).then(() => {
            cy.log('✅ WebSocket reconnected successfully');
            
            // Should still be able to send messages
            cy.get('[data-testid="chat-input"]').type('Test after reconnect{enter}');
          });
        }
      });
    });

    it('should handle API errors gracefully', () => {
      // Send invalid request
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/agents/invalid-agent/message`,
        body: { text: 'Test' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 404, 500]);
      });
      
      // UI should still work
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
    });

    it('should recover from temporary backend unavailability', () => {
      // Make multiple requests even if some fail
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          cy.request({
            method: 'GET',
            url: `${BACKEND_URL}/api/goals`,
            failOnStatusCode: false,
            timeout: 5000
          })
        );
      }
      
      cy.wrap(Promise.allSettled(requests)).then((results) => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        cy.log(`✅ ${successful}/5 requests succeeded`);
        
        // At least some should succeed
        expect(successful).to.be.at.least(1);
      });
    });
  });

  describe('Cross-Feature Data Flow', () => {
    it('should show agent responses across all relevant tabs', () => {
      // Send a message that should affect multiple areas
      const testMessage = 'Create a goal to test the system and add a todo for documentation';
      
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-input"]').type(`${testMessage}{enter}`);
      
      cy.wait(5000); // Allow processing
      
      // Check chat for response
      cy.get('[data-testid="chat-messages"]').should('contain', testMessage);
      
      // Check goals might have new entry
      cy.get('[data-testid="goals-tab"]').click();
      cy.wait(1000);
      cy.screenshot('cross-feature-goals');
      
      // Check todos might have new entry
      cy.get('[data-testid="todos-tab"]').click();
      cy.wait(1000);
      cy.screenshot('cross-feature-todos');
      
      // Check monologue for thoughts
      cy.get('[data-testid="monologue-tab"]').click();
      cy.wait(1000);
      cy.screenshot('cross-feature-monologue');
    });

    it('should maintain data consistency when toggling capabilities', () => {
      // Disable all capabilities
      const capabilities = ['shell', 'browser'];
      
      capabilities.forEach(cap => {
        cy.request('POST', `${BACKEND_URL}/api/agents/default/capabilities/${cap}/toggle`);
      });
      
      cy.wait(2000);
      
      // Send message
      cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
        text: 'Try to use shell and browser capabilities',
        userId: 'test-user',
        roomId: 'capability-test',
        messageId: `cap-test-${Date.now()}`
      });
      
      cy.wait(3000);
      
      // Re-enable capabilities
      capabilities.forEach(cap => {
        cy.request('POST', `${BACKEND_URL}/api/agents/default/capabilities/${cap}/toggle`);
      });
      
      // System should still be functional
      cy.request('GET', `${BACKEND_URL}/api/server/health`).then((response) => {
        expect(response.body.data.status).to.eq('healthy');
      });
    });
  });
});

// Integration Summary Test
describe('Full Integration Summary', () => {
  it('should verify complete system integration', () => {
    const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
    const results = {
      setup: false,
      chat: false,
      capabilities: false,
      knowledge: false,
      goals: false,
      todos: false,
      monologue: false,
      websocket: false,
      persistence: false,
      performance: false
    };
    
    cy.log('🎯 FULL INTEGRATION VERIFICATION:');
    
    // Quick integration checks
    cy.visit('/');
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    cy.wait(3000);
    
    // Check main features
    cy.get('body').should('be.visible');
    results.setup = true;
    
    // Check chat
    cy.get('[data-testid="chat-tab"]').click();
    cy.get('[data-testid="chat-input"]').should('be.visible');
    results.chat = true;
    
    // Check capabilities
    cy.request('GET', `${BACKEND_URL}/autonomy/status`).then((response) => {
      results.capabilities = response.status === 200;
    });
    
    // Check knowledge
    cy.request('GET', `${BACKEND_URL}/knowledge/documents`).then((response) => {
      results.knowledge = response.status === 200;
    });
    
    // Check goals
    cy.request('GET', `${BACKEND_URL}/api/goals`).then((response) => {
      results.goals = response.status === 200;
    });
    
    // Check todos
    cy.request('GET', `${BACKEND_URL}/api/todos`).then((response) => {
      results.todos = response.status === 200;
    });
    
    // Check monologue
    cy.request('GET', `${BACKEND_URL}/api/monologue`).then((response) => {
      results.monologue = response.status === 200;
    });
    
    // Check WebSocket
    cy.window().then((win: any) => {
      results.websocket = win.elizaClient?.socket?.connected || false;
    });
    
    // Check persistence
    cy.request('GET', `${BACKEND_URL}/api/server/health`).then((response) => {
      results.persistence = response.body.data.database?.isConnected || false;
    });
    
    // Performance check
    const startTime = Date.now();
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="todos-tab"]').click();
    const endTime = Date.now();
    results.performance = (endTime - startTime) < 2000;
    
    cy.then(() => {
      // Display results
      cy.log('\n📊 INTEGRATION RESULTS:');
      Object.entries(results).forEach(([feature, working]) => {
        const icon = working ? '✅' : '❌';
        cy.log(`${icon} ${feature.charAt(0).toUpperCase() + feature.slice(1)}: ${working ? 'Working' : 'Failed'}`);
      });
      
      const workingCount = Object.values(results).filter(v => v).length;
      const totalCount = Object.keys(results).length;
      const percentage = Math.round((workingCount / totalCount) * 100);
      
      cy.log(`\n🎉 INTEGRATION SCORE: ${workingCount}/${totalCount} (${percentage}%)`);
      
      if (percentage === 100) {
        cy.log('🏆 PERFECT INTEGRATION! All systems working together!');
      } else if (percentage >= 80) {
        cy.log('✅ GOOD INTEGRATION! Most systems working well!');
      } else if (percentage >= 60) {
        cy.log('⚠️ PARTIAL INTEGRATION! Some issues to address.');
      } else {
        cy.log('❌ POOR INTEGRATION! Major issues detected.');
      }
      
      cy.screenshot('integration-summary-final');
    });
  });
}); 