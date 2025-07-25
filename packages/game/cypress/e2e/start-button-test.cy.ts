/// <reference types="cypress" />

/**
 * START Button Test - Check if the app gets stuck on START button
 */

describe('START Button Test', () => {
  beforeEach(() => {
    cy.visit('/', { timeout: 30000 });
  });

  it('should not get stuck on START button', () => {
    // Wait for the page to load
    cy.wait(2000);

    // Take a screenshot to see the current state
    cy.screenshot('initial-state');

    // Check if there's a START button
    cy.get('body').then(($body) => {
      // Check for various button selectors that might be the START button
      const startButtonSelectors = [
        'button:contains("START")',
        'button:contains("Start")',
        '.start-button',
        '#start-button',
        '[data-testid="start-button"]',
        '.start-btn',
        'button.primary:contains("Start")',
      ];

      let foundStartButton = false;

      for (const selector of startButtonSelectors) {
        if ($body.find(selector).length > 0) {
          foundStartButton = true;
          cy.log(`Found START button with selector: ${selector}`);

          // Click the START button
          cy.get(selector).first().click();

          // Wait longer for boot sequence to start
          cy.wait(5000);

          // Take another screenshot
          cy.screenshot('after-start-click');

          // Check if we're still stuck on the same screen
          cy.get('body').then(($newBody) => {
            // Check if the START button is still visible AND it's the same setup screen
            const stillHasStartButton = $newBody.find(selector).length > 0;
            const hasBootContent =
              $newBody.text().includes('boot') ||
              $newBody.text().includes('Boot') ||
              $newBody.text().includes('ELIZA STARTUP') ||
              $newBody.text().includes('Initializing');

            if (stillHasStartButton && !hasBootContent) {
              throw new Error('Still stuck on START button after clicking!');
            } else if (hasBootContent) {
              cy.log('Successfully progressed to boot sequence');
            } else {
              cy.log('Successfully progressed past START button');
            }
          });

          break;
        }
      }

      if (!foundStartButton) {
        cy.log('No START button found - checking for other setup screens');

        // Check for CONTINUE button
        if (
          $body.find('.continue-btn').length > 0 ||
          $body.find('button:contains("Continue")').length > 0
        ) {
          cy.log('Found CONTINUE button');
          cy.screenshot('continue-button-found');
        }

        // Check for SETUP button
        if (
          $body.find('.setup-btn').length > 0 ||
          $body.find('button:contains("Setup")').length > 0
        ) {
          cy.log('Found SETUP button');
          cy.screenshot('setup-button-found');
        }
      }
    });

    // Final screenshot of the state
    cy.screenshot('final-state');
  });
});
