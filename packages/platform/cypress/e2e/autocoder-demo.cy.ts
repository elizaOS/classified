/**
 * Cypress E2E test for Autocoder demo conversation
 * This test performs the actual conversation that was previously shown as a mock demo
 */

describe('Autocoder Live Demo', () => {
  beforeEach(() => {
    // Visit the autocoder landing page
    cy.visit('/autocoder-lander');

    // Ensure user is authenticated for the demo
    cy.window().then((win) => {
      // Set mock auth state
      win.localStorage.setItem('auth_token', 'test-token');
    });
  });

  it('should perform the Powell interest rate hedging strategy conversation', () => {
    // Type the initial prompt
    cy.get('input[placeholder="What do you want to build?"]').type(
      'I think interest rates are going to go up. I just read that Trump is gonna replace Powell to hike rates. How do I make money on that?',
    );

    // Click "LET'S COOK" button
    cy.contains('button', "LET'S COOK").click();

    // Wait for the chat interface to load
    cy.get('[data-testid="swarm-project-dashboard"]', {
      timeout: 10000,
    }).should('exist');

    // Verify initial message appears
    cy.contains('I think interest rates are going to go up').should(
      'be.visible',
    );

    // Wait for Eliza's first response about Polymarket
    cy.contains("Well, you could buy the 'yes' position on Polymarket", {
      timeout: 30000,
    }).should('be.visible');

    // Send follow-up message
    cy.get('input[placeholder*="Ask Eliza"]').type(
      "That's cool, what else could I do that's more creative?",
    );
    cy.get('button[type="submit"]').click();

    // Wait for Eliza's sophisticated strategy response
    cy.contains("Here's a more sophisticated strategy", {
      timeout: 30000,
    }).should('be.visible');
    cy.contains('go long yield by looping on Aave').should('be.visible');
    cy.contains('short Bitcoin').should('be.visible');

    // Ask how to implement it
    cy.get('input[placeholder*="Ask Eliza"]').type(
      "Damn that's pretty smart, how do I do that?",
    );
    cy.get('button[type="submit"]').click();

    // Wait for Eliza's response about creating a workflow
    cy.contains('I can create a workflow for you!', { timeout: 30000 }).should(
      'be.visible',
    );
    cy.contains('Would you like me to start coding this strategy?').should(
      'be.visible',
    );

    // Confirm and add the USDC conversion request
    cy.get('input[placeholder*="Ask Eliza"]').type(
      'Sure. And then take my winnings and convert them to USDC and send to my Solana wallet',
    );
    cy.get('button[type="submit"]').click();

    // Wait for Eliza to confirm the full strategy
    cy.contains('Perfect! Let me cook', { timeout: 30000 }).should(
      'be.visible',
    );
    cy.contains('Powell Hedging Strategy').should('be.visible');

    // Verify all strategy components are mentioned
    cy.contains("Buys 'yes' on rate hikes on Polymarket").should('be.visible');
    cy.contains('Sets up yield looping on Aave').should('be.visible');
    cy.contains('Shorts BTC as a hedge').should('be.visible');
    cy.contains('Auto-converts profits to USDC').should('be.visible');
    cy.contains('Bridges to Solana').should('be.visible');

    // Check that the swarm is starting to work
    cy.contains('Starting implementation').should('be.visible');

    // Verify swarm engineers are active
    cy.contains(/\d+ Engineers Active/).should('be.visible');

    // Optional: Check for project progress indicators
    cy.get('[data-testid="project-status"]').should('contain', 'active');
  });

  it('should handle the trading bot creation flow', () => {
    // Use one of the example prompts
    cy.contains(
      'button',
      'Build me a trading bot that monitors crypto prices',
    ).click();

    // Verify the input is populated
    cy.get('input[placeholder="What do you want to build?"]').should(
      'have.value',
      'Build me a trading bot that monitors crypto prices',
    );

    // Start the conversation
    cy.contains('button', "LET'S COOK").click();

    // Wait for chat to load
    cy.get('[data-testid="swarm-project-dashboard"]', {
      timeout: 10000,
    }).should('exist');

    // Verify the conversation starts
    cy.contains('Build me a trading bot that monitors crypto prices').should(
      'be.visible',
    );

    // Wait for Eliza's response
    cy.contains('trading bot', { timeout: 30000 }).should('be.visible');

    // Continue the conversation
    cy.get('input[placeholder*="Ask Eliza"]').type(
      'I want it to monitor BTC, ETH, and SOL on multiple exchanges',
    );
    cy.get('button[type="submit"]').click();

    // Verify Eliza understands the requirements
    cy.contains('BTC', { timeout: 30000 }).should('be.visible');
    cy.contains('multiple exchanges').should('be.visible');
  });

  it('should show project scaling capabilities', () => {
    // Start a project
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Create a DeFi yield farming strategy',
    );
    cy.contains('button', "LET'S COOK").click();

    // Wait for project dashboard
    cy.get('[data-testid="swarm-project-dashboard"]', {
      timeout: 10000,
    }).should('exist');

    // Check for scaling controls
    cy.get('[data-testid="scale-button"]').should('exist');

    // Try to scale the project
    cy.get('[data-testid="scale-button"]').click();

    // Verify scaling message appears
    cy.contains('Project scaled to', { timeout: 10000 }).should('be.visible');
  });

  it('should allow project status management', () => {
    // Start a project
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Build an NFT marketplace',
    );
    cy.contains('button', "LET'S COOK").click();

    // Wait for project dashboard
    cy.get('[data-testid="swarm-project-dashboard"]', {
      timeout: 10000,
    }).should('exist');

    // Test pause functionality
    cy.get('[data-testid="pause-button"]').click();
    cy.contains('Project paused successfully', { timeout: 10000 }).should(
      'be.visible',
    );

    // Test resume functionality
    cy.get('[data-testid="resume-button"]').click();
    cy.contains('Project resumed successfully', { timeout: 10000 }).should(
      'be.visible',
    );
  });

  it('should navigate back to landing page', () => {
    // Start a project
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Test project',
    );
    cy.contains('button', "LET'S COOK").click();

    // Wait for project dashboard
    cy.get('[data-testid="swarm-project-dashboard"]', {
      timeout: 10000,
    }).should('exist');

    // Click back button
    cy.get('[data-testid="back-button"]').click();

    // Should be back on landing page
    cy.contains('AI-Powered').should('be.visible');
    cy.get('input[placeholder="What do you want to build?"]').should(
      'be.visible',
    );
    cy.get('img[alt="Eliza holding a spatula"]').should('be.visible');
  });
});

