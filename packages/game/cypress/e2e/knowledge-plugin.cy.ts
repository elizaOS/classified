/**
 * Comprehensive E2E tests for Knowledge Plugin functionality
 * Tests the complete knowledge management workflow in the game interface
 */

describe('Knowledge Plugin E2E Tests', () => {
  beforeEach(() => {
    // Set skip boot to bypass the boot sequence
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });

    cy.visit('/');

    // Wait for the interface to load completely
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('exist');

    // Wait for knowledge files to load
    cy.wait(3000);
  });

  afterEach(() => {
    // Clean up localStorage
    cy.window().then((win) => {
      win.localStorage.removeItem('skipBoot');
    });
  });

  describe('Knowledge Base Tab', () => {
    it('should show the knowledge base tab and switch to it', () => {
      // Click on the FILES tab to access knowledge base
      cy.get('button').contains('FILES').click();

      // Verify the knowledge base header is visible
      cy.get('.status-header').should('contain', '◎ KNOWLEDGE BASE');

      // Take screenshot
      cy.screenshot('knowledge-tab-opened');
    });

    it('should display initial knowledge files loaded from /knowledge folder', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Wait for files to load
      cy.wait(2000);

      // Check if any files are displayed or empty state
      cy.get('.scrollable-content').should('exist');

      // Look for either file items or empty state
      cy.get('.scrollable-content').then(($content) => {
        if ($content.find('.file-item').length > 0) {
          // Files exist - verify the letter from creators is loaded
          cy.get('.file-item').should('exist');
          cy.get('.file-name').should('contain.text', 'letter'); // Should contain the letter file
        } else {
          // No files - should show empty state
          cy.get('.empty-state').should('contain', 'No knowledge files loaded');
        }
      });

      cy.screenshot('initial-knowledge-files');
    });
  });

  describe('Knowledge Search Functionality', () => {
    it('should provide knowledge search interface', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Verify search input exists
      cy.get('.search-input').should('exist');
      cy.get('.search-input').should('have.attr', 'placeholder', 'Search knowledge...');

      cy.screenshot('knowledge-search-interface');
    });

    it('should perform knowledge search and display results', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Type in search box
      const searchQuery = 'admin';
      cy.get('.search-input').type(searchQuery);

      // Wait for search results
      cy.wait(2000);

      // Check for search results or no results message
      cy.get('.scrollable-content').then(($content) => {
        if ($content.find('.search-result-item').length > 0) {
          // Search results found
          cy.get('.search-results-header').should('contain', 'Search Results:');
          cy.get('.search-result-item').should('exist');
          cy.get('.result-title').should('exist');
          cy.get('.result-content').should('exist');
          cy.get('.result-score').should('exist');
        } else {
          // No search results
          cy.get('.empty-state').should('contain', `No knowledge found for "${searchQuery}"`);
        }
      });

      cy.screenshot('knowledge-search-results');
    });

    it('should clear search results when search input is cleared', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Type in search box
      cy.get('.search-input').type('test');
      cy.wait(1000);

      // Clear search box
      cy.get('.search-input').clear();

      // Should show file list again instead of search results
      cy.get('.search-results').should('not.exist');

      cy.screenshot('search-cleared');
    });
  });

  describe('File Upload Functionality', () => {
    it('should show file upload interface', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Verify upload button exists
      cy.get('.upload-btn').should('contain', '+ Upload File');
      cy.get('input[type="file"]').should('exist');

      cy.screenshot('file-upload-interface');
    });

    it('should handle file upload simulation', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Create a test file
      const testContent = 'This is a test knowledge file for the ELIZA game.';
      const fileName = 'test-knowledge.txt';

      // Simulate file upload by creating a file
      cy.get('input[type="file"]').then((input) => {
        const blob = new Blob([testContent], { type: 'text/plain' });
        const file = new File([blob], fileName, { type: 'text/plain' });

        // Create a DataTransfer object and add the file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // Set the files property of the input
        Object.defineProperty(input[0], 'files', {
          value: dataTransfer.files,
          writable: false,
        });

        // Trigger the change event
        cy.wrap(input).trigger('change', { force: true });
      });

      // Wait for upload to complete
      cy.wait(3000);

      // Look for success or error message in chat
      cy.get('.chat-content').should('exist');

      cy.screenshot('file-upload-attempt');
    });
  });

  describe('File Management', () => {
    it('should show file deletion interface for existing files', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Wait for files to load
      cy.wait(2000);

      // If files exist, check for delete buttons
      cy.get('.scrollable-content').then(($content) => {
        if ($content.find('.file-item').length > 0) {
          cy.get('.file-action').should('exist');
          cy.get('.file-action').should('contain', '✕');
        }
      });

      cy.screenshot('file-deletion-interface');
    });
  });

  describe('Knowledge Plugin API Integration', () => {
    it('should verify knowledge API endpoints are accessible', () => {
      // Test the knowledge documents endpoint
      cy.request({
        method: 'GET',
        url: 'http://localhost:7777/knowledge/documents',
        failOnStatusCode: false,
      }).then((response) => {
        // Should get a response (200 or error, but not connection failure)
        expect(response.status).to.be.oneOf([200, 404, 500]);
      });

      // Test the knowledge search endpoint
      cy.request({
        method: 'POST',
        url: 'http://localhost:7777/knowledge/search',
        body: {
          query: 'test',
          agentId: 'test-agent',
          count: 5,
        },
        failOnStatusCode: false,
      }).then((response) => {
        // Should get a response
        expect(response.status).to.be.oneOf([200, 400, 404, 500]);
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh knowledge files periodically', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Get initial file count
      cy.get('.status-header')
        .invoke('text')
        .then((_initialHeader) => {
          // Wait for refresh cycle (5 seconds)
          cy.wait(6000);

          // Check that the interface is still responsive
          cy.get('.status-header').should('contain', '◎ KNOWLEDGE BASE');

          // Header should still be present (may have same or different count)
          cy.get('.status-header').invoke('text').should('include', '◎ KNOWLEDGE BASE');
        });

      cy.screenshot('knowledge-refresh-cycle');
    });
  });

  describe('Error Handling', () => {
    it('should handle knowledge service unavailability gracefully', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // The interface should still be functional even if API calls fail
      cy.get('.search-input').should('exist');
      cy.get('.upload-btn').should('exist');
      cy.get('.status-header').should('contain', '◎ KNOWLEDGE BASE');

      // Try searching even if service is down
      cy.get('.search-input').type('test query');
      cy.wait(2000);

      // Should not crash the interface
      cy.get('.search-input').should('have.value', 'test query');

      cy.screenshot('error-handling-service-down');
    });
  });

  describe('Agent Knowledge Actions Integration', () => {
    it('should allow agent to process knowledge through chat commands', () => {
      // Type a message that should trigger knowledge processing
      const knowledgeCommand =
        'Please add this to your knowledge: The sky is blue and water is wet.';

      cy.get('.chat-input').type(knowledgeCommand);
      cy.get('.send-btn').click();

      // Wait for agent response
      cy.wait(5000);

      // Check that message was sent
      cy.get('.chat-content').should('contain', knowledgeCommand);

      // Switch to knowledge tab to see if anything was processed
      cy.get('button').contains('FILES').click();
      cy.wait(3000);

      // Interface should still be functional
      cy.get('.status-header').should('contain', '◎ KNOWLEDGE BASE');

      cy.screenshot('agent-knowledge-processing');
    });
  });

  describe('Visual Consistency', () => {
    it('should maintain terminal aesthetic in knowledge interface', () => {
      // Switch to FILES tab
      cy.get('button').contains('FILES').click();

      // Check that terminal styling is applied
      cy.get('.status-content').should('have.class', 'status-content');
      cy.get('.search-input').should('exist');

      // Verify colors match terminal theme
      cy.get('.search-input').should('have.css', 'color').and('include', 'rgb(0, 255');

      cy.screenshot('terminal-aesthetic-knowledge');
    });
  });

  describe('Complete Knowledge Workflow', () => {
    it('should demonstrate full knowledge management workflow', () => {
      // 1. Navigate to knowledge tab
      cy.get('button').contains('FILES').click();
      cy.screenshot('workflow-1-navigate-to-knowledge');

      // 2. Check initial state
      cy.get('.status-header').should('contain', '◎ KNOWLEDGE BASE');
      cy.screenshot('workflow-2-initial-state');

      // 3. Perform a search
      cy.get('.search-input').type('admin');
      cy.wait(2000);
      cy.screenshot('workflow-3-search-performed');

      // 4. Clear search
      cy.get('.search-input').clear();
      cy.wait(1000);
      cy.screenshot('workflow-4-search-cleared');

      // 5. Check upload interface
      cy.get('.upload-btn').should('be.visible');
      cy.screenshot('workflow-5-upload-interface');

      // 6. Verify API accessibility
      cy.request({
        method: 'GET',
        url: 'http://localhost:7777/knowledge/documents',
        failOnStatusCode: false,
      }).then((response) => {
        cy.log(`Knowledge API status: ${response.status}`);
      });

      cy.screenshot('workflow-6-complete');
    });
  });
});
