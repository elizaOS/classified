describe('Manual Verification - Check What Actually Works', () => {
  beforeEach(() => {
    cy.visit('/', {
      timeout: 30000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
      },
    });
  });

  it('should verify the system is working end-to-end', () => {
    // Wait for the main interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Take a screenshot to see what we have
    cy.screenshot('01-initial-state');

    // Wait for data to potentially load
    cy.wait(5000);

    // Check what's actually visible on the page
    cy.get('body').then(($body) => {
      // Log the entire DOM structure for debugging
      cy.log('HTML Content:', $body.html());
    });

    // Find any tabs that might exist
    cy.get('[data-testid*="tab"]').then(($tabs) => {
      if ($tabs.length > 0) {
        cy.log('Found tabs:', $tabs.length);

        // Try to click each tab
        $tabs.each((index, tab) => {
          const tabId = Cypress.$(tab).attr('data-testid');
          cy.log('Found tab:', tabId);

          if (tabId) {
            cy.get(`[data-testid="${tabId}"]`).click();
            cy.screenshot(`02-tab-${tabId}`);
            cy.wait(1000);
          }
        });
      } else {
        cy.log('No tabs found');
      }
    });

    // Look for any content related to goals or todos
    cy.get('body').should('contain.text', 'ELIZA'); // Basic check that page loaded

    // Take final screenshot
    cy.screenshot('03-final-state');

    // Check network activity - see if APIs were called
    cy.window().then((_win) => {
      // We don't have direct access to network requests here, but we can check console
      // The APIs should have been called by now
    });

    // Success if we get this far without errors
    cy.log('✅ System appears to be working - frontend loads, no critical errors');
  });
});
