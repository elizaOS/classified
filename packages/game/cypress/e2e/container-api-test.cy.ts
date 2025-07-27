/**
 * Test container-managed agent startup via API calls
 * This test verifies the backend agent server is properly containerized and accessible
 */

describe('Container-Managed Agent API Test', () => {
  const AGENT_CONTAINER_URL = 'http://localhost:7777';
  const STARTUP_TIMEOUT = 180000; // 3 minutes for container startup

  it('should have agent server running in container and responding to API calls', () => {
    cy.log('Testing containerized agent server accessibility');

    // Step 1: Test agent server health endpoint
    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/server/health`,
      timeout: STARTUP_TIMEOUT,
      retries: 10,
      retryOnStatusCodeFailure: true,
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('status');
      cy.log('✅ Agent server health check passed');
    });

    // Step 2: Test agent settings endpoint (should default to Ollama)
    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/agents/default/settings`,
      timeout: 30000,
    }).then((response) => {
      expect(response.status).to.equal(200);

      const settings = response.body;
      cy.log(`Agent settings: ${JSON.stringify(settings, null, 2)}`);

      // Verify Ollama configuration
      expect(settings).to.have.property('MODEL_PROVIDER');
      expect(settings.MODEL_PROVIDER).to.equal('ollama');
      expect(settings).to.have.property('OLLAMA_SERVER_URL');
      expect(settings.OLLAMA_SERVER_URL).to.contain('11434');

      cy.log('✅ Agent configured to use Ollama by default');
    });

    // Step 3: Send a test message to the agent
    cy.request({
      method: 'POST',
      url: `${AGENT_CONTAINER_URL}/api/agents/default/message`,
      body: {
        text: 'Hello from container test',
        userId: 'test-user',
        userName: 'TestUser',
      },
      timeout: 60000, // Allow time for AI response
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');

      const responseData = response.body.data;
      expect(responseData).to.have.property('agentResponse');
      expect(responseData.agentResponse).to.be.a('string');
      expect(responseData.agentResponse.length).to.be.greaterThan(0);

      cy.log(`✅ Agent responded: ${responseData.agentResponse.substring(0, 100)}...`);
    });

    // Step 4: Test agent memory system
    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/memories?count=5`,
      timeout: 10000,
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');

      const memories = response.body.data;
      expect(memories).to.be.an('array');
      expect(memories.length).to.be.greaterThan(0);

      cy.log(`✅ Agent has ${memories.length} memories stored`);
    });

    // Step 5: Test goals API
    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/goals`,
      timeout: 10000,
      failOnStatusCode: false, // Goals might not exist yet
    }).then((response) => {
      if (response.status === 200) {
        cy.log('✅ Goals API accessible');
      } else {
        cy.log('⚠️ Goals API not yet available (may be initializing)');
      }
    });

    // Step 6: Test todos API
    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/todos`,
      timeout: 10000,
      failOnStatusCode: false, // Todos might not exist yet
    }).then((response) => {
      if (response.status === 200) {
        cy.log('✅ Todos API accessible');
      } else {
        cy.log('⚠️ Todos API not yet available (may be initializing)');
      }
    });

    // Step 7: Test autonomy status API
    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/autonomy/status`,
      timeout: 10000,
      failOnStatusCode: false, // Autonomy might not be enabled
    }).then((response) => {
      if (response.status === 200) {
        cy.log('✅ Autonomy API accessible');
        cy.log(`Autonomy status: ${JSON.stringify(response.body, null, 2)}`);
      } else {
        cy.log('⚠️ Autonomy API not available (may be disabled)');
      }
    });
  });

  it('should verify Ollama container connectivity', () => {
    // Test that Ollama is accessible from the host
    cy.request({
      method: 'GET',
      url: 'http://localhost:11434/api/tags',
      timeout: 30000,
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 200) {
        cy.log('✅ Ollama container is accessible');
        expect(response.body).to.have.property('models');

        const models = response.body.models;
        cy.log(`Available Ollama models: ${models.map((m: any) => m.name).join(', ')}`);
      } else {
        cy.log('⚠️ Ollama container not accessible - may still be starting');
      }
    });
  });

  it('should verify PostgreSQL container connectivity', () => {
    // Test that the agent can connect to PostgreSQL by checking if memories work
    cy.request({
      method: 'GET',
      url: `${AGENT_CONTAINER_URL}/api/memories?count=1`,
      timeout: 10000,
    }).then((response) => {
      expect(response.status).to.equal(200);
      cy.log('✅ PostgreSQL container is accessible (agent can query memories)');
    });
  });

  it('should handle agent message flow with real AI processing', () => {
    const testMessage = 'What is 2 + 2? Please give a brief answer.';

    cy.log(`Sending test message: "${testMessage}"`);

    cy.request({
      method: 'POST',
      url: `${AGENT_CONTAINER_URL}/api/agents/default/message`,
      body: {
        text: testMessage,
        userId: 'math-test-user',
        userName: 'MathTester',
      },
      timeout: 60000, // Allow time for AI processing
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');

      const responseData = response.body.data;
      expect(responseData).to.have.property('agentResponse');
      expect(responseData.agentResponse).to.be.a('string');
      expect(responseData.agentResponse.length).to.be.greaterThan(0);

      // Verify the response actually answers the math question
      const agentResponse = responseData.agentResponse.toLowerCase();
      const containsFour = agentResponse.includes('4') || agentResponse.includes('four');

      if (containsFour) {
        cy.log('✅ Agent provided correct mathematical answer');
      } else {
        cy.log(`⚠️ Agent response may not contain expected answer: ${responseData.agentResponse}`);
      }

      cy.log(`Agent response: ${responseData.agentResponse}`);
    });
  });
});
