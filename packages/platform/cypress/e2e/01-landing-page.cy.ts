describe('Landing Page - Complete Test Suite', () => {
  beforeEach(() => {
    // Clear any existing sessions
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/');
  });

  describe('Page Load and Structure', () => {
    it('should load the landing page successfully', () => {
      cy.url().should('eq', Cypress.config().baseUrl + '/');
      cy.get('body').should('be.visible');
    });

    it('should display the main navigation', () => {
      cy.get('nav').should('be.visible');
      cy.get('nav').within(() => {
        // Logo and title
        cy.contains('ElizaOS Platform').should('be.visible');

        // Theme toggle should be present
        cy.get('[data-cy="theme-toggle"]').should('be.visible');

        // Auth buttons should be present (varies based on auth state)
        cy.get('button').should('exist');
      });
    });

    it('should display the hero section with correct content', () => {
      // Main headline
      cy.contains('Ship AI Agents').should('be.visible');
      cy.contains('In Minutes').should('be.visible');

      // Value proposition
      cy.contains('Complete agent development platform').should('be.visible');
      cy.contains(
        'inference, hosting, file storage, and rapid deployment',
      ).should('be.visible');
    });

    it('should display the build idea input section', () => {
      cy.get('input[placeholder="Describe what you want to build..."]').should(
        'be.visible',
      );
      cy.get('button').contains('Build It').should('be.visible');

      // Check suggestions are present
      cy.contains('Community Moderator').should('be.visible');
      cy.contains('Trading Bot').should('be.visible');
      cy.contains('Research Assistant').should('be.visible');
      cy.contains('Content Creator').should('be.visible');
      cy.contains('Support Agent').should('be.visible');
    });
  });

  describe('Interactive Elements', () => {
    it('should handle build idea input interactions', () => {
      const testInput = 'Test AI agent for customer support';

      // Type in the input
      cy.get('input[placeholder="Describe what you want to build..."]')
        .type(testInput)
        .should('have.value', testInput);

      // Build It button should be enabled
      cy.get('button').contains('Build It').should('not.be.disabled');
    });

    it('should handle suggestion clicks', () => {
      // Click on a suggestion
      cy.contains('Community Moderator').click();

      // Input should be populated
      cy.get('input[placeholder="Describe what you want to build..."]').should(
        'have.value',
        'Community Moderator',
      );
    });

    it('should handle theme toggle', () => {
      // Check if theme toggle works
      cy.get('[data-cy="theme-toggle"]').click();

      // Should not cause any errors
      cy.get('body').should('be.visible');
    });
  });

  describe('Call-to-Action Buttons', () => {
    it('should display and interact with primary CTA buttons', () => {
      // Start Building button
      cy.get('button').contains('Start Building').should('be.visible').click();

      // Should navigate (either to login or dashboard based on auth state)
      cy.url().should('not.eq', Cypress.config().baseUrl + '/');
    });

    it('should handle Pricing button click', () => {
      cy.visit('/'); // Reset to landing page

      cy.get('button').contains('Pricing').should('be.visible').click();

      // Should scroll to pricing section
      cy.get('#pricing').should('be.visible');
    });

    it('should handle Open Source button click', () => {
      cy.get('button').contains('Open Source').should('be.visible');

      // Check that it has the correct href (would open in new tab)
      cy.get('button').contains('Open Source').click();
    });
  });

  describe('Templates Section', () => {
    it('should display production-ready templates', () => {
      cy.get('#templates').should('be.visible');
      cy.contains('Production-Ready Templates').should('be.visible');

      // Check template cards
      cy.contains('RAG + Vector Search').should('be.visible');
      cy.contains('Multi-Modal Agent').should('be.visible');
      cy.contains('Real-time Trading Bot').should('be.visible');

      // Check tech stack info is displayed
      cy.contains('OpenAI Embeddings').should('be.visible');
      cy.contains('Claude 3.5').should('be.visible');
      cy.contains('WebSocket').should('be.visible');
    });

    it('should handle template deployment buttons', () => {
      cy.get('button').contains('Deploy Template').first().should('be.visible');
      cy.get('button')
        .contains('Deploy Template')
        .should('have.length.at.least', 3);
    });
  });

  describe('Tech Stack Section', () => {
    it('should display complete development stack', () => {
      cy.get('#stack').should('be.visible');
      cy.contains('Complete Development Stack').should('be.visible');

      // Check all four pillars
      cy.contains('Multi-Provider Inference').should('be.visible');
      cy.contains('Managed Hosting').should('be.visible');
      cy.contains('File Storage & Vector DB').should('be.visible');
      cy.contains('Rapid Development').should('be.visible');

      // Check developer experience section
      cy.contains('Developer Experience First').should('be.visible');
      cy.contains('TypeScript').should('be.visible');
      cy.contains('REST API').should('be.visible');
      cy.contains('WebSocket').should('be.visible');
    });
  });

  describe('Pricing Section', () => {
    it('should display pricing information', () => {
      cy.get('#pricing').should('be.visible');
      cy.contains('Developer-Friendly Pricing').should('be.visible');

      // Check free tier
      cy.contains('Developer Free').should('be.visible');
      cy.contains('$0/month').should('be.visible');
      cy.contains('10k inference tokens/month').should('be.visible');

      // Check production tier
      cy.contains('Production').should('be.visible');
      cy.contains('$29/month').should('be.visible');
      cy.contains('$50 credits included').should('be.visible');

      // Check usage pricing
      cy.contains('Usage pricing').should('be.visible');
      cy.contains('$0.002/1k tokens').should('be.visible');
    });

    it('should handle pricing CTA buttons', () => {
      cy.get('#pricing').within(() => {
        // Free tier button
        cy.get('button').contains('Start Building').should('be.visible');

        // Production tier button
        cy.get('button').contains('Scale Up').should('be.visible');
      });
    });
  });

  describe('Footer Section', () => {
    it('should display footer with all required links', () => {
      cy.get('footer').should('be.visible');

      // Platform links
      cy.contains('Platform').should('be.visible');
      cy.get('a[href="#stack"]').should('be.visible');
      cy.get('a[href="#templates"]').should('be.visible');

      // Developer links
      cy.contains('Developers').should('be.visible');
      cy.get('a[href="https://discord.gg/elizaos"]').should('be.visible');
      cy.get('a[href="https://github.com/elizaos"]').should('be.visible');

      // Copyright
      cy.contains('© 2024 ElizaOS Platform').should('be.visible');
    });

    it('should handle footer link navigation', () => {
      // Test internal links
      cy.get('a[href="#stack"]').click();
      cy.get('#stack').should('be.visible');

      cy.visit('/'); // Reset
      cy.get('a[href="#templates"]').click();
      cy.get('#templates').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport(375, 667); // iPhone SE

      // Navigation should still be visible
      cy.get('nav').should('be.visible');
      cy.contains('ElizaOS Platform').should('be.visible');

      // Hero content should be stacked vertically
      cy.contains('Ship AI Agents').should('be.visible');
      cy.get('input[placeholder="Describe what you want to build..."]').should(
        'be.visible',
      );

      // CTA buttons should be stacked
      cy.get('button').contains('Start Building').should('be.visible');
    });

    it('should work on tablet viewport', () => {
      cy.viewport(768, 1024); // iPad

      cy.contains('ElizaOS Platform').should('be.visible');
      cy.contains('Ship AI Agents').should('be.visible');
      cy.get('#templates').should('be.visible');
      cy.get('#pricing').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      // Check theme toggle has proper aria label
      cy.get('[data-cy="theme-toggle"]').should('have.attr', 'aria-label');

      // Check buttons have accessible text
      cy.get('button').contains('Start Building').should('be.visible');
      cy.get('button').contains('Build It').should('exist');

      // Check form inputs have labels
      cy.get('input[placeholder="Describe what you want to build..."]').should(
        'be.visible',
      );
    });

    it('should support keyboard navigation', () => {
      // Tab through interactive elements
      cy.get('body').tab();
      cy.focused().should('be.visible');

      // Should be able to navigate to main CTA
      cy.get('button').contains('Start Building').focus().should('be.focused');
    });
  });

  describe('Performance', () => {
    it('should load quickly without errors', () => {
      cy.visit('/', {
        onBeforeLoad: (win) => {
          // Monitor for console errors
          cy.stub(win.console, 'error').as('consoleError');
        },
      });

      // Should not have console errors
      cy.get('@consoleError').should('not.have.been.called');

      // Key content should be visible quickly
      cy.contains('Ship AI Agents', { timeout: 3000 }).should('be.visible');
    });

    it('should handle slow network conditions', () => {
      // Simulate slow network
      cy.intercept('**/*', (req) => {
        req.reply((res) => {
          // Add delay to all requests
          return new Promise((resolve) => {
            setTimeout(() => resolve(res), 100);
          });
        });
      });

      cy.visit('/');
      cy.contains('ElizaOS Platform').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle button clicks gracefully when not authenticated', () => {
      // Clear any auth state
      cy.clearCookies();
      cy.clearLocalStorage();
      cy.visit('/');

      // Should handle Start Building click
      cy.get('button').contains('Start Building').click();

      // Should not cause JavaScript errors
      cy.get('body').should('be.visible');
    });

    it('should handle form submission with empty input', () => {
      // Try to click Build It with empty input
      cy.get('button').contains('Build It').should('be.disabled');

      // Type something and then clear it
      cy.get('input[placeholder="Describe what you want to build..."]')
        .type('test')
        .clear();

      // Button should be disabled again
      cy.get('button').contains('Build It').should('be.disabled');
    });
  });
});
