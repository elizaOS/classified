/**
 * Comprehensive Project Creation and Completion E2E Tests for Platform
 *
 * Tests the full project lifecycle from creation through completion with real UX validation
 * and project status monitoring across the entire platform interface.
 */

describe('Project Creation and Completion E2E Tests', () => {
  let projectId: string;
  let agentId: string;

  // Get agent ID from environment
  before(() => {
    agentId = Cypress.env('AGENT_IDS')?.split(',')[0];
    if (!agentId) {
      throw new Error('No agent ID provided by test runner');
    }
  });

  beforeEach(() => {
    // Clear state and visit autocoder lander
    cy.clearAllSessionStorage();
    cy.clearLocalStorage();
    cy.visit('/autocoder-lander');
  });

  it('should complete full project lifecycle from creation to completion', () => {
    // Phase 1: Project Creation via UI
    cy.log('Phase 1: Creating project via platform UI');

    // Wait for page to load
    cy.get('h1').should('contain', 'AI-Powered');
    cy.get('input[placeholder="What do you want to build?"]').should(
      'be.visible',
    );

    // Enter project description
    const projectDescription =
      'Create a comprehensive todo list plugin with CRUD operations, priority levels, due dates, and search functionality';
    cy.get('input[placeholder="What do you want to build?"]').type(
      projectDescription,
    );

    // Start project creation
    cy.get('button').contains("LET'S COOK").click();

    // Wait for project creation and dashboard to appear
    cy.get('[data-testid="project-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );

    // Verify project creation UI elements
    cy.get('[data-testid="project-name"]').should('contain', 'Project');
    cy.get('[data-testid="project-status"]').should('be.visible');
    cy.get('[data-testid="progress-bar"]').should('be.visible');

    // Extract project ID from UI for later use
    cy.get('[data-testid="project-id"]')
      .invoke('text')
      .then((text) => {
        projectId = text.trim();
        cy.log(`Project ID captured: ${projectId}`);
      });

    // Phase 2: Monitor Project Status Through Planning Phase
    cy.log('Phase 2: Monitoring planning phase progress');

    // Verify initial planning phase
    cy.get('[data-testid="current-phase"]').should('contain', 'planning');
    cy.get('[data-testid="progress-percentage"]')
      .invoke('text')
      .then((progress) => {
        const progressValue = parseInt(progress.replace('%', ''));
        expect(progressValue).to.be.at.least(0);
        expect(progressValue).to.be.at.most(20);
      });

    // Verify project details are accessible
    cy.get('[data-testid="project-description"]').should(
      'contain',
      'todo list plugin',
    );
    cy.get('[data-testid="project-requirements"]').should('be.visible');

    // Check that status updates are working
    cy.get('[data-testid="last-activity"]').should('be.visible');
    cy.get('[data-testid="active-agents"]').should('contain.text', '1');

    // Phase 3: Monitor Research Phase Transition
    cy.log('Phase 3: Monitoring research phase transition');

    // Wait for research phase to begin (with timeout)
    cy.get('[data-testid="current-phase"]', { timeout: 90000 }).should(
      'contain',
      'research',
    );

    // Verify progress has advanced
    cy.get('[data-testid="progress-percentage"]')
      .invoke('text')
      .then((progress) => {
        const progressValue = parseInt(progress.replace('%', ''));
        expect(progressValue).to.be.at.least(15);
        expect(progressValue).to.be.at.most(35);
      });

    // Verify research activities are visible
    cy.get('[data-testid="activity-log"]').should('contain', 'research');
    cy.get('[data-testid="milestones"]').should('be.visible');

    // Phase 4: Monitor Coding Phase and Artifact Generation
    cy.log('Phase 4: Monitoring coding phase and artifacts');

    // Wait for coding phase (extended timeout for real project work)
    cy.get('[data-testid="current-phase"]', { timeout: 180000 }).should(
      'contain',
      'coding',
    );

    // Verify coding progress
    cy.get('[data-testid="progress-percentage"]')
      .invoke('text')
      .then((progress) => {
        const progressValue = parseInt(progress.replace('%', ''));
        expect(progressValue).to.be.at.least(30);
        expect(progressValue).to.be.at.most(75);
      });

    // Check for artifact generation
    cy.get('[data-testid="artifacts-generated"]').should('be.visible');
    cy.get('[data-testid="artifacts-count"]')
      .invoke('text')
      .then((count) => {
        const artifactCount = parseInt(count);
        expect(artifactCount).to.be.at.least(3); // Expect multiple artifacts
      });

    // Verify code artifacts are listed
    cy.get('[data-testid="artifact-list"]').should('be.visible');
    cy.get('[data-testid="artifact-item"]').should('have.length.at.least', 3);

    // Phase 5: Monitor Testing Phase
    cy.log('Phase 5: Monitoring testing phase');

    // Wait for testing phase
    cy.get('[data-testid="current-phase"]', { timeout: 120000 }).should(
      'contain',
      'testing',
    );

    // Verify testing progress
    cy.get('[data-testid="progress-percentage"]')
      .invoke('text')
      .then((progress) => {
        const progressValue = parseInt(progress.replace('%', ''));
        expect(progressValue).to.be.at.least(70);
        expect(progressValue).to.be.at.most(95);
      });

    // Check test results
    cy.get('[data-testid="test-results"]').should('be.visible');
    cy.get('[data-testid="tests-passing"]').should('contain', 'true');

    // Phase 6: Monitor Project Completion
    cy.log('Phase 6: Monitoring project completion');

    // Wait for completion (final phase)
    cy.get('[data-testid="project-status"]', { timeout: 90000 }).should(
      'contain',
      'completed',
    );

    // Verify final progress
    cy.get('[data-testid="progress-percentage"]').should('contain', '100%');
    cy.get('[data-testid="current-phase"]').should('contain', 'completed');

    // Verify completion indicators
    cy.get('[data-testid="completion-checkmark"]').should('be.visible');
    cy.get('[data-testid="project-summary"]').should('be.visible');

    // Check final artifact count
    cy.get('[data-testid="artifacts-count"]')
      .invoke('text')
      .then((count) => {
        const finalArtifactCount = parseInt(count);
        expect(finalArtifactCount).to.be.at.least(10); // Expect comprehensive artifacts
      });

    // Verify deployment information
    cy.get('[data-testid="repository-url"]').should('be.visible');
    cy.get('[data-testid="deployment-status"]').should('contain', 'ready');
  });

  it('should provide real-time project status updates via WebSocket', () => {
    cy.log('Testing real-time status updates');

    // Start a simple project
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Simple test project for status monitoring',
    );
    cy.get('button').contains("LET'S COOK").click();

    // Wait for dashboard
    cy.get('[data-testid="project-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );

    // Verify WebSocket connection indicator
    cy.get('[data-testid="connection-status"]').should('contain', 'Connected');

    // Monitor real-time updates by checking timestamp changes
    let initialTimestamp: string;
    cy.get('[data-testid="last-activity"]')
      .invoke('text')
      .then((timestamp) => {
        initialTimestamp = timestamp;
      });

    // Wait and verify timestamp has updated (indicating real-time updates)
    cy.wait(10000); // Wait 10 seconds
    cy.get('[data-testid="last-activity"]')
      .invoke('text')
      .should((newTimestamp) => {
        expect(newTimestamp).to.not.equal(initialTimestamp);
      });

    // Verify status changes are reflected in real-time
    cy.get('[data-testid="current-phase"]').should('be.visible');
    cy.get('[data-testid="progress-bar"]')
      .should('have.attr', 'value')
      .and('match', /^\d+$/);
  });

  it('should handle project scaling and agent management', () => {
    cy.log('Testing project scaling functionality');

    // Create project
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Complex multi-module application requiring multiple agents',
    );
    cy.get('button').contains("LET'S COOK").click();

    // Wait for dashboard
    cy.get('[data-testid="project-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );

    // Test agent scaling
    cy.get('[data-testid="scale-project-button"]').should('be.visible');
    cy.get('[data-testid="current-agent-count"]')
      .invoke('text')
      .then((count) => {
        const currentCount = parseInt(count);

        // Scale up agents
        cy.get('[data-testid="scale-up-button"]').click();

        // Verify scaling operation
        cy.get('[data-testid="scaling-status"]').should('contain', 'Scaling');

        // Wait for scaling to complete
        cy.get('[data-testid="current-agent-count"]', { timeout: 30000 })
          .invoke('text')
          .should((newCount) => {
            expect(parseInt(newCount)).to.be.greaterThan(currentCount);
          });
      });

    // Verify agent list is updated
    cy.get('[data-testid="agent-list"]').should('be.visible');
    cy.get('[data-testid="agent-item"]').should('have.length.at.least', 2);
  });

  it('should allow project status control (pause, resume, cancel)', () => {
    cy.log('Testing project status control');

    // Create project
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Test project for status control',
    );
    cy.get('button').contains("LET'S COOK").click();

    // Wait for dashboard
    cy.get('[data-testid="project-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );

    // Test pause functionality
    cy.get('[data-testid="pause-project-button"]').should('be.visible');
    cy.get('[data-testid="pause-project-button"]').click();

    // Verify pause confirmation
    cy.get('[data-testid="project-status"]').should('contain', 'paused');
    cy.get('[data-testid="pause-indicator"]').should('be.visible');

    // Test resume functionality
    cy.get('[data-testid="resume-project-button"]').should('be.visible');
    cy.get('[data-testid="resume-project-button"]').click();

    // Verify resume
    cy.get('[data-testid="project-status"]').should('not.contain', 'paused');
    cy.get('[data-testid="pause-indicator"]').should('not.exist');

    // Test status messaging
    cy.get('[data-testid="status-message"]').should('contain', 'resumed');
  });

  it('should display comprehensive project analytics and metrics', () => {
    cy.log('Testing project analytics and metrics');

    // Create project and let it run for a bit
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Analytics test project with comprehensive metrics',
    );
    cy.get('button').contains("LET'S COOK").click();

    // Wait for dashboard
    cy.get('[data-testid="project-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );

    // Wait for some activity to generate metrics
    cy.wait(30000);

    // Verify analytics section
    cy.get('[data-testid="project-analytics"]').should('be.visible');

    // Check key metrics
    cy.get('[data-testid="total-artifacts"]').should('be.visible');
    cy.get('[data-testid="completion-time"]').should('be.visible');
    cy.get('[data-testid="agent-efficiency"]').should('be.visible');

    // Verify progress chart
    cy.get('[data-testid="progress-chart"]').should('be.visible');

    // Check milestone tracking
    cy.get('[data-testid="milestone-list"]').should('be.visible');
    cy.get('[data-testid="milestone-item"]').should('have.length.at.least', 1);

    // Verify time tracking
    cy.get('[data-testid="time-elapsed"]').should('be.visible');
    cy.get('[data-testid="estimated-completion"]').should('be.visible');
  });

  it('should handle error states and provide recovery options', () => {
    cy.log('Testing error handling and recovery');

    // Simulate network error by intercepting API calls
    cy.intercept('POST', '/api/autocoder/swarm/create', {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('createProjectError');

    // Try to create project
    cy.get('input[placeholder="What do you want to build?"]').type(
      'Error test project',
    );
    cy.get('button').contains("LET'S COOK").click();

    // Wait for error response
    cy.wait('@createProjectError');

    // Verify error message is displayed
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.get('[data-testid="error-message"]').should('contain', 'Failed');

    // Verify retry option is available
    cy.get('[data-testid="retry-button"]').should('be.visible');

    // Test retry functionality
    cy.intercept('POST', '/api/autocoder/swarm/create', {
      statusCode: 200,
      body: {
        success: true,
        projectId: 'test-project-123',
        swarmProject: {
          id: 'test-project-123',
          name: 'Error Test Project',
          status: 'planning',
          progress: 5,
        },
      },
    }).as('createProjectSuccess');

    cy.get('[data-testid="retry-button"]').click();
    cy.wait('@createProjectSuccess');

    // Verify recovery
    cy.get('[data-testid="project-dashboard"]').should('be.visible');
    cy.get('[data-testid="error-message"]').should('not.exist');
  });

  afterEach(() => {
    // Cleanup: Cancel any running projects
    if (projectId) {
      cy.request({
        method: 'PATCH',
        url: `/api/autocoder/swarm/status/${projectId}`,
        body: { action: 'cancel', reason: 'Test cleanup' },
        failOnStatusCode: false,
      });
    }
  });
});
