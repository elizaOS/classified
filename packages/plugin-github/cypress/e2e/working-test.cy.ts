describe('Plugin GitHub Working Tests', () => {
  const testAgentId = 'b438180f-bcb4-0e28-8cb1-ec0264051e59';

  it('should load the GitHub test page successfully', () => {
    cy.visit('/');
    cy.get('body').should('exist');
    cy.get('h1').should('contain', 'Plugin GitHub Test Server');
  });

  it('should test repository interactions', () => {
    cy.visit('/');
    cy.get('#repo-button').should('be.visible');
    cy.get('#repo-button').click();
    cy.get('#repo-info').should('contain', 'Repository: elizaos/eliza (1000 stars)');
  });

  it('should test issues interactions', () => {
    cy.visit('/');
    cy.get('#issues-button').should('be.visible');
    cy.get('#issues-button').click();
    cy.get('#issues-info').should('contain', 'Found 15 open issues');
  });

  it('should test pull requests interactions', () => {
    cy.visit('/');
    cy.get('#pr-button').should('be.visible');
    cy.get('#pr-button').click();
    cy.get('#pr-info').should('contain', 'Found 5 open pull requests');
  });

  it('should test API health endpoint', () => {
    cy.request('/api/health').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('status', 'ok');
      expect(response.body).to.have.property('service', 'plugin-github-test');
    });
  });

  it('should test repository endpoint', () => {
    cy.request(`/api/repository?agentId=${testAgentId}&repo=elizaos/eliza`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('name', 'elizaos/eliza');
      expect(response.body.data).to.have.property('stars', 1000);
      expect(response.body.data).to.have.property('language', 'TypeScript');
      expect(response.body.data).to.have.property('agentId', testAgentId);
    });
  });

  it('should test issues endpoint', () => {
    cy.request(`/api/issues?agentId=${testAgentId}&repo=elizaos/eliza`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('issues');
      expect(response.body.data.issues).to.have.length(2);
      expect(response.body.data.issues[0]).to.have.property('title', 'Bug in authentication');
      expect(response.body.data.issues[1]).to.have.property('state', 'open');
    });
  });

  it('should test pulls endpoint', () => {
    cy.request(`/api/pulls?agentId=${testAgentId}&repo=elizaos/eliza`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('pulls');
      expect(response.body.data.pulls).to.have.length(2);
      expect(response.body.data.pulls[0]).to.have.property('title', 'Fix authentication bug');
      expect(response.body.data.pulls[1]).to.have.property('number', 51);
    });
  });

  it('should test webhooks endpoint', () => {
    cy.request(`/api/webhooks?agentId=${testAgentId}`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('webhooks');
      expect(response.body.data.webhooks).to.have.length(2);
      expect(response.body.data.webhooks[0]).to.have.property('url', 'https://example.com/webhook');
      expect(response.body.data.webhooks[0].events).to.include('push');
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
