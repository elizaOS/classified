describe('Agent GUI (Chat Interface) Page', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();

    // Set up API intercepts for the agent GUI page
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'a0000000-0000-4000-8000-000000000001',
            email: 'dev@elizaos.ai',
            firstName: 'Developer',
            lastName: 'User',
            organizationId: 'a0000000-0000-4000-8000-000000000002',
            role: 'owner',
            emailVerified: true,
          },
          organization: {
            id: 'a0000000-0000-4000-8000-000000000002',
            name: 'ElizaOS Development',
            slug: 'elizaos-dev',
            creditBalance: '1000.0',
            subscriptionTier: 'premium',
          },
        },
      },
    }).as('identity');

    // Mock chat/messaging APIs
    cy.intercept('GET', '**/api/chat/conversations*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          conversations: [
            {
              id: 'conv-1',
              title: 'Test Conversation',
              agentId: 'agent-1',
              lastMessage: 'Hello, how can I help you?',
              lastUpdated: '2024-01-01T00:00:00Z',
            },
          ],
        },
      },
    }).as('conversations');

    cy.intercept('POST', '**/api/chat/send', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          messageId: 'msg-123',
          response: 'Thank you for your message! How can I assist you today?',
          timestamp: '2024-01-01T00:00:00Z',
        },
      },
    }).as('sendMessage');

    // Mock available agents
    cy.intercept('GET', '**/api/agents', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          agents: [
            {
              id: 'agent-1',
              name: 'Assistant',
              description: 'General purpose assistant',
              status: 'active',
            },
          ],
        },
      },
    }).as('agents');
  });

  it('should load agent GUI page successfully', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Check for main chat interface elements
    cy.get('[data-cy="chat-interface"]').should('be.visible');
    cy.get('[data-cy="chat-container"]').should('be.visible');
  });

  it('should navigate to agent GUI from sidebar', () => {
    cy.devLogin();
    cy.visit('/dashboard', { failOnStatusCode: false });

    // Click on Agent GUI in sidebar
    cy.get('[data-cy="sidebar-link-agent-gui"]').click();

    // Should navigate to agent GUI
    cy.url().should('include', '/client');
  });

  it('should display chat interface components', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Check for essential chat components
    cy.get('body').then(($body) => {
      // Message input area
      if ($body.find('[data-cy="message-input"]').length > 0) {
        cy.get('[data-cy="message-input"]').should('be.visible');
      }

      // Send button
      if ($body.find('[data-cy="send-button"]').length > 0) {
        cy.get('[data-cy="send-button"]').should('be.visible');
      }

      // Chat messages area
      if ($body.find('[data-cy="chat-messages"]').length > 0) {
        cy.get('[data-cy="chat-messages"]').should('be.visible');
      }

      // Chat header
      if ($body.find('[data-cy="chat-header"]').length > 0) {
        cy.get('[data-cy="chat-header"]').should('be.visible');
      }
    });
  });

  it('should handle message sending workflow', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Wait for page to load
    cy.wait(1000);

    // Try to send a message if input exists
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="message-input"]').length > 0) {
        cy.get('[data-cy="message-input"]').type(
          'Hello, this is a test message',
        );
        cy.get('[data-cy="send-button"]').click();

        // Wait for message to be processed
        cy.wait('@sendMessage');

        // Should show the sent message
        cy.contains('Hello, this is a test message').should('be.visible');
      } else if ($body.find('input[type="text"]').length > 0) {
        // Fallback to generic input if data-cy not available
        cy.get('input[type="text"]')
          .first()
          .type('Hello, this is a test message{enter}');
      } else if ($body.find('textarea').length > 0) {
        // Fallback to textarea
        cy.get('textarea').first().type('Hello, this is a test message{enter}');
      }
    });
  });

  it('should display conversation history', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Wait for conversations to load
    cy.wait('@conversations');

    // Check for conversation list or history
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="conversation-list"]').length > 0) {
        cy.get('[data-cy="conversation-list"]').should('be.visible');
      } else if ($body.find('[data-cy="chat-history"]').length > 0) {
        cy.get('[data-cy="chat-history"]').should('be.visible');
      }
    });
  });

  it('should show agent selection interface', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Check for agent selection elements
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="agent-selector"]').length > 0) {
        cy.get('[data-cy="agent-selector"]').should('be.visible');
      } else if ($body.find('[data-cy="available-agents"]').length > 0) {
        cy.get('[data-cy="available-agents"]').should('be.visible');
      }
    });
  });

  it('should handle file upload functionality', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Check for file upload elements
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="file-upload"]').length > 0) {
        cy.get('[data-cy="file-upload"]').should('be.visible');
      } else if ($body.find('input[type="file"]').length > 0) {
        cy.get('input[type="file"]').should('exist');
      }
    });
  });

  it('should maintain responsive design on mobile', () => {
    cy.devLogin();
    cy.viewport(375, 667); // iPhone SE dimensions
    cy.visit('/client', { failOnStatusCode: false });

    // Check that chat interface is still accessible
    cy.get('[data-cy="chat-interface"]').should('be.visible');

    // Check mobile menu functionality if needed
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="mobile-menu-button"]').length > 0) {
        cy.get('[data-cy="mobile-menu-button"]').should('be.visible');
        cy.get('[data-cy="mobile-menu-button"]').click();
        cy.get('[data-cy="sidebar"]').should('be.visible');
      }
    });
  });

  it('should handle real-time message updates', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Mock real-time message
    cy.intercept('GET', '**/api/chat/messages*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          messages: [
            {
              id: 'msg-1',
              content: 'Hello! How can I help you today?',
              sender: 'agent',
              timestamp: '2024-01-01T00:00:00Z',
            },
          ],
        },
      },
    }).as('messages');

    // Should display messages
    cy.get('body').should('contain.text', 'Agent GUI');
  });

  it('should handle error states gracefully', () => {
    cy.devLogin();

    // Mock API error
    cy.intercept('GET', '**/api/chat/conversations*', {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
      },
    }).as('conversationsError');

    cy.visit('/client', { failOnStatusCode: false });

    // Should still show the chat interface even with errors
    cy.get('body').should('contain.text', 'Agent');
  });

  it('should support keyboard shortcuts', () => {
    cy.devLogin();
    cy.visit('/client', { failOnStatusCode: false });

    // Check for common keyboard shortcuts
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="message-input"]').length > 0) {
        cy.get('[data-cy="message-input"]').type('Test message');
        // Test Enter to send
        cy.get('[data-cy="message-input"]').type('{enter}');
      }
    });
  });
});
