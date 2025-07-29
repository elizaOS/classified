describe('Agents Management - Complete Test Suite', () => {
  beforeEach(() => {
    // Set up authenticated user state
    cy.window().then((win) => {
      win.localStorage.setItem('auth-token', 'mock-token');
    });

    // Mock authenticated user check
    cy.intercept('GET', '**/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-id',
          email: 'test@elizaos.ai',
          name: 'Test User',
        },
      },
    }).as('authCheck');

    // Mock agents data
    cy.intercept('GET', '**/agents', {
      statusCode: 200,
      body: {
        agents: [
          {
            id: 'agent-1',
            name: 'Support Bot',
            status: 'active',
            description: 'Customer support agent',
            createdAt: '2024-01-01T00:00:00Z',
            conversations: 45,
            uptime: '99.9%',
          },
          {
            id: 'agent-2',
            name: 'Trading Bot',
            status: 'inactive',
            description: 'Crypto trading assistant',
            createdAt: '2024-01-02T00:00:00Z',
            conversations: 12,
            uptime: '95.2%',
          },
        ],
      },
    }).as('agentsList');

    // Mock marketplace data
    cy.intercept('GET', '**/agents/marketplace', {
      statusCode: 200,
      body: {
        featured: [
          {
            id: 'marketplace-1',
            name: 'Customer Service Pro',
            description: 'Advanced customer service agent',
            price: 29,
            rating: 4.8,
            installs: 1250,
          },
        ],
      },
    }).as('marketplace');
  });

  describe('Agents List Page', () => {
    beforeEach(() => {
      cy.visit('/dashboard/agents');
      cy.wait(['@authCheck', '@agentsList']);
    });

    it('should display agents list correctly', () => {
      cy.url().should('include', '/dashboard/agents');

      // Check page title
      cy.contains('My Agents').should('be.visible');

      // Check agents are displayed
      cy.contains('Support Bot').should('be.visible');
      cy.contains('Trading Bot').should('be.visible');

      // Check agent details
      cy.contains('Customer support agent').should('be.visible');
      cy.contains('active').should('be.visible');
      cy.contains('inactive').should('be.visible');
      cy.contains('45').should('be.visible'); // conversations
      cy.contains('99.9%').should('be.visible'); // uptime
    });

    it('should handle agent status indicators', () => {
      // Active agent should have green indicator
      cy.get('[data-agent-id="agent-1"]').within(() => {
        cy.get('[data-cy="status-indicator"]')
          .should('have.class', 'bg-green-500')
          .or('have.class', 'text-success');
        cy.contains('active').should('be.visible');
      });

      // Inactive agent should have different indicator
      cy.get('[data-agent-id="agent-2"]').within(() => {
        cy.get('[data-cy="status-indicator"]')
          .should('have.class', 'bg-gray-500')
          .or('have.class', 'text-typography-weak');
        cy.contains('inactive').should('be.visible');
      });
    });

    it('should handle agent action buttons', () => {
      // Test start/stop buttons
      cy.get('[data-agent-id="agent-2"]').within(() => {
        cy.intercept('POST', '**/agents/agent-2/start', {
          statusCode: 200,
          body: { success: true },
        }).as('startAgent');

        cy.get('button').contains('Start').click();
        cy.wait('@startAgent');
      });

      // Test chat button
      cy.get('[data-agent-id="agent-1"]').within(() => {
        cy.get('button').contains('Chat').click();
      });
      cy.url().should('include', '/characters/chat/agent-1');
    });

    it('should handle Create Agent button', () => {
      cy.get('button').contains('Create Agent').should('be.visible').click();
      cy.url().should('include', '/dashboard/agents/create');
    });

    it('should handle agent filtering and search', () => {
      // Test search functionality
      cy.get('input[placeholder*="Search agents"]').type('Support');
      cy.contains('Support Bot').should('be.visible');
      cy.contains('Trading Bot').should('not.exist');

      // Clear search
      cy.get('input[placeholder*="Search agents"]').clear();
      cy.contains('Trading Bot').should('be.visible');

      // Test status filter
      cy.get('[data-cy="status-filter"]').select('active');
      cy.contains('Support Bot').should('be.visible');
      cy.contains('Trading Bot').should('not.exist');
    });
  });

  describe('Agent Creation Page', () => {
    beforeEach(() => {
      cy.visit('/dashboard/agents/create');
      cy.wait('@authCheck');
    });

    it('should display agent creation form', () => {
      cy.url().should('include', '/dashboard/agents/create');

      // Check form fields
      cy.get('input[name="name"]').should('be.visible');
      cy.get('textarea[name="description"]').should('be.visible');
      cy.get('select[name="template"]').should('be.visible');

      // Check create button
      cy.get('button[type="submit"]')
        .contains('Create Agent')
        .should('be.visible');
    });

    it('should validate form fields', () => {
      // Submit empty form
      cy.get('button[type="submit"]').click();

      // Should show validation errors
      cy.contains('Name is required')
        .should('be.visible')
        .or(cy.get('input[name="name"]:invalid').should('exist'));

      cy.contains('Description is required')
        .should('be.visible')
        .or(cy.get('textarea[name="description"]:invalid').should('exist'));
    });

    it('should handle agent creation', () => {
      // Fill out form
      cy.get('input[name="name"]').type('Test Agent');
      cy.get('textarea[name="description"]').type(
        'A test agent for Cypress testing',
      );
      cy.get('select[name="template"]').select('customer-support');

      // Mock creation API
      cy.intercept('POST', '**/agents', {
        statusCode: 201,
        body: {
          id: 'new-agent-id',
          name: 'Test Agent',
          status: 'inactive',
        },
      }).as('createAgent');

      cy.get('button[type="submit"]').click();
      cy.wait('@createAgent');

      // Should redirect to agents list
      cy.url().should('include', '/dashboard/agents');
      cy.contains('Agent created successfully').should('be.visible');
    });

    it('should handle creation errors', () => {
      cy.get('input[name="name"]').type('Test Agent');
      cy.get('textarea[name="description"]').type('A test agent');

      // Mock creation error
      cy.intercept('POST', '**/agents', {
        statusCode: 400,
        body: { error: 'Agent name already exists' },
      }).as('createError');

      cy.get('button[type="submit"]').click();
      cy.wait('@createError');

      // Should display error message
      cy.contains('Agent name already exists').should('be.visible');
    });
  });

  describe('Agent Marketplace', () => {
    beforeEach(() => {
      cy.visit('/dashboard/agents/marketplace');
      cy.wait(['@authCheck', '@marketplace']);
    });

    it('should display marketplace agents', () => {
      cy.url().should('include', '/dashboard/agents/marketplace');

      // Check page content
      cy.contains('Agent Marketplace').should('be.visible');
      cy.contains('Customer Service Pro').should('be.visible');
      cy.contains('Advanced customer service agent').should('be.visible');
      cy.contains('$29').should('be.visible');
      cy.contains('4.8').should('be.visible'); // rating
      cy.contains('1,250').should('be.visible'); // installs
    });

    it('should handle agent installation', () => {
      // Mock installation API
      cy.intercept('POST', '**/agents/marketplace-1/install', {
        statusCode: 200,
        body: { success: true, agentId: 'installed-agent-id' },
      }).as('installAgent');

      cy.get('button').contains('Install').click();
      cy.wait('@installAgent');

      // Should show success message
      cy.contains('Agent installed successfully').should('be.visible');
    });

    it('should handle marketplace search and filtering', () => {
      // Test search
      cy.get('input[placeholder*="Search marketplace"]').type('Customer');
      cy.contains('Customer Service Pro').should('be.visible');

      // Test category filter
      cy.get('[data-cy="category-filter"]').select('customer-support');
      cy.contains('Customer Service Pro').should('be.visible');

      // Test price filter
      cy.get('[data-cy="price-filter"]').select('paid');
      cy.contains('Customer Service Pro').should('be.visible');
    });
  });

  describe('Agent Editor', () => {
    beforeEach(() => {
      // Mock agent details for editing
      cy.intercept('GET', '**/agents/agent-1', {
        statusCode: 200,
        body: {
          id: 'agent-1',
          name: 'Support Bot',
          description: 'Customer support agent',
          configuration: {
            model: 'gpt-4',
            temperature: 0.7,
            systemPrompt: 'You are a helpful customer support agent.',
          },
        },
      }).as('agentDetails');

      cy.visit('/dashboard/agents/editor?id=agent-1');
      cy.wait(['@authCheck', '@agentDetails']);
    });

    it('should display agent editor interface', () => {
      cy.url().should('include', '/dashboard/agents/editor');

      // Check editor sections
      cy.contains('Agent Configuration').should('be.visible');
      cy.get('input[name="name"]').should('have.value', 'Support Bot');
      cy.get('textarea[name="description"]').should(
        'contain.value',
        'Customer support agent',
      );

      // Check advanced settings
      cy.get('select[name="model"]').should('have.value', 'gpt-4');
      cy.get('input[name="temperature"]').should('have.value', '0.7');
    });

    it('should handle configuration updates', () => {
      // Modify configuration
      cy.get('input[name="name"]').clear().type('Updated Support Bot');
      cy.get('input[name="temperature"]').clear().type('0.8');

      // Mock update API
      cy.intercept('PUT', '**/agents/agent-1', {
        statusCode: 200,
        body: { success: true },
      }).as('updateAgent');

      cy.get('button').contains('Save Changes').click();
      cy.wait('@updateAgent');

      // Should show success message
      cy.contains('Agent updated successfully').should('be.visible');
    });

    it('should handle system prompt editing', () => {
      // Test system prompt editor
      cy.get('textarea[name="systemPrompt"]')
        .should('be.visible')
        .clear()
        .type(
          'You are an advanced customer support agent with expertise in technical issues.',
        );

      // Save changes
      cy.intercept('PUT', '**/agents/agent-1', {
        statusCode: 200,
        body: { success: true },
      }).as('updatePrompt');

      cy.get('button').contains('Save Changes').click();
      cy.wait('@updatePrompt');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty agents list', () => {
      cy.intercept('GET', '**/agents', {
        statusCode: 200,
        body: { agents: [] },
      }).as('emptyAgents');

      cy.visit('/dashboard/agents');
      cy.wait(['@authCheck', '@emptyAgents']);

      // Should show empty state
      cy.contains('No agents found')
        .should('be.visible')
        .or(cy.contains('Create your first agent').should('be.visible'));

      // Should show create button
      cy.get('button').contains('Create Agent').should('be.visible');
    });

    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '**/agents', {
        statusCode: 500,
        body: { error: 'Internal server error' },
      }).as('agentsError');

      cy.visit('/dashboard/agents');
      cy.wait(['@authCheck', '@agentsError']);

      // Should show error message
      cy.contains('Error loading agents')
        .should('be.visible')
        .or(cy.contains('Something went wrong').should('be.visible'));

      // Should have retry button
      cy.get('button').contains('Retry').should('be.visible');
    });

    it('should handle loading states', () => {
      // Mock slow response
      cy.intercept('GET', '**/agents', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              statusCode: 200,
              body: { agents: [] },
            });
          }, 1000);
        });
      }).as('slowAgents');

      cy.visit('/dashboard/agents');
      cy.wait('@authCheck');

      // Should show loading state
      cy.get('[data-cy="loading-skeleton"]')
        .should('be.visible')
        .or(cy.get('.animate-pulse').should('be.visible'));

      cy.wait('@slowAgents');
      cy.get('[data-cy="loading-skeleton"]').should('not.exist');
    });
  });

  describe('Responsive Design and Accessibility', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.visit('/dashboard/agents');
      cy.wait(['@authCheck', '@agentsList']);

      // Agents should be displayed in mobile layout
      cy.contains('Support Bot').should('be.visible');
      cy.contains('Trading Bot').should('be.visible');

      // Create button should be accessible
      cy.get('button').contains('Create Agent').should('be.visible');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/dashboard/agents');
      cy.wait(['@authCheck', '@agentsList']);

      // Should be able to tab through agent cards
      cy.get('[data-agent-id="agent-1"]').focus();
      cy.focused().should('contain', 'Support Bot');

      // Action buttons should be keyboard accessible
      cy.get('button').contains('Chat').focus().should('be.focused');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/dashboard/agents');
      cy.wait(['@authCheck', '@agentsList']);

      // Status indicators should have aria labels
      cy.get('[data-cy="status-indicator"]')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'title');

      // Action buttons should have accessible names
      cy.get('button')
        .contains('Start')
        .should('have.attr', 'aria-label')
        .or('contain.text', 'Start');
    });
  });
});
