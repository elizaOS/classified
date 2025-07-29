/// <reference types="cypress" />

/**
 * Autocoder Lander Specific Commands
 * Custom Cypress commands for testing the autocoder lander interface
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Create a project via the autocoder lander interface
       */
      createProjectViaLander(options: {
        description: string;
        waitForDashboard?: boolean;
        timeout?: number;
      }): Chainable<void>;

      /**
       * Navigate to specific dashboard tab
       */
      switchDashboardTab(
        tab: 'Overview' | 'Engineers' | 'Progress' | 'Chat',
      ): Chainable<void>;

      /**
       * Send message in dashboard chat
       */
      sendDashboardMessage(
        message: string,
        waitForResponse?: boolean,
      ): Chainable<void>;

      /**
       * Scale project to target engineer count
       */
      scaleProject(targetCount: number): Chainable<void>;

      /**
       * Update project status
       */
      updateProjectStatus(
        action: 'pause' | 'resume' | 'cancel',
      ): Chainable<void>;

      /**
       * Verify dashboard components are loaded
       */
      verifyDashboardLoaded(): Chainable<void>;

      /**
       * Verify project progress indicators
       */
      verifyProjectProgress(): Chainable<void>;

      /**
       * Wait for agent response in chat
       */
      waitForAgentResponse(timeout?: number): Chainable<void>;

      /**
       * Verify real-time updates are working
       */
      verifyRealtimeUpdates(): Chainable<void>;

      /**
       * Test mobile responsiveness
       */
      testMobileResponsiveness(): Chainable<void>;

      /**
       * Verify WebSocket connection status
       */
      verifyWebSocketConnected(): Chainable<void>;

      /**
       * Test error handling scenarios
       */
      testErrorHandling(): Chainable<void>;

      /**
       * Verify landing page elements
       */
      verifyLandingPage(): Chainable<void>;

      /**
       * Test example prompts functionality
       */
      testExamplePrompts(): Chainable<void>;

      /**
       * Verify project metrics and quality
       */
      verifyProjectMetrics(expectedMetrics?: {
        engineerCount?: number;
        progressPercentage?: number;
        messagesExchanged?: number;
      }): Chainable<void>;
    }
  }
}

// Landing Page Commands
Cypress.Commands.add('verifyLandingPage', () => {
  // Verify main hero section
  cy.get('h1').contains('AI-Powered').should('be.visible');
  cy.get('h1').contains('Autocoding').should('be.visible');
  cy.get('h1').contains('DeFi').should('be.visible');

  // Verify main input
  cy.get('input[placeholder="What do you want to build?"]').should(
    'be.visible',
  );
  cy.get('button').contains("LET'S COOK").should('be.visible');

  // Verify example prompts
  cy.contains('Try these:').should('be.visible');
  cy.get('button').contains('interest rates').should('be.visible');

  // Verify features section
  cy.contains('Smart Workflows').should('be.visible');
  cy.contains('Natural Language').should('be.visible');
  cy.contains('Instant Deployment').should('be.visible');

  // Verify demo conversation
  cy.contains('Live Demo').should('be.visible');
});

Cypress.Commands.add('testExamplePrompts', () => {
  // Test clicking example prompts
  const examplePrompts = [
    'interest rates',
    'trading bot',
    'DeFi yield farming',
  ];

  examplePrompts.forEach((prompt) => {
    cy.get('body').then(($body) => {
      if ($body.text().includes(prompt)) {
        cy.contains(prompt).click();
        cy.get('input[placeholder="What do you want to build?"]').should(
          'not.be.empty',
        );

        // Clear for next test
        cy.get('input[placeholder="What do you want to build?"]').clear();
      }
    });
  });
});

