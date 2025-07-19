describe('Simple Test', () => {
  it('should visit the test components page', () => {
    cy.visit('/test-components');
    cy.get('body').should('be.visible');
    cy.get('h2').contains('RolodexTab Component').should('be.visible');
    cy.url().should('include', '/test-components');
  });
});
