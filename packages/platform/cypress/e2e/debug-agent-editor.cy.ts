describe('Debug Agent Editor', () => {
  beforeEach(() => {
    // Mock the API calls that the AgentEditorPage makes
    cy.intercept('GET', '/api/auth/session', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          userId: 'test-user-id',
          email: 'test@elizaos.ai',
          organizationId: 'test-org-id',
        },
      },
    }).as('session');

    cy.intercept('GET', '/api/v1/organizations/config', {
      statusCode: 200,
      body: {
        requiredPlugins: ['@elizaos/plugin-sql', '@elizaos/plugin-openai'],
      },
    }).as('orgConfig');

    cy.intercept('POST', '/api/api-keys', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          key: 'test-api-key-123',
        },
      },
    }).as('apiKey');
  });

  it('should debug what elements exist on the page', () => {
    cy.devLogin();
    cy.visit('/dashboard/agents/editor', { failOnStatusCode: false });

    // Wait for API calls to complete
    cy.wait(['@session', '@orgConfig', '@apiKey']);

    // Wait for page to load
    cy.get('body', { timeout: 30000 }).should('not.be.empty');

    // Debug: Print out page content and check for elements
    cy.get('body').then(($body) => {
      const text = $body.text().substring(0, 1000);
      cy.log('Page text:', text);

      // Check for various elements
      const hasContainer =
        $body.find('[data-cy="agent-editor-container"]').length > 0;
      const hasWrapper =
        $body.find('[data-cy="agent-editor-wrapper"]').length > 0;
      const hasLoading = text.includes('Loading');
      const hasError =
        text.includes('Error') ||
        text.includes('error') ||
        text.includes('Failed');
      const hasPageTitle = $body.find('[data-cy="page-title"]').length > 0;

      cy.log('Debug info:', {
        hasContainer,
        hasWrapper,
        hasLoading,
        hasError,
        hasPageTitle,
        bodyLength: $body.find('*').length,
      });

      // List all data-cy attributes
      const dataCyElements = Array.from($body.find('[data-cy]')).map((el) =>
        el.getAttribute('data-cy'),
      );
      cy.log('Found data-cy elements:', dataCyElements);
    });

    // Wait longer for dynamic content to load
    cy.wait(10000);

    // Check again after wait
    cy.get('body').then(($body) => {
      const dataCyElements = Array.from($body.find('[data-cy]')).map((el) =>
        el.getAttribute('data-cy'),
      );
      const text = $body.text().substring(0, 1000);
      cy.log('After 10s wait - data-cy elements:', dataCyElements);
      cy.log('After 10s wait - text:', text);
    });
  });
});
