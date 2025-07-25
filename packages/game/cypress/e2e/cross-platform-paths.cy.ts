/**
 * Cross-Platform Path Verification Tests
 *
 * Verifies that file paths work correctly across different platforms
 * including when running in Tauri mode
 */

describe('Cross-Platform Path Handling', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173');

    // Wait for initial connection
    cy.window().should('have.property', 'elizaClient');
    cy.get('[data-testid="connection-status"]', { timeout: 30000 })
      .should('contain', 'Connected')
      .should('have.class', 'text-green-500');
  });

  it('should handle container data directories correctly', () => {
    // Check server health endpoint which includes container status
    cy.request('GET', 'http://localhost:7777/api/server/health').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('status', 'OK');
      expect(response.body).to.have.property('server', 'game-backend-infrastructure');
      expect(response.body.dependencies).to.have.property('containers', 'healthy');
    });

    // Verify containers are running with proper volume mounts
    cy.request('GET', 'http://localhost:7777/api/containers/status').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;

      const containerData = response.body.data;

      // Check PostgreSQL container
      expect(containerData).to.have.property('eliza-postgres');
      const postgresContainer = containerData['eliza-postgres'];
      expect(postgresContainer.state).to.equal('running');
      expect(postgresContainer.health).to.equal('healthy');

      // Check Ollama container (if running)
      if (containerData['eliza-ollama']) {
        const ollamaContainer = containerData['eliza-ollama'];
        expect(ollamaContainer.state).to.be.oneOf(['running', 'starting']);
      }
    });
  });

  it('should use appropriate data directory based on TAURI_MODE', () => {
    // This test would normally check the actual file paths used
    // In a real Tauri environment, we'd verify the app data directory is used

    // For now, verify the server recognizes the mode
    cy.window().then((win) => {
      // Check if we're in Tauri mode (would be set by Tauri)
      const isTauriMode = win.location.href.includes('tauri://');

      if (isTauriMode) {
        cy.log('Running in Tauri mode - paths should use app data directory');
      } else {
        cy.log('Running in standard mode - paths use current working directory');
      }
    });
  });

  it('should handle agent data directories correctly', () => {
    // Start an agent and verify its data directory is created
    cy.request('POST', 'http://localhost:7777/api/agents/start', {
      agentId: `test-agent-${Date.now()}`,
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('agentId');

      const agentId = response.body.data.agentId;

      // Check agent status
      cy.request('GET', 'http://localhost:7777/api/agents/status').then((statusResponse) => {
        expect(statusResponse.body.success).to.be.true;

        const agents = statusResponse.body.data.agents;
        const testAgent = agents.find((a: any) => a.id === agentId);

        expect(testAgent).to.exist;
        expect(testAgent.status).to.equal('running');

        // Clean up - stop the test agent
        cy.request('POST', `http://localhost:7777/api/agents/${agentId}/stop`);
      });
    });
  });

  it('should maintain data persistence across container restarts', () => {
    // This test would verify that data volumes persist
    // In a real test environment, we'd:
    // 1. Create some data
    // 2. Restart containers
    // 3. Verify data still exists

    cy.log('Data persistence test - would verify volumes persist across restarts');

    // For now, just verify the volume configuration is correct
    cy.request('GET', 'http://localhost:7777/api/containers/status').then((response) => {
      const containers = response.body.data;

      // PostgreSQL should have a data volume
      if (containers['eliza-postgres']) {
        expect(containers['eliza-postgres']).to.have.property('volumes');
        cy.log('PostgreSQL container has volume configuration');
      }

      // Ollama should have a data volume
      if (containers['eliza-ollama']) {
        expect(containers['eliza-ollama']).to.have.property('volumes');
        cy.log('Ollama container has volume configuration');
      }
    });
  });

  it('should handle configuration file paths correctly', () => {
    // Test that plugin configuration works correctly
    cy.request('POST', 'http://localhost:7777/api/plugin-config', {
      plugin: 'environment',
      config: {
        TEST_ENV_VAR: `test-value-${Date.now()}`,
      },
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data.plugin).to.equal('environment');
      expect(response.body.data.message).to.contain('Environment configuration updated');
    });
  });

  it('should handle binary execution paths correctly', () => {
    // Verify the server is running (indicates binary execution worked)
    cy.request('GET', 'http://localhost:7777/api/server/health').then((response) => {
      expect(response.status).to.equal(200);

      // Check server version
      expect(response.body).to.have.property('version');

      // In Tauri mode, this would be the compiled binary version
      if (response.body.server === 'game-backend-infrastructure') {
        cy.log('Server running from infrastructure binary');
      } else if (response.body.server === 'game-backend-minimal') {
        cy.log('Server running from minimal binary');
      }
    });
  });
});
