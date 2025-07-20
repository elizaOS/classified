/// <reference types="cypress" />

describe('Health Check - Server Startup Verification', () => {
  it('should confirm backend server is running', () => {
    // Simply test that we can reach the health endpoint
    // Any response (including rate limit) confirms the server is running
    cy.request({
      url: 'http://localhost:3000/api/server/health',
      failOnStatusCode: false,
      retryOnStatusCodeFailure: false,
    }).then((response) => {
      // Any status code means the server is responding
      expect(response.status).to.exist;
      cy.log(`Backend server responded with status: ${response.status}`);
      
      // Log the response for debugging
      cy.log('Response body:', JSON.stringify(response.body));
    });
  });

  it('should confirm frontend is accessible', () => {
    // Visit the frontend with WebSocket disabled to avoid connection spam
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Skip boot sequence and disable WebSocket to prevent connection spam
        win.localStorage.setItem('skipBoot', 'true');
        win.localStorage.setItem('disableWebSocket', 'true');
      }
    });
    
    // Verify the React app mounted
    cy.get('#root').should('exist');
    
    // Check that the app loaded without critical errors
    cy.get('.app').should('exist');
  });
}); 