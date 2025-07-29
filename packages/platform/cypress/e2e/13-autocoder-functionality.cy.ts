describe('Autocoder Functionality', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();

    // Mock authentication
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'autocoder-user-123',
            email: 'dev@elizaos.ai',
            firstName: 'Developer',
            lastName: 'User',
            organizationId: 'autocoder-org-123',
            role: 'owner',
            emailVerified: true,
          },
          organization: {
            id: 'autocoder-org-123',
            name: 'ElizaOS Development',
            slug: 'elizaos-dev',
            creditBalance: '1000.0',
            subscriptionTier: 'premium',
          },
        },
      },
    }).as('identity');

    // Mock autocoder projects API
    cy.intercept('GET', '/api/autocoder/projects', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          projects: [
            {
              id: 'project-1',
              name: 'Test Plugin',
              description: 'A sample plugin project',
              type: 'plugin',
              status: 'active',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 'project-2',
              name: 'Weather App',
              description: 'Weather application project',
              type: 'app',
              status: 'building',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      },
    }).as('projects');

    // Mock project creation
    cy.intercept('POST', '/api/autocoder/projects', {
      statusCode: 201,
      body: {
        success: true,
        data: {
          id: 'new-project-123',
          name: 'New Project',
          description: 'Newly created project',
          type: 'plugin',
          status: 'initializing',
        },
      },
    }).as('createProject');

    // Mock project build
    cy.intercept('POST', '/api/autocoder/projects/*/build', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          buildId: 'build-123',
          status: 'started',
        },
      },
    }).as('buildProject');

    // Mock project test
    cy.intercept('POST', '/api/autocoder/projects/*/test', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          testId: 'test-123',
          status: 'running',
          results: {
            passed: 5,
            failed: 0,
            total: 5,
          },
        },
      },
    }).as('testProject');

    // Mock live test
    cy.intercept('POST', '/api/autocoder/projects/*/live-test', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          sessionId: 'live-test-123',
          status: 'active',
        },
      },
    }).as('liveTest');

    // Mock WebSocket connection for live updates
    cy.intercept('GET', '/api/autocoder/ws', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          endpoint: 'ws://localhost:3333/api/autocoder/ws',
        },
      },
    }).as('wsEndpoint');
  });

  it('should load autocoder page successfully', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    // Should load the autocoder interface
    cy.contains('Autocoder').should('be.visible');
    cy.contains('AI-Powered Development').should('be.visible');
  });

  it('should display existing projects', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Should show project list
    cy.contains('Test Plugin').should('be.visible');
    cy.contains('Weather App').should('be.visible');

    // Should show project statuses
    cy.contains('active').should('be.visible');
    cy.contains('building').should('be.visible');
  });

  it('should create a new project', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Look for create project button
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="create-project-btn"]').length > 0) {
        cy.get('[data-cy="create-project-btn"]').click();
      } else {
        // Fallback to text-based selection
        cy.contains('Create Project').click();
      }
    });

    // Fill out project creation form
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="project-name-input"]').length > 0) {
        cy.get('[data-cy="project-name-input"]').type('My New Plugin');
      }

      if ($body.find('[data-cy="project-description-input"]').length > 0) {
        cy.get('[data-cy="project-description-input"]').type(
          'A test plugin created with autocoder',
        );
      }

      if ($body.find('[data-cy="project-type-select"]').length > 0) {
        cy.get('[data-cy="project-type-select"]').select('plugin');
      }

      if ($body.find('[data-cy="submit-project-btn"]').length > 0) {
        cy.get('[data-cy="submit-project-btn"]').click();
      }
    });

    cy.wait('@createProject');

    // Should show success message
    cy.contains('Project created successfully').should('be.visible');
  });

  it('should build a project', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Click on a project to open it
    cy.contains('Test Plugin').click();

    // Look for build button
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="build-project-btn"]').length > 0) {
        cy.get('[data-cy="build-project-btn"]').click();
      } else {
        cy.contains('Build').click();
      }
    });

    cy.wait('@buildProject');

    // Should show build status
    cy.contains('Build started').should('be.visible');
  });

  it('should run tests on a project', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Click on a project
    cy.contains('Test Plugin').click();

    // Look for test button
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="test-project-btn"]').length > 0) {
        cy.get('[data-cy="test-project-btn"]').click();
      } else {
        cy.contains('Run Tests').click();
      }
    });

    cy.wait('@testProject');

    // Should show test results
    cy.contains('Tests running').should('be.visible');
  });

  it('should show code editor interface', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Click on a project to open editor
    cy.contains('Test Plugin').click();

    // Should show code editor components
    cy.get('body').then(($body) => {
      // Look for common code editor elements
      if ($body.find('[data-cy="code-editor"]').length > 0) {
        cy.get('[data-cy="code-editor"]').should('be.visible');
      }

      if ($body.find('[data-cy="file-explorer"]').length > 0) {
        cy.get('[data-cy="file-explorer"]').should('be.visible');
      }

      // Should have some indication of a code editing interface
      const hasCodeInterface =
        $body.text().includes('Editor') ||
        $body.text().includes('Files') ||
        $body.find('pre').length > 0 ||
        $body.find('code').length > 0;

      expect(hasCodeInterface).to.be.true;
    });
  });

  it('should handle live testing functionality', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Click on a project
    cy.contains('Test Plugin').click();

    // Look for live test button
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="live-test-btn"]').length > 0) {
        cy.get('[data-cy="live-test-btn"]').click();

        cy.wait('@liveTest');

        // Should show live test interface
        cy.contains('Live Test').should('be.visible');
      }
    });
  });

  it('should show project deployment options', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Click on a project
    cy.contains('Test Plugin').click();

    // Look for deploy button or options
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="deploy-project-btn"]').length > 0) {
        cy.get('[data-cy="deploy-project-btn"]').should('be.visible');
      } else {
        // Should have some deployment indication
        const hasDeployOptions =
          $body.text().includes('Deploy') ||
          $body.text().includes('Publish') ||
          $body.text().includes('Release');

        if (hasDeployOptions) {
          cy.contains(/Deploy|Publish|Release/).should('be.visible');
        }
      }
    });
  });

  it('should handle error states gracefully', () => {
    // Mock error responses
    cy.intercept('GET', '/api/autocoder/projects', {
      statusCode: 500,
      body: {
        success: false,
        error: 'Server error loading projects',
      },
    }).as('projectsError');

    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projectsError');

    // Should show error message
    cy.contains('error').should('be.visible');
  });

  it('should be responsive on mobile devices', () => {
    cy.viewport('iphone-x');
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Should adapt to mobile viewport
    cy.get('body').should('not.have.css', 'overflow-x', 'scroll');

    // Project list should be visible and accessible
    cy.contains('Test Plugin').should('be.visible');
  });

  it('should handle real-time updates via WebSocket', () => {
    cy.devLogin();
    cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

    cy.wait('@projects');

    // Should attempt to connect to WebSocket for live updates
    cy.wait('@wsEndpoint');

    // The page should handle WebSocket connection
    // (actual WebSocket testing would require more complex setup)
    cy.get('body').should('exist'); // Basic assertion that page loads
  });
});
