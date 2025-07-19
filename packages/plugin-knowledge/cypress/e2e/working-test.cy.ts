describe('Plugin Knowledge Working Tests', () => {
  const testAgentId = 'b438180f-bcb4-0e28-8cb1-ec0264051e59';

  it('should load the knowledge test page successfully', () => {
    cy.visit('/');
    cy.get('body').should('exist');
    cy.get('h1').should('contain', 'Plugin Knowledge Test Server');
  });

  it('should test basic knowledge interactions', () => {
    cy.visit('/');
    cy.get('#search-button').should('be.visible');
    cy.get('#search-button').click();
    cy.get('#search-results').should('contain', 'Search functionality would go here');
  });

  it('should test API health endpoint', () => {
    cy.request('/api/health').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('status', 'ok');
      expect(response.body).to.have.property('service', 'plugin-knowledge-test');
    });
  });

  it('should test documents endpoint', () => {
    cy.request(`/api/documents?agentId=${testAgentId}`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('memories');
      expect(response.body.data.memories).to.have.length(2);
      expect(response.body.data.memories[0]).to.have.property('agentId', testAgentId);
    });
  });

  it('should test search endpoint', () => {
    cy.request(`/api/search?agentId=${testAgentId}&q=test`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('results');
      expect(response.body.data.results).to.have.length(2);
      expect(response.body.data.results[0].text).to.include('test');
    });
  });

  it('should test knowledges endpoint', () => {
    cy.request(`/api/knowledges?agentId=${testAgentId}`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('chunks');
      expect(response.body.data.chunks).to.have.length(2);
      expect(response.body.data.chunks[0]).to.have.property('agentId', testAgentId);
    });
  });

  it('should handle 404 errors gracefully', () => {
    cy.request({
      url: '/nonexistent',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });
});
