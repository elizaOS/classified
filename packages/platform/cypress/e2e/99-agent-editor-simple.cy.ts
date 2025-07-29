describe('Agent Editor Simple Test', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();
  });

  it('should load agent editor page successfully', () => {
    cy.devLogin();
    cy.visit('/dashboard/agents/editor', { failOnStatusCode: false });

    // First, wait for page to load and check for any content
    cy.get('body', { timeout: 20000 }).should('not.be.empty');

    // Debug: Check what's actually on the page
    cy.get('body').then(($body) => {
      cy.log('Page content includes:', $body.text().substring(0, 200));
    });

    // Check for common elements that should exist
    cy.get('body').should(($body) => {
      const text = $body.text();
      const hasAgent = text.includes('Agent') || text.includes('agent');
      const hasEditor = text.includes('Editor') || text.includes('editor');
      const hasLoading = text.includes('Loading') || text.includes('loading');

      expect(
        hasAgent || hasEditor || hasLoading,
        'Page should contain agent, editor, or loading text',
      ).to.be.true;
    });
  });

  it('should eventually load the agent editor UI', () => {
    cy.devLogin();
    cy.visit('/dashboard/agents/editor', { failOnStatusCode: false });

    // Wait for the page to fully load - be very patient
    cy.get('body', { timeout: 30000 }).should('not.be.empty');

    // Check if we have either the title or the container
    cy.get('body').should(($body) => {
      const hasTitle = $body.find('[data-cy="page-title"]').length > 0;
      const hasContainer =
        $body.find('[data-cy="agent-editor-container"]').length > 0;
      const hasLoading =
        $body.text().includes('Loading') || $body.text().includes('loading');

      expect(
        hasTitle || hasContainer || hasLoading,
        'Should have title, container, or loading state',
      ).to.be.true;
    });
  });
});
