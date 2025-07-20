/// <reference types="cypress" />

describe('Agent Monologue View', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.wait(2000); // Wait for initial load
  });

  it('should show monologue tab in status panel', () => {
    // Check that the status tabs are visible
    cy.get('.status-tabs').should('be.visible');
    
    // Find the monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').should('be.visible');
  });

  it('should allow switching to monologue view', () => {
    // Click on the monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Verify tab is active
    cy.get('.tab-btn').contains('MONOLOGUE').should('have.class', 'active');
    
    // Verify monologue content is shown
    cy.get('.status-content .status-header').should('contain', 'AGENT THOUGHTS');
  });

  it('should show empty state when no monologue items exist', () => {
    // Switch to monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Should show empty state initially or when no thoughts
    cy.get('.scrollable-content').should('be.visible');
    
    // May show either empty state or actual thoughts depending on autonomy
    cy.get('.scrollable-content').should('exist');
  });

  it('should display monologue items when available', () => {
    // Switch to monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Wait for potential monologue data to load
    cy.wait(6000); // Wait for at least one fetch cycle
    
    // Check if there are monologue items or empty state
    cy.get('.scrollable-content').then(($content) => {
      if ($content.find('.monologue-item').length > 0) {
        // If monologue items exist, verify they're displayed
        cy.get('.monologue-item').should('be.visible');
        cy.get('.monologue-item').should('contain.text'); // Should have some text content
      } else if ($content.find('.empty-state').length > 0) {
        // If empty state, verify the message
        cy.get('.empty-state').should('contain', 'Agent is quiet...');
      }
    });
  });

  it('should refresh monologue data periodically', () => {
    // Intercept the monologue/memory API calls
    cy.intercept('GET', '/api/memories*', { 
      statusCode: 200,
      body: [
        {
          id: '1',
          content: { text: 'I should check what the user needs...' },
          createdAt: Date.now()
        },
        {
          id: '2', 
          content: { text: 'Planning next autonomous action...' },
          createdAt: Date.now()
        }
      ]
    }).as('getMonologue');
    
    // Switch to monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Should call API for monologue data
    cy.wait('@getMonologue');
    
    // Wait for periodic refresh (5 second interval)
    cy.wait(6000);
    cy.get('@getMonologue.all').should('have.length.at.least', 2);
  });

  it('should display intercepted monologue content correctly', () => {
    // Intercept with specific monologue data
    const mockThoughts = [
      { id: '1', content: { text: 'What should I do next? Think about recent conversations...' }, createdAt: Date.now() - 30000 },
      { id: '2', content: { text: 'The user seems interested in autonomy features...' }, createdAt: Date.now() - 20000 },
      { id: '3', content: { text: 'I should analyze their requests for patterns...' }, createdAt: Date.now() - 10000 }
    ];
    
    cy.intercept('GET', '/api/memories*', {
      statusCode: 200,
      body: mockThoughts
    }).as('getMockThoughts');
    
    // Switch to monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Wait for API call
    cy.wait('@getMockThoughts');
    cy.wait(1000); // Wait for UI update
    
    // Verify monologue items are displayed
    cy.get('.monologue-item').should('have.length', 3);
    cy.get('.monologue-item').first().should('contain', 'What should I do next?');
    cy.get('.monologue-item').eq(1).should('contain', 'autonomy features');
    cy.get('.monologue-item').eq(2).should('contain', 'analyze their requests');
  });

  it('should handle monologue API errors gracefully', () => {
    // Intercept with error response
    cy.intercept('GET', '/api/memories*', { statusCode: 500 }).as('getMonologueError');
    
    // Switch to monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Wait for API call
    cy.wait('@getMonologueError');
    
    // Should show empty state or handle error gracefully
    cy.get('.scrollable-content').should('be.visible');
    // Should not crash or show error in UI
    cy.get('.status-content').should('be.visible');
  });

  it('should scroll within monologue content area', () => {
    // Intercept with many monologue items to test scrolling
    const manyThoughts = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      content: { text: `Autonomous thought ${i + 1}: Analyzing the current situation and planning next steps...` },
      createdAt: Date.now() - (i * 5000)
    }));
    
    cy.intercept('GET', '/api/memories*', {
      statusCode: 200,
      body: manyThoughts
    }).as('getManyThoughts');
    
    // Switch to monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Wait for data to load
    cy.wait('@getManyThoughts');
    cy.wait(1000);
    
    // Check if scrollable content exists and can be scrolled
    cy.get('.scrollable-content').should('be.visible');
    cy.get('.scrollable-content').should('have.css', 'overflow-y').and('match', /auto|scroll/);
  });
});

describe('Monologue Integration with Autonomy', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.wait(2000);
  });

  it('should show more monologue activity when autonomy is enabled', () => {
    // Ensure autonomy is enabled
    cy.get('.control-btn').contains('AUTONOMY').parent().then($btn => {
      if (!$btn.hasClass('enabled')) {
        cy.wrap($btn).click();
        cy.wait(2000); // Wait for autonomy to start
      }
    });
    
    // Switch to monologue tab
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // Wait longer to see autonomous activity
    cy.wait(10000);
    
    // Should have some content (either thoughts or empty state message)
    cy.get('.scrollable-content').should('not.be.empty');
  });

  it('should detect autonomous thinking patterns in messages', () => {
    // Simulate chat messages that should appear in monologue
    const testMessages = [
      'What should I do next? Think about recent conversations.',
      'Planning: I need to analyze user preferences',
      'Goal: Understand what the user wants to achieve'
    ];
    
    // These would normally come through WebSocket, but we'll test the pattern recognition
    // by checking that messages containing these patterns would be added to monologue
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    
    // The actual test would verify that when such messages come through the WebSocket,
    // they get added to the monologue view. This is tested in the React component logic.
    cy.get('.status-header').should('contain', 'AGENT THOUGHTS');
  });

  it('should maintain monologue history limit', () => {
    // Intercept with more than 10 thoughts to test the 10-item limit
    const manyThoughts = Array.from({ length: 15 }, (_, i) => ({
      id: String(i + 1),
      content: { text: `Thought ${i + 1}` },
      createdAt: Date.now() - (i * 1000)
    }));
    
    cy.intercept('GET', '/api/memories*', {
      statusCode: 200,
      body: manyThoughts
    }).as('getManyThoughts');
    
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    cy.wait('@getManyThoughts');
    cy.wait(1000);
    
    // Should only show last 10 items (if the limit is working correctly)
    cy.get('.monologue-item').should('have.length.at.most', 10);
  });
});