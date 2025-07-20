describe('Button Layout Test', () => {
    beforeEach(() => {
        cy.visit('http://localhost:5173');
        cy.wait(2000);
    });

    it('should display buttons in square horizontal layout', () => {
        // Wait for page to load
        cy.get('body').should('be.visible');
        
        // Take initial screenshot
        cy.screenshot('page-loaded');
        
        // Look for the capability buttons
        cy.get('[data-testid*="toggle"]', { timeout: 10000 }).should('have.length.at.least', 1);
        
        // Check button layout
        cy.get('[data-testid="autonomy-toggle"]').should('be.visible');
        cy.get('[data-testid="camera-toggle"]').should('be.visible');
        
        // Verify they're in a row
        cy.get('[data-testid="autonomy-toggle"]').then($first => {
            const firstRect = $first[0].getBoundingClientRect();
            
            cy.get('[data-testid="camera-toggle"]').then($second => {
                const secondRect = $second[0].getBoundingClientRect();
                
                // Should be on same line (similar Y position)
                expect(Math.abs(firstRect.top - secondRect.top)).to.be.lessThan(10);
                
                // Second should be to the right of first
                expect(secondRect.left).to.be.greaterThan(firstRect.left);
            });
        });
        
        // Test clicking (should not cause errors)
        cy.get('[data-testid="autonomy-toggle"]').click();
        cy.wait(500);
        
        cy.screenshot('buttons-tested');
    });
});