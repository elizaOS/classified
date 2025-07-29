describe('Agent Management', () => {
  beforeEach(() => {
    cy.loginAsTestUser();
  });

  describe('Agent List', () => {
    it('should display agent list page', () => {
      cy.visit('/agents');

      cy.get('[data-cy="page-title"]').should('contain', 'My Agents');
      cy.get('[data-cy="create-agent-button"]').should('be.visible');
      cy.get('[data-cy="agent-list"]').should('be.visible');
      cy.get('[data-cy="agent-filters"]').should('be.visible');
    });

    it('should display agent cards with correct information', () => {
      cy.mockApiSuccess('GET', 'agents', {
        agents: [
          {
            id: 'agent-1',
            name: 'Customer Support Bot',
            description: 'Handles customer inquiries',
            status: 'active',
            visibility: 'public',
            interactions: 5250,
            lastActive: new Date().toISOString(),
            plugins: ['openai', 'email'],
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 'agent-2',
            name: 'FAQ Bot',
            description: 'Answers frequently asked questions',
            status: 'draft',
            visibility: 'private',
            interactions: 0,
            lastActive: null,
            plugins: ['openai'],
            createdAt: new Date(Date.now() - 172800000).toISOString(),
          },
        ],
      });

      cy.visit('/agents');

      cy.get('[data-cy="agent-card"]').should('have.length', 2);

      cy.get('[data-cy="agent-card"]')
        .first()
        .within(() => {
          cy.get('[data-cy="agent-name"]').should(
            'contain',
            'Customer Support Bot',
          );
          cy.get('[data-cy="agent-description"]').should(
            'contain',
            'Handles customer inquiries',
          );
          cy.get('[data-cy="agent-status"]').should('contain', 'Active');
          cy.get('[data-cy="agent-interactions"]').should('contain', '5,250');
          cy.get('[data-cy="agent-plugins"]').should('contain', 'openai');
          cy.get('[data-cy="agent-plugins"]').should('contain', 'email');
        });
    });

    it('should filter agents by status', () => {
      cy.visit('/agents');

      cy.get('[data-cy="status-filter"]').click();
      cy.get('[data-cy="filter-option-active"]').click();

      cy.get('[data-cy="agent-card"]').each(($card) => {
        cy.wrap($card)
          .find('[data-cy="agent-status"]')
          .should('contain', 'Active');
      });
    });

    it('should search agents by name', () => {
      cy.visit('/agents');

      cy.get('[data-cy="agent-search"]').type('FAQ');

      cy.get('[data-cy="agent-card"]').should('have.length', 1);
      cy.get('[data-cy="agent-card"]').should('contain', 'FAQ Bot');
    });

    it('should sort agents', () => {
      cy.visit('/agents');

      cy.get('[data-cy="sort-dropdown"]').click();
      cy.get('[data-cy="sort-by-interactions"]').click();

      // Verify sorting order
      let previousInteractions = Infinity;
      cy.get('[data-cy="agent-interactions"]').each(($el) => {
        const interactions = parseInt($el.text(, 10).replace(/,/g, ''));
        expect(interactions).to.be.at.most(previousInteractions);
        previousInteractions = interactions;
      });
    });
  });

  describe('Agent Creation', () => {
    it('should navigate to agent creation page', () => {
      cy.visit('/agents');
      cy.get('[data-cy="create-agent-button"]').click();
      cy.url().should('include', '/agents/new');
    });

    it('should display agent creation form', () => {
      cy.visit('/agents/new');

      cy.get('[data-cy="agent-form"]').should('be.visible');
      cy.get('[data-cy="agent-name-input"]').should('be.visible');
      cy.get('[data-cy="agent-description-input"]').should('be.visible');
      cy.get('[data-cy="agent-instructions-input"]').should('be.visible');
      cy.get('[data-cy="agent-plugins-select"]').should('be.visible');
      cy.get('[data-cy="agent-model-select"]').should('be.visible');
      cy.get('[data-cy="create-agent-submit"]').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.visit('/agents/new');

      cy.get('[data-cy="create-agent-submit"]').click();

      cy.get('[data-cy="name-error"]').should('contain', 'Name is required');
      cy.get('[data-cy="description-error"]').should(
        'contain',
        'Description is required',
      );
    });

    it('should create agent successfully', () => {
      cy.visit('/agents/new');

      // Mock agent creation
      cy.mockApiSuccess('POST', 'agents', {
        id: 'new-agent-123',
        name: 'New Test Agent',
        slug: 'new-test-agent',
        status: 'draft',
      });

      // Fill form
      cy.get('[data-cy="agent-name-input"]').type('New Test Agent');
      cy.get('[data-cy="agent-description-input"]').type(
        'A test agent for automation',
      );
      cy.get('[data-cy="agent-instructions-input"]').type(
        'You are a helpful assistant',
      );

      // Select plugins
      cy.get('[data-cy="agent-plugins-select"]').click();
      cy.get('[data-cy="plugin-option-openai"]').click();
      cy.get('[data-cy="plugin-option-web-search"]').click();
      cy.get('body').click(0, 0); // Close dropdown

      // Select model
      cy.get('[data-cy="agent-model-select"]').select('gpt-4');

      // Submit
      cy.get('[data-cy="create-agent-submit"]').click();

      // Should redirect to agent details
      cy.url().should('include', '/agents/new-agent-123');
      cy.get('[data-cy="success-message"]').should(
        'contain',
        'Agent created successfully',
      );
    });

    it('should save draft and continue editing', () => {
      cy.visit('/agents/new');

      cy.mockApiSuccess('POST', 'agents', {
        id: 'draft-agent-123',
        name: 'Draft Agent',
        status: 'draft',
      });

      cy.get('[data-cy="agent-name-input"]').type('Draft Agent');
      cy.get('[data-cy="agent-description-input"]').type('Work in progress');

      cy.get('[data-cy="save-draft-button"]').click();

      cy.get('[data-cy="draft-saved-message"]').should('be.visible');
      cy.url().should('include', '/agents/draft-agent-123/edit');
    });
  });

  describe('Agent Details', () => {
    beforeEach(() => {
      cy.mockApiSuccess('GET', 'agents/agent-123', {
        id: 'agent-123',
        name: 'Test Agent',
        description: 'A test agent',
        instructions: 'You are a helpful assistant',
        status: 'active',
        visibility: 'public',
        plugins: ['openai', 'web-search'],
        model: 'gpt-4',
        interactions: 1250,
        averageResponseTime: 1.2,
        satisfactionRate: 92,
        createdAt: new Date(Date.now() - 604800000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      });
    });

    it('should display agent details', () => {
      cy.visit('/agents/agent-123');

      cy.get('[data-cy="agent-detail-header"]').should('contain', 'Test Agent');
      cy.get('[data-cy="agent-status-badge"]').should('contain', 'Active');
      cy.get('[data-cy="agent-visibility-badge"]').should('contain', 'Public');

      // Stats
      cy.get('[data-cy="stat-interactions"]').should('contain', '1,250');
      cy.get('[data-cy="stat-response-time"]').should('contain', '1.2s');
      cy.get('[data-cy="stat-satisfaction"]').should('contain', '92%');

      // Configuration
      cy.get('[data-cy="agent-model"]').should('contain', 'GPT-4');
      cy.get('[data-cy="agent-plugins"]').should('contain', 'OpenAI');
      cy.get('[data-cy="agent-plugins"]').should('contain', 'Web Search');
    });

    it('should navigate to edit page', () => {
      cy.visit('/agents/agent-123');
      cy.get('[data-cy="edit-agent-button"]').click();
      cy.url().should('include', '/agents/agent-123/edit');
    });

    it('should deploy agent', () => {
      cy.mockApiSuccess('GET', 'agents/draft-agent', {
        id: 'draft-agent',
        name: 'Draft Agent',
        status: 'draft',
        description: 'Ready to deploy',
      });

      cy.mockApiSuccess('POST', 'agents/draft-agent/deploy', {
        success: true,
        deploymentUrl: 'https://api.elizaos.ai/agents/draft-agent',
      });

      cy.visit('/agents/draft-agent');
      cy.get('[data-cy="deploy-agent-button"]').click();

      cy.get('[data-cy="deploy-confirmation-modal"]').should('be.visible');
      cy.get('[data-cy="confirm-deploy"]').click();

      cy.get('[data-cy="deployment-success"]').should('be.visible');
      cy.get('[data-cy="deployment-url"]').should('contain', 'api.elizaos.ai');
    });

    it('should deactivate agent', () => {
      cy.mockApiSuccess('PUT', 'agents/agent-123/status', {
        status: 'inactive',
      });

      cy.visit('/agents/agent-123');
      cy.get('[data-cy="agent-actions-menu"]').click();
      cy.get('[data-cy="deactivate-agent"]').click();

      cy.get('[data-cy="confirmation-modal"]').should('be.visible');
      cy.get('[data-cy="confirm-deactivate"]').click();

      cy.get('[data-cy="agent-status-badge"]').should('contain', 'Inactive');
    });
  });

  describe('Agent Editing', () => {
    beforeEach(() => {
      cy.mockApiSuccess('GET', 'agents/agent-123', {
        id: 'agent-123',
        name: 'Test Agent',
        description: 'Original description',
        instructions: 'Original instructions',
        status: 'active',
        plugins: ['openai'],
        model: 'gpt-3.5-turbo',
      });
    });

    it('should display edit form with current values', () => {
      cy.visit('/agents/agent-123/edit');

      cy.get('[data-cy="agent-name-input"]').should('have.value', 'Test Agent');
      cy.get('[data-cy="agent-description-input"]').should(
        'have.value',
        'Original description',
      );
      cy.get('[data-cy="agent-instructions-input"]').should(
        'have.value',
        'Original instructions',
      );
      cy.get('[data-cy="agent-model-select"]').should(
        'have.value',
        'gpt-3.5-turbo',
      );
    });

    it('should update agent successfully', () => {
      cy.mockApiSuccess('PUT', 'agents/agent-123', {
        id: 'agent-123',
        name: 'Updated Agent',
        description: 'Updated description',
      });

      cy.visit('/agents/agent-123/edit');

      cy.get('[data-cy="agent-name-input"]').clear().type('Updated Agent');
      cy.get('[data-cy="agent-description-input"]')
        .clear()
        .type('Updated description');

      cy.get('[data-cy="save-changes-button"]').click();

      cy.get('[data-cy="success-message"]').should(
        'contain',
        'Agent updated successfully',
      );
      cy.url().should('include', '/agents/agent-123');
    });

    it('should handle concurrent edit warning', () => {
      cy.mockApiError(
        'PUT',
        'agents/agent-123',
        'Agent was modified by another user',
        409,
      );

      cy.visit('/agents/agent-123/edit');

      cy.get('[data-cy="agent-name-input"]').clear().type('Conflicting Update');
      cy.get('[data-cy="save-changes-button"]').click();

      cy.get('[data-cy="conflict-modal"]').should('be.visible');
      cy.get('[data-cy="conflict-message"]').should(
        'contain',
        'modified by another user',
      );
    });
  });

  describe('Agent Testing', () => {
    it('should open test chat interface', () => {
      cy.visit('/agents/agent-123');
      cy.get('[data-cy="test-agent-button"]').click();

      cy.get('[data-cy="test-chat-modal"]').should('be.visible');
      cy.get('[data-cy="chat-input"]').should('be.visible');
      cy.get('[data-cy="chat-messages"]').should('be.visible');
    });

    it('should send test message and receive response', () => {
      cy.mockApiSuccess('POST', 'agents/agent-123/test', {
        response: 'Hello! I am your test agent. How can I help you?',
        responseTime: 0.8,
      });

      cy.visit('/agents/agent-123');
      cy.get('[data-cy="test-agent-button"]').click();

      cy.get('[data-cy="chat-input"]').type('Hello');
      cy.get('[data-cy="send-message-button"]').click();

      cy.get('[data-cy="user-message"]').should('contain', 'Hello');
      cy.get('[data-cy="agent-message"]').should(
        'contain',
        'Hello! I am your test agent',
      );
      cy.get('[data-cy="response-time"]').should('contain', '0.8s');
    });
  });

  describe('Agent Analytics', () => {
    it('should display analytics dashboard', () => {
      cy.mockApiSuccess('GET', 'agents/agent-123/analytics', {
        interactions: {
          total: 5250,
          today: 125,
          thisWeek: 890,
          thisMonth: 2100,
        },
        performance: {
          averageResponseTime: 1.2,
          satisfactionRate: 92,
          errorRate: 0.5,
        },
        usage: {
          tokensUsed: 125000,
          costEstimate: 2.5,
        },
      });

      cy.visit('/agents/agent-123/analytics');

      cy.get('[data-cy="analytics-header"]').should('contain', 'Analytics');

      // Interaction stats
      cy.get('[data-cy="total-interactions"]').should('contain', '5,250');
      cy.get('[data-cy="today-interactions"]').should('contain', '125');

      // Performance metrics
      cy.get('[data-cy="avg-response-time"]').should('contain', '1.2s');
      cy.get('[data-cy="satisfaction-rate"]').should('contain', '92%');
      cy.get('[data-cy="error-rate"]').should('contain', '0.5%');

      // Usage
      cy.get('[data-cy="tokens-used"]').should('contain', '125,000');
      cy.get('[data-cy="cost-estimate"]').should('contain', '$2.50');
    });

    it('should display interaction timeline chart', () => {
      cy.mockApiSuccess('GET', 'agents/agent-123/analytics/timeline', {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Interactions',
            data: [120, 150, 110, 180, 160, 90, 125],
          },
        ],
      });

      cy.visit('/agents/agent-123/analytics');
      cy.get('[data-cy="timeline-chart"]').should('be.visible');
    });
  });

  describe('Agent Deletion', () => {
    it('should show delete confirmation', () => {
      cy.visit('/agents/agent-123');
      cy.get('[data-cy="agent-actions-menu"]').click();
      cy.get('[data-cy="delete-agent"]').click();

      cy.get('[data-cy="delete-confirmation-modal"]').should('be.visible');
      cy.get('[data-cy="delete-warning"]').should(
        'contain',
        'This action cannot be undone',
      );
      cy.get('[data-cy="confirm-agent-name"]').should('be.visible');
    });

    it('should require agent name confirmation', () => {
      cy.visit('/agents/agent-123');
      cy.get('[data-cy="agent-actions-menu"]').click();
      cy.get('[data-cy="delete-agent"]').click();

      // Try to delete without entering name
      cy.get('[data-cy="confirm-delete-button"]').should('be.disabled');

      // Enter wrong name
      cy.get('[data-cy="confirm-agent-name"]').type('Wrong Name');
      cy.get('[data-cy="confirm-delete-button"]').should('be.disabled');

      // Enter correct name
      cy.get('[data-cy="confirm-agent-name"]').clear().type('Test Agent');
      cy.get('[data-cy="confirm-delete-button"]').should('not.be.disabled');
    });

    it('should delete agent successfully', () => {
      cy.mockApiSuccess('DELETE', 'agents/agent-123', {
        success: true,
      });

      cy.visit('/agents/agent-123');
      cy.get('[data-cy="agent-actions-menu"]').click();
      cy.get('[data-cy="delete-agent"]').click();

      cy.get('[data-cy="confirm-agent-name"]').type('Test Agent');
      cy.get('[data-cy="confirm-delete-button"]').click();

      cy.url().should('include', '/agents');
      cy.get('[data-cy="success-message"]').should(
        'contain',
        'Agent deleted successfully',
      );
    });
  });

  describe('Agent Cloning', () => {
    it('should clone agent', () => {
      cy.mockApiSuccess('POST', 'agents/agent-123/clone', {
        id: 'cloned-agent-456',
        name: 'Test Agent (Copy)',
        status: 'draft',
      });

      cy.visit('/agents/agent-123');
      cy.get('[data-cy="agent-actions-menu"]').click();
      cy.get('[data-cy="clone-agent"]').click();

      cy.get('[data-cy="clone-modal"]').should('be.visible');
      cy.get('[data-cy="clone-name-input"]').should(
        'have.value',
        'Test Agent (Copy)',
      );

      cy.get('[data-cy="confirm-clone"]').click();

      cy.url().should('include', '/agents/cloned-agent-456/edit');
      cy.get('[data-cy="info-message"]').should(
        'contain',
        'Agent cloned successfully',
      );
    });
  });
});
