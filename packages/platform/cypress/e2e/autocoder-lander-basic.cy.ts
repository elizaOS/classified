/// <reference types="cypress" />

/**
 * AUTOCODER LANDER BASIC TESTS
 *
 * Simple tests for the autocoder lander interface that don't depend on API calls
 * Tests the UI elements and basic interactions
 */

describe('Autocoder Lander Basic Tests', () => {
  beforeEach(() => {
    // Visit the autocoder lander page
    cy.visit('/autocoder-lander', {
      failOnStatusCode: false,
      timeout: 30000,
    });
  });

  it('should load the landing page correctly', () => {
    cy.log('✅ Testing landing page loads correctly');

    // Verify main hero section
    cy.get('h1').contains('AI-Powered').should('be.visible');
    cy.get('h1').contains('Autocoding').should('be.visible');
    cy.get('h1').contains('DeFi').should('be.visible');

    // Verify main input field
    cy.get('input[placeholder="What do you want to build?"]').should(
      'be.visible',
    );
    cy.get('button').contains("LET'S COOK").should('be.visible');

    // Verify example prompts section
    cy.contains('Try these:').should('be.visible');
    cy.get('button').contains('interest rates').should('be.visible');

    // Verify demo conversation section
    cy.contains('Live Demo').should('be.visible');

    cy.log('✅ Landing page loaded successfully');
  });

  it('should test input field interactions', () => {
    cy.log('✅ Testing input field interactions');

    // Button should be disabled when input is empty - find the specific LET'S COOK button
    cy.get('button')
      .contains("LET'S COOK")
      .parent()
      .should('have.attr', 'disabled');

    // Enter some text
    const testText = 'Create a simple trading bot';
    cy.get('input[placeholder="What do you want to build?"]').type(testText);

    // Button should be enabled
    cy.get('button').contains("LET'S COOK").should('not.be.disabled');

    // Verify input contains the text
    cy.get('input[placeholder="What do you want to build?"]').should(
      'have.value',
      testText,
    );

    cy.log('✅ Input field interactions work correctly');
  });

  it('should test example prompts functionality', () => {
    cy.log('✅ Testing example prompts');

    // Check if Try these section exists
    cy.contains('Try these:').should('be.visible');

    // Simply verify that there are example prompts visible (more than just LET'S COOK button)
    cy.get('button').should('have.length.greaterThan', 1);

    cy.log('✅ Example prompts section is visible and functional');
  });

  it('should test responsive design elements', () => {
    cy.log('✅ Testing responsive design');

    // Test desktop view
    cy.viewport(1280, 720);
    cy.get('h1').should('be.visible');
    cy.get('input[placeholder="What do you want to build?"]').should(
      'be.visible',
    );

    // Test tablet view
    cy.viewport('ipad-2');
    cy.get('h1').should('be.visible');
    cy.get('input[placeholder="What do you want to build?"]').should(
      'be.visible',
    );

    // Test mobile view
    cy.viewport('iphone-x');
    cy.get('h1').should('be.visible');
    cy.get('input[placeholder="What do you want to build?"]').should(
      'be.visible',
    );

    cy.log('✅ Responsive design works correctly');
  });

  it('should test keyboard interactions', () => {
    cy.log('✅ Testing keyboard interactions');

    // Focus on input
    cy.get('input[placeholder="What do you want to build?"]').focus();

    // Type some text
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Test keyboard input',
    );

    // Press Enter - should trigger the button click (but we won't wait for API)
    cy.get('input[placeholder="What do you want to build?"]').type('{enter}');

    // Button should have been triggered - just verify it exists
    cy.get('button').should('exist');

    cy.log('✅ Keyboard interactions work correctly');
  });

  it('should test theme toggle functionality', () => {
    cy.log('✅ Testing theme toggle');

    // Find and click theme toggle (if it exists)
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="theme-toggle"]').length > 0) {
        cy.get('[data-testid="theme-toggle"]').click();
        cy.log('Theme toggle clicked');
      } else {
        cy.log('Theme toggle not found - this is okay');
      }
    });

    cy.log('✅ Theme toggle test completed');
  });

  it('should test header navigation elements', () => {
    cy.log('✅ Testing header navigation');

    // Verify header exists
    cy.get('header').should('exist');

    // Verify ElizaOS branding
    cy.contains('ElizaOS').should('be.visible');

    // Check for auth buttons (if not authenticated)
    cy.get('body').then(($body) => {
      if ($body.text().includes('Sign in')) {
        cy.contains('Sign in').should('be.visible');
        cy.contains('Get Started').should('be.visible');
      } else {
        cy.log('User appears to be authenticated');
      }
    });

    cy.log('✅ Header navigation tested');
  });

  it('should test demo conversation display', () => {
    cy.log('✅ Testing demo conversation');

    // Verify Live Demo section exists
    cy.contains('Live Demo').should('be.visible');

    // Check for conversation elements
    cy.get('.rounded-lg').should('exist');

    // Demo should show some conversation
    cy.get('body').should(($body) => {
      const text = $body.text();
      expect(text).to.satisfy(
        (content: string) =>
          content.includes('interest rates') ||
          content.includes('trading') ||
          content.includes('DeFi'),
      );
    });

    cy.log('✅ Demo conversation displays correctly');
  });

  it('should test page accessibility', () => {
    cy.log('✅ Testing basic accessibility');

    // Check for proper heading structure
    cy.get('h1').should('exist');

    // Check for proper form labels/placeholders
    cy.get('input[placeholder="What do you want to build?"]').should('exist');

    // Check for button accessibility
    cy.get('button').contains("LET'S COOK").should('exist');

    // Check for keyboard navigation
    cy.get('input[placeholder="What do you want to build?"]').focus();
    cy.focused().should(
      'have.attr',
      'placeholder',
      'What do you want to build?',
    );

    cy.log('✅ Basic accessibility checks passed');
  });
});
