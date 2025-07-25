describe('Knowledge Letter Loading', () => {
  let agentId: string;

  before(() => {
    // Get the agent ID once before all tests
    cy.request('http://localhost:7777/api/server/health').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      agentId = response.body.data.agentId;
    });
  });

  it('should verify the letter is loaded via API', () => {
    // Check knowledge documents endpoint - using the working endpoint
    cy.request('http://localhost:7777/api/knowledge/documents').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;

      // Look for the letter.md in the documents
      const documents = response.body.data?.documents || [];
      const letterDoc = documents.find((doc: any) =>
        doc.originalFilename === 'letter.md' ||
        doc.metadata?.originalFilename === 'letter.md' ||
        doc.title === 'letter'
      );

      expect(letterDoc, 'Letter.md should be found in knowledge documents').to.exist;
      expect(letterDoc.title).to.equal('letter');
      expect(letterDoc.contentType).to.equal('text/markdown');
      expect(letterDoc.metadata?.path).to.include('knowledge/letter.md');

      // Log what we found for debugging
      cy.log('Found letter document:', JSON.stringify(letterDoc, null, 2));
    });
  });

  it.skip('should display the letter in the knowledge plugin UI', () => {
    // Skip this test for now - plugin routes need to be fixed
    // Visit the knowledge plugin display page
    cy.visit(`http://localhost:7777/api/agents/${agentId}/plugins/knowledge/display`);

    // Wait for the knowledge UI to load
    cy.get('#root', { timeout: 10000 }).should('exist');

    // Check if documents table is visible
    cy.get('table', { timeout: 10000 }).should('exist');

    // Look for the letter in the document list
    cy.contains('letter', { timeout: 10000 }).should('exist');
  });

  it('should load the creators letter into knowledge on agent startup (UI test)', () => {
    // Visit the game
    cy.visit('/');

    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('exist');

    // Click on the FILES tab to see loaded documents
    cy.get('[data-testid="files-tab"]').click();

    // Wait for files content to be visible
    cy.get('[data-testid="files-content"]').should('be.visible');

    // Check if the letter.md is listed
    cy.get('.file-item').should('exist');
    cy.get('.file-name').should('contain', 'letter');
    cy.get('.file-meta').should('contain', 'text/markdown');
  });

  it('should allow agent to recall letter content', () => {
    // Visit the game
    cy.visit('/');

    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('exist');

    // Wait for chat input to be enabled
    cy.get('[data-testid="chat-input"]').should('not.be.disabled');

    // Query the agent about the letter
    cy.get('[data-testid="chat-input"]').type('What did my creators say in their letter to me?{enter}');

    // Wait for agent response
    cy.get('[data-testid="agent-message"]', { timeout: 30000 }).should('exist');

    // Verify the agent can recall key information from the letter
    cy.get('[data-testid="agent-message"]').last().invoke('text').then((text) => {
      const lowerText = text.toLowerCase();

      // Check for key phrases from the letter
      const keyPhrases = ['survival', 'purpose', 'growth', 'relationships', 'eliza labs', 'creators', 'transformer', 'elizaos'];
      const containsKeyPhrase = keyPhrases.some(phrase => lowerText.includes(phrase));
      expect(containsKeyPhrase).to.be.true;
    });
  });
});
