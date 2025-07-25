/**
 * Test the complete container-managed startup flow
 * This test verifies:
 * 1. Tauri frontend can start containers properly
 * 2. Agent defaults to Ollama when no API keys available
 * 3. Agent server starts in container and is accessible
 * 4. Message flow works end-to-end through container
 */

describe('Container-Managed Agent Startup and Message Flow', () => {
  const AGENT_CONTAINER_URL = 'http://localhost:7777';
  const STARTUP_TIMEOUT = 180000; // 3 minutes for container startup

  beforeEach(() => {
    // Visit the game interface
    cy.visit('http://localhost:1420');

    // Clear any existing environment
    cy.window().then((win) => {
      // Use Tauri API to stop any running containers first
      return (win as any).__TAURI_INVOKE__('stop_all_containers_new');
    });
  });

  afterEach(() => {
    // Clean up containers after each test
    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('stop_all_containers_new');
    });
  });

  it('should start complete container environment and handle messages', () => {
    cy.log('🚀 Starting container environment via Tauri');

    // Step 1: Start the complete container environment
    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('setup_complete_environment_new');
    }).then((result) => {
      expect(result).to.equal('Environment setup completed successfully');
      cy.log('✅ Container environment setup initiated');
    });

    // Step 2: Wait for containers to be ready and healthy
    cy.log('⏳ Waiting for containers to become healthy...');

    // Check container statuses periodically
    const checkContainerHealth = () => {
      return cy.window().then((win) => {
        return (win as any).__TAURI_INVOKE__('get_container_status_new');
      });
    };

    // Wait for all containers to be healthy
    cy.wrap(null, { timeout: STARTUP_TIMEOUT }).then(() => {
      const pollForHealth = (attempts = 60) => {
        if (attempts <= 0) {
          throw new Error('Containers failed to become healthy within timeout');
        }

        return checkContainerHealth().then((statuses) => {
          cy.log(`Container statuses: ${JSON.stringify(statuses, null, 2)}`);

          const allHealthy = statuses.every((status: any) =>
            status.health === 'Healthy' || status.health === 'Running'
          );

          if (allHealthy && statuses.length >= 3) { // postgres, ollama, agent
            cy.log('✅ All containers are healthy');
            return statuses;
          } else {
            cy.log(`⏳ Waiting for containers... (${60 - attempts + 1}/60)`);
            cy.wait(3000); // Wait 3 seconds between checks
            return pollForHealth(attempts - 1);
          }
        });
      };

      return pollForHealth();
    });

    // Step 3: Verify agent server is accessible
    cy.log('🔍 Verifying agent server is accessible');

    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/server/health`,
      timeout: 10000,
      retries: 5,
      retryOnStatusCodeFailure: true
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('status');
      cy.log('✅ Agent server health check passed');
    });

    // Step 4: Test agent configuration defaults to Ollama
    cy.log('🔧 Verifying Ollama configuration');

    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/agents/default/settings`,
      timeout: 10000
    }).then((response) => {
      expect(response.status).to.equal(200);

      // Should default to Ollama when no API keys
      const settings = response.body;
      cy.log(`Agent settings: ${JSON.stringify(settings, null, 2)}`);

      // Check if Ollama is configured as default
      expect(settings).to.have.property('MODEL_PROVIDER');
      expect(settings.MODEL_PROVIDER).to.equal('ollama');
      expect(settings).to.have.property('OLLAMA_SERVER_URL');
      expect(settings.OLLAMA_SERVER_URL).to.contain('11434');

      cy.log('✅ Agent configured to use Ollama by default');
    });

    // Step 5: Test message flow through container
    cy.log('💬 Testing message flow through containerized agent');

    const testMessage = 'Hello ELIZA, can you respond to this test message?';

    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('send_message_to_agent', testMessage);
    }).then((response) => {
      expect(response).to.be.a('string');
      expect(response.length).to.be.greaterThan(0);

      // Should not be an error response
      expect(response).to.not.contain('Error');
      expect(response).to.not.contain('Failed');
      expect(response).to.not.contain('unavailable');

      cy.log(`✅ Agent responded: ${response.substring(0, 100)}...`);
    });

    // Step 6: Test direct HTTP message API
    cy.log('📡 Testing direct HTTP message API');

    cy.request({
      method: 'POST',
      url: `${AGENT_CONTAINER_URL}/api/agents/default/message`,
      body: {
        text: 'Direct HTTP test message',
        userId: 'test-user',
        userName: 'TestUser'
      },
      timeout: 30000
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');

      const responseData = response.body.data;
      expect(responseData).to.have.property('agentResponse');
      expect(responseData.agentResponse).to.be.a('string');
      expect(responseData.agentResponse.length).to.be.greaterThan(0);

      cy.log(`✅ Direct HTTP API response: ${responseData.agentResponse.substring(0, 100)}...`);
    });

    // Step 7: Verify agent memory and state persistence
    cy.log('🧠 Testing agent memory and state');

    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/memories?count=5`,
      timeout: 10000
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');

      const memories = response.body.data;
      expect(memories).to.be.an('array');
      expect(memories.length).to.be.greaterThan(0);

      cy.log(`✅ Agent has ${memories.length} memories stored`);
    });

    // Step 8: Verify Ollama connection from agent
    cy.log('🤖 Verifying Ollama connectivity from agent');

    // Check if agent can connect to Ollama service
    cy.request({
      method: 'GET',
      url: 'http://localhost:11434/api/tags',
      timeout: 10000,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        cy.log('✅ Ollama service is accessible');
        expect(response.body).to.have.property('models');
      } else {
        cy.log('⚠️ Ollama service not accessible - may be starting up');
      }
    });
  });

  it('should handle agent autonomy and goals', () => {
    // First, ensure containers are running (reuse setup from previous test)
    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('setup_complete_environment_new');
    });

    // Wait for agent to be ready
    cy.wait(30000);

    // Test autonomy status
    cy.log('🎯 Testing agent autonomy and goal system');

    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('get_autonomy_status');
    }).then((status) => {
      expect(status).to.be.an('object');
      cy.log(`Autonomy status: ${JSON.stringify(status, null, 2)}`);
    });

    // Test goals API
    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('fetch_goals');
    }).then((goals) => {
      expect(goals).to.be.an('object');
      cy.log(`Goals: ${JSON.stringify(goals, null, 2)}`);
    });

    // Test todos API
    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('fetch_todos');
    }).then((todos) => {
      expect(todos).to.be.an('object');
      cy.log(`Todos: ${JSON.stringify(todos, null, 2)}`);
    });
  });

  it('should handle container lifecycle properly', () => {
    cy.log('🔄 Testing container lifecycle management');

    // Start containers individually to test each step
    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('start_postgres_container');
    }).then((status) => {
      expect(status).to.have.property('name', 'eliza-postgres');
      cy.log('✅ PostgreSQL container started');
    });

    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('start_ollama_container');
    }).then((status) => {
      expect(status).to.have.property('name', 'eliza-ollama');
      cy.log('✅ Ollama container started');
    });

    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('start_agent_container');
    }).then((status) => {
      expect(status).to.have.property('name', 'eliza-agent');
      cy.log('✅ Agent container started');
    });

    // Wait for health checks
    cy.wait(20000);

    // Test container status query
    cy.window().then((win) => {
      return (win as any).__TAURI_INVOKE__('get_container_status_new');
    }).then((statuses) => {
      expect(statuses).to.be.an('array');
      expect(statuses.length).to.be.greaterThan(0);

      const containerNames = statuses.map((s: any) => s.name);
      expect(containerNames).to.include('eliza-postgres');
      expect(containerNames).to.include('eliza-ollama');
      expect(containerNames).to.include('eliza-agent');

      cy.log('✅ All expected containers are running');
    });
  });
});
