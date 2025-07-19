describe('Plugin Rolodex Working Tests', () => {
  it('should load the main page successfully', () => {
    cy.visit('/');
    cy.get('body').should('exist');
    cy.get('h1').should('contain', 'Plugin Rolodex Test Server');
  });

  it('should load test components page', () => {
    cy.visit('/test-components');
    cy.get('body').should('be.visible');
    cy.get('h2').contains('RolodexTab Component').should('be.visible');
    cy.url().should('include', '/test-components');
  });

  it('should test contact interactions', () => {
    cy.visit('/');
    cy.get('#contacts-button').should('be.visible');
    cy.get('#contacts-button').click();
    cy.get('#contacts-list').should('contain', 'Contact list would go here');
  });

  it('should test add contact functionality', () => {
    cy.visit('/test-components');
    cy.get('#add-contact').should('be.visible');
    cy.get('#contact-form').should('not.be.visible');
    cy.get('#add-contact').click();
    cy.get('#contact-form').should('be.visible');

    cy.get('#contact-name').type('Test Contact');
    cy.get('#save-contact').click();

    // Check that the alert would be triggered (we can't actually see it in headless mode)
    cy.get('#contact-form').should('not.be.visible');
  });

  it('should test API health endpoint', () => {
    cy.request('/api/health').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('status', 'ok');
      expect(response.body).to.have.property('service', 'plugin-rolodex-test');
    });
  });

  it('should test contacts API', () => {
    cy.request('/api/contacts').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('contacts');
      expect(response.body.data.contacts).to.have.length(2);
      expect(response.body.data.contacts[0]).to.have.property('name', 'John Doe');
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
