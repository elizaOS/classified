describe('Plugin Knowledge Server Test', () => {
  it('should verify the server is running', () => {
    // Visit the base URL
    cy.visit('/', { failOnStatusCode: false });

    // Check that we get a page (even if it's a 404 page)
    cy.get('body').should('exist');
  });

  it('should check server response', () => {
    // Make a request to the server
    cy.request({
      url: '/',
      failOnStatusCode: false,
    }).then((response) => {
      // Any response means the server is up
      expect(response).to.have.property('status');
      cy.log(`Server responded with status: ${response.status}`);
    });
  });

  it('should verify API endpoint', () => {
    // Try to access a basic API endpoint
    cy.request({
      method: 'GET',
      url: '/api/health',
      failOnStatusCode: false,
    }).then((response) => {
      cy.log(`API health check status: ${response.status}`);
      // Even a 404 is OK - it means the server is running
      expect(response.status).to.be.oneOf([200, 404]);
    });
  });

  it('should verify knowledge plugin API endpoints work', () => {
    // Get a test agent ID - we'll use a dummy one since we just want to test the API structure
    const testAgentId = 'b438180f-bcb4-0e28-8cb1-ec0264051e59';

    // Test documents endpoint
    cy.request({
      method: 'GET',
      url: `/api/documents?agentId=${testAgentId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('memories');
    });

    // Test search endpoint
    cy.request({
      method: 'GET',
      url: `/api/search?agentId=${testAgentId}&q=test`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('results');
    });

    // Test knowledges endpoint
    cy.request({
      method: 'GET',
      url: `/api/knowledges?agentId=${testAgentId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('chunks');
    });
  });
});
