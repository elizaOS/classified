/// <reference types="cypress" />

describe('Simple UI Check - Demo TODOs and Goals', () => {
  it('should load the frontend and show either data or debug messages', () => {
    // Set localStorage before visiting the page
    cy.visit('/', {
      timeout: 30000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
      },
    });

    // Wait for the interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Take a screenshot of the initial state
    cy.screenshot('01-initial-game-interface');

    // Click on Goals tab first (it should be the default)
    cy.get('[data-testid="goals-tab"]', { timeout: 10000 }).should('be.visible').click();
    cy.wait(3000);
    cy.screenshot('02-goals-tab-clicked');

    // Check if we can see the goals content area
    cy.get('[data-testid="goals-content"]', { timeout: 10000 }).should('be.visible');

    // Log what we see in the goals tab
    cy.get('[data-testid="goals-content"]').then(($content) => {
      const text = $content.text();
      cy.log('Goals content:', text);

      // Check if we see either:
      // 1. "No active goals" - meaning the UI is working but no data
      // 2. Some goals data - meaning everything is working
      // 3. "Goals loaded" - meaning our debug messages are working
      if (text.includes('No active goals')) {
        cy.log('❌ ISSUE: UI shows no goals despite backend having data');
      } else if (text.includes('Goals loaded')) {
        cy.log('✅ DEBUG: Goals API calls are working, check console');
      } else if (text.includes('○') || text.includes('✓')) {
        cy.log('✅ SUCCESS: Goals are visible in UI');
      } else {
        cy.log('❓ UNKNOWN: Unexpected goals content');
      }
    });

    cy.screenshot('03-goals-content-analyzed');

    // Now check TODOs tab
    cy.get('[data-testid="todos-tab"]', { timeout: 10000 }).should('be.visible').click();
    cy.wait(3000);
    cy.screenshot('04-todos-tab-clicked');

    // Check if we can see the todos content area
    cy.get('[data-testid="todos-content"]', { timeout: 10000 }).should('be.visible');

    // Log what we see in the todos tab
    cy.get('[data-testid="todos-content"]').then(($content) => {
      const text = $content.text();
      cy.log('TODOs content:', text);

      // Check if we see either:
      // 1. "No pending tasks" - meaning the UI is working but no data
      // 2. Some todo data - meaning everything is working
      // 3. "TODOs loaded" - meaning our debug messages are working
      if (text.includes('No pending tasks')) {
        cy.log('❌ ISSUE: UI shows no TODOs despite backend having data');
      } else if (text.includes('TODOs loaded')) {
        cy.log('✅ DEBUG: TODOs API calls are working, check console');
      } else if (text.includes('○') || text.includes('✓')) {
        cy.log('✅ SUCCESS: TODOs are visible in UI');
      } else {
        cy.log('❓ UNKNOWN: Unexpected TODOs content');
      }
    });

    cy.screenshot('05-todos-content-analyzed');

    // Also check if we can see any debug messages in the terminal area
    // The terminal output should show our debug messages
    cy.get('.terminal-container', { timeout: 5000 }).then(($terminal) => {
      if ($terminal.length > 0) {
        const terminalText = $terminal.text();
        if (terminalText.includes('Goals loaded') || terminalText.includes('TODOs loaded')) {
          cy.log('✅ SUCCESS: Debug messages visible in terminal');
        } else {
          cy.log('❌ ISSUE: No debug messages in terminal - API calls may not be working');
        }
      } else {
        cy.log('❓ Terminal not found');
      }
    });

    cy.screenshot('06-complete-analysis');
  });
});