// Additional test for unauthenticated users
describe('Autocoder Authentication Flow', () => {
  it('should redirect to login for unauthenticated users', () => {
    // Clear any auth tokens
    cy.clearLocalStorage();

    cy.visit('/autocoder-lander');

    // Try to start without auth
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Build me a DeFi app',
    );
    cy.contains('button', "LET'S COOK").click();

    // Should redirect to login
    cy.url().should('include', '/auth/login');
    cy.url().should('include', 'returnTo=/autocoder-lander');
  });

  it('should restore prompt after login', () => {
    // Clear auth and visit
    cy.clearLocalStorage();
    cy.visit('/autocoder-lander');

    const testPrompt = 'Build a sophisticated yield optimizer';

    // Type prompt and try to start
    cy.get('input[placeholder="What do you want to build?"]').type(testPrompt);
    cy.contains('button', "LET'S COOK").click();

    // Should redirect to login
    cy.url().should('include', '/auth/login');

    // Simulate successful login
    cy.window().then((win) => {
      win.sessionStorage.setItem('autocoderPrompt', testPrompt);
      win.localStorage.setItem('auth_token', 'test-token');
    });

    // Return to autocoder
    cy.visit('/autocoder-lander');

    // Prompt should be restored and auto-start
    cy.get('input[placeholder="What do you want to build?"]').should(
      'have.value',
      testPrompt,
    );

    // Chat should start automatically
    cy.get('[data-testid="swarm-project-dashboard"]', {
      timeout: 10000,
    }).should('exist');
  });
});