// Project Creation Commands
Cypress.Commands.add('createProjectViaLander', (options) => {
  const { description, waitForDashboard = true, timeout = 60000 } = options;

  // Enter project description
  cy.get('input[placeholder="What do you want to build?"]')
    .clear()
    .type(description);

  // Verify input is filled
  cy.get('input[placeholder="What do you want to build?"]').should(
    'have.value',
    description,
  );

  // Verify button is enabled
  cy.get('button').contains("LET'S COOK").should('not.be.disabled');

  // Click create button
  cy.get('button').contains("LET'S COOK").click();

  if (waitForDashboard) {
    // Wait for dashboard to load
    cy.get('[data-testid="swarm-project-dashboard"]', { timeout }).should(
      'be.visible',
    );
    cy.verifyDashboardLoaded();
  }
});

// Dashboard Navigation Commands
Cypress.Commands.add('verifyDashboardLoaded', () => {
  cy.get('[data-testid="swarm-project-dashboard"]').should('be.visible');

  // Verify header elements
  cy.get('button').contains('Back').should('be.visible');

  // Verify navigation tabs
  cy.contains('Overview').should('be.visible');
  cy.contains('Engineers').should('be.visible');
  cy.contains('Progress').should('be.visible');
  cy.contains('Chat').should('be.visible');

  // Verify main content area
  cy.get('.flex-1').should('exist');

  // Verify project status indicators
  cy.get('.h-2.w-2.rounded-full').should('exist');
});

Cypress.Commands.add('switchDashboardTab', (tab) => {
  cy.get('[data-testid="swarm-project-dashboard"]').within(() => {
    cy.contains(tab).click();

    // Verify tab is active
    cy.contains(tab).parent().should('have.class', 'text-orange-600');

    // Verify tab content is visible
    switch (tab) {
      case 'Overview':
        cy.contains('Project Type').should('be.visible');
        break;
      case 'Engineers':
        cy.contains('Scale Team').should('be.visible');
        break;
      case 'Progress':
        cy.contains('Analysis').should('be.visible');
        break;
      case 'Chat':
        cy.get('input[placeholder="Message the swarm..."]').should(
          'be.visible',
        );
        break;
    }
  });
});

// Chat Commands
Cypress.Commands.add(
  'sendDashboardMessage',
  (message, waitForResponse = true) => {
    cy.switchDashboardTab('Chat');

    cy.get('input[placeholder="Message the swarm..."]').clear().type(message);

    cy.get('button').contains('Send').should('not.be.disabled');
    cy.get('button').contains('Send').click();

    // Verify message appears in chat
    cy.contains(message).should('be.visible');

    if (waitForResponse) {
      cy.waitForAgentResponse();
    }
  },
);

Cypress.Commands.add('waitForAgentResponse', (timeout = 120000) => {
  // Wait for agent response with proper timeout
  cy.get('.rounded-lg', { timeout }).should('contain', 'Engineer');

  // Verify response is visible and not just a loading state
  cy.get('.rounded-lg').contains('Engineer').parent().should('be.visible');
});

// Project Management Commands
Cypress.Commands.add('scaleProject', (targetCount) => {
  cy.switchDashboardTab('Engineers');

  // Find and click the target count button
  cy.get('button').contains(targetCount.toString()).click();

  // Verify scaling operation
  cy.get('body').then(($body) => {
    if ($body.text().includes('Scaling team...')) {
      cy.contains('Scaling team...').should('be.visible');
    }
  });

  // Wait for scaling to complete
  cy.wait(2000);
});

Cypress.Commands.add('updateProjectStatus', (action) => {
  cy.switchDashboardTab('Overview');

  // Look for Quick Actions section
  cy.get('.max-w-4xl').within(() => {
    cy.contains('Quick Actions').should('be.visible');

    // Click the appropriate action button
    const buttonText = action.charAt(0).toUpperCase() + action.slice(1);
    cy.get('button').contains(buttonText).click();
  });

  // Verify status update
  cy.wait(2000);
});

// Progress and Metrics Commands
Cypress.Commands.add('verifyProjectProgress', () => {
  cy.switchDashboardTab('Progress');

  // Verify progress phases
  const phases = [
    'Analysis',
    'Planning',
    'Development',
    'Testing',
    'Deployment',
  ];
  phases.forEach((phase) => {
    cy.contains(phase).should('be.visible');
  });

  // Verify progress bars
  cy.get('.bg-orange-600').should('exist');

  // Verify percentage indicators
  cy.get('.text-sm').contains('%').should('exist');
});

Cypress.Commands.add('verifyProjectMetrics', (expectedMetrics = {}) => {
  const { engineerCount, progressPercentage, messagesExchanged } =
    expectedMetrics;

  if (engineerCount) {
    cy.switchDashboardTab('Engineers');
    cy.contains(`${engineerCount}`).should('be.visible');
  }

  if (progressPercentage) {
    cy.switchDashboardTab('Overview');
    cy.contains(`${progressPercentage}%`).should('be.visible');
  }

  if (messagesExchanged) {
    cy.switchDashboardTab('Chat');
    // Count message elements (approximate)
    cy.get('.rounded-lg').should('have.length.at.least', messagesExchanged);
  }
});

// Real-time and WebSocket Commands
Cypress.Commands.add('verifyRealtimeUpdates', () => {
  // Test real-time progress updates
  cy.switchDashboardTab('Progress');
  cy.get('.bg-orange-600').should('exist');

  // Test real-time engineer status
  cy.switchDashboardTab('Engineers');
  cy.get('.rounded-lg').should('contain', 'Engineer');

  // Test real-time chat updates
  cy.switchDashboardTab('Chat');
  cy.sendDashboardMessage('Real-time test message', false);

  // Message should appear immediately
  cy.contains('Real-time test message').should('be.visible');
});

Cypress.Commands.add('verifyWebSocketConnected', () => {
  // Check for connection indicators
  cy.get('body').should('not.contain', 'Connecting...');
  cy.get('body').should('not.contain', 'Disconnected');

  // Verify WebSocket functionality by sending a message
  cy.switchDashboardTab('Chat');
  cy.get('input[placeholder="Message the swarm..."]').should('not.be.disabled');
  cy.get('button').contains('Send').should('exist');
});

// Error Handling Commands
Cypress.Commands.add('testErrorHandling', () => {
  // Test empty input handling
  cy.get('input[placeholder="What do you want to build?"]').clear();
  cy.get('button').contains("LET'S COOK").should('be.disabled');

  // Test whitespace-only input
  cy.get('input[placeholder="What do you want to build?"]').type('   ');
  cy.get('button').contains("LET'S COOK").should('be.disabled');

  // Test very long input
  const longText = 'a'.repeat(1000);
  cy.get('input[placeholder="What do you want to build?"]')
    .clear()
    .type(longText.substring(0, 500)); // Most browsers limit input length

  cy.get('button').contains("LET'S COOK").should('not.be.disabled');

  // Clear for next test
  cy.get('input[placeholder="What do you want to build?"]').clear();
});

// Mobile Responsiveness Commands
Cypress.Commands.add('testMobileResponsiveness', () => {
  // Set mobile viewport
  cy.viewport('iphone-x');

  // Verify landing page elements are visible on mobile
  cy.get('h1').contains('AI-Powered').should('be.visible');
  cy.get('input[placeholder="What do you want to build?"]').should(
    'be.visible',
  );
  cy.get('button').contains("LET'S COOK").should('be.visible');

  // Test horizontal scrolling
  cy.get('body').should('not.have.css', 'overflow-x', 'scroll');

  // Test that all important elements fit in viewport
  cy.get('input[placeholder="What do you want to build?"]')
    .should('be.visible')
    .and(($el) => {
      const rect = $el[0].getBoundingClientRect();
      expect(rect.left).to.be.at.least(0);
      expect(rect.right).to.be.at.most(window.innerWidth);
    });

  // Reset to desktop viewport
  cy.viewport(1280, 720);
});

// Export for TypeScript
export {};
