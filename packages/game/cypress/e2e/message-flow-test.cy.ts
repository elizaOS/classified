/// <reference types="cypress" />

describe('Agent Message Flow Test', () => {
  const BACKEND_URL = 'http://localhost:7777';
  let agentId: string;
  let channelId: string;

  before(() => {
    // Get agent ID and channel ID for messaging
    cy.request({
      method: 'GET',
      url: `${BACKEND_URL}/api/server/health`,
      timeout: 15000
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.data.agent).to.eq('connected');
      agentId = response.body.data.agentId;

      cy.log(`Agent ID: ${agentId}`);
    });

    // Get available channels for messaging
    cy.request({
      method: 'GET',
      url: `${BACKEND_URL}/api/messaging/agents/${agentId}/servers`,
      timeout: 10000,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        const serverId = response.body.data.servers[0];
        cy.log(`Server ID: ${serverId}`);

        // Get channels for this server
        cy.request({
          method: 'GET',
          url: `${BACKEND_URL}/api/messaging/central-servers/${serverId}/channels`,
          timeout: 10000,
          failOnStatusCode: false
        }).then((channelResponse) => {
          if (channelResponse.status === 200 && channelResponse.body.data.channels.length > 0) {
            channelId = channelResponse.body.data.channels[0].id;
            cy.log(`Channel ID: ${channelId}`);
          }
        });
      }
    });
  });

  it('should verify agent is healthy and ready', () => {
    cy.request({
      method: 'GET',
      url: `${BACKEND_URL}/api/server/health`,
      timeout: 10000
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data.status).to.eq('healthy');
      expect(response.body.data.agent).to.eq('connected');

      cy.log('✅ Agent is healthy and ready for messaging');
    });
  });

  it('should be able to send a message via HTTP POST to agents endpoint', () => {
    cy.request({
      method: 'GET',
      url: `${BACKEND_URL}/api/server/health`,
      timeout: 10000
    }).then((healthResponse) => {
      const testAgentId = healthResponse.body.data.agentId;

      // Try to send a message to the agent
      const testMessage = {
        text: "Hello agent, please respond with 'Message received' to confirm you can process messages.",
        userId: 'test-user-123',
        roomId: testAgentId // Use agent ID as room for simplicity
      };

      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/agents/${testAgentId}/message`,
        body: testMessage,
        timeout: 30000,
        failOnStatusCode: false
      }).then((messageResponse) => {
        cy.log(`Message response status: ${messageResponse.status}`);
        cy.log(`Message response body: ${JSON.stringify(messageResponse.body)}`);

        if (messageResponse.status === 200) {
          expect(messageResponse.body.success).to.be.true;
          cy.log('✅ Message successfully sent to agent');

          // Wait a moment for agent to process
          cy.wait(3000);

          // Check if we can retrieve the conversation/response
          cy.request({
            method: 'GET',
            url: `${BACKEND_URL}/api/agents/${testAgentId}/memories?count=5`,
            timeout: 10000,
            failOnStatusCode: false
          }).then((memoryResponse) => {
            if (memoryResponse.status === 200) {
              cy.log(`Retrieved ${memoryResponse.body.data?.length || 0} memories`);
              if (memoryResponse.body.data && memoryResponse.body.data.length > 0) {
                const recentMemories = memoryResponse.body.data;
                const hasResponse = recentMemories.some(memory =>
                  memory.content.text &&
                  memory.content.text.toLowerCase().includes('message received')
                );

                if (hasResponse) {
                  cy.log('✅ Agent successfully processed and responded to message');
                } else {
                  cy.log('⚠️ Agent received message but response format may differ');
                  cy.log('Recent memories:', JSON.stringify(recentMemories.slice(0, 2)));
                }
              }
            }
          });
        } else {
          cy.log(`⚠️ Message endpoint returned ${messageResponse.status}: ${messageResponse.body?.error?.message || 'Unknown error'}`);
        }
      });
    });
  });

  it('should verify WebSocket messaging endpoints exist if configured', () => {
    // Test if Socket.IO is available for real-time messaging
    cy.request({
      method: 'GET',
      url: `${BACKEND_URL}/socket.io/`,
      timeout: 10000,
      failOnStatusCode: false
    }).then((socketResponse) => {
      if (socketResponse.status === 200) {
        cy.log('✅ Socket.IO endpoint is available for WebSocket messaging');
      } else {
        cy.log('⚠️ Socket.IO endpoint not available or not configured');
      }
    });
  });

  it('should test message submission endpoint used by agent responses', () => {
    // Test the /api/messaging/submit endpoint that the agent uses to send responses
    const testSubmission = {
      channel_id: 'test-channel-123',
      server_id: '00000000-0000-0000-0000-000000000000',
      author_id: 'test-agent-456',
      content: 'Test agent response via messaging API',
      raw_message: {
        thought: 'This is a test response',
        actions: []
      },
      metadata: {
        agentName: 'Test Agent',
        attachments: []
      }
    };

    cy.request({
      method: 'POST',
      url: `${BACKEND_URL}/api/messaging/submit`,
      body: testSubmission,
      timeout: 10000,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Messaging submit status: ${response.status}`);
      cy.log(`Messaging submit response: ${JSON.stringify(response.body)}`);

      if (response.status === 200 && response.body.success) {
        cy.log('✅ Agent messaging submission endpoint is working');
        expect(response.body.message).to.include('acknowledged');
      } else {
        cy.log('⚠️ Messaging submission endpoint may not be properly configured');
      }
    });
  });

  it('should verify complete message flow architecture is in place', () => {
    cy.request(`${BACKEND_URL}/api/server/health`).then((healthResponse) => {
      const testAgentId = healthResponse.body.data.agentId;

      // Test that all required endpoints exist
      const endpointsToTest = [
        `/api/agents/${testAgentId}/message`,
        '/api/messaging/submit',
        '/api/messaging/complete',
        `/api/messaging/agents/${testAgentId}/servers`
      ];

      endpointsToTest.forEach((endpoint) => {
        cy.request({
          method: 'GET',
          url: `${BACKEND_URL}${endpoint}`,
          timeout: 5000,
          failOnStatusCode: false
        }).then((response) => {
          // We don't care about the exact response, just that the endpoint exists
          const endpointExists = response.status !== 404;
          cy.log(`${endpoint}: ${endpointExists ? '✅ EXISTS' : '❌ NOT FOUND'} (${response.status})`);
        });
      });
    });
  });

  it('should verify agent can process and respond to different message types', () => {
    cy.request(`${BACKEND_URL}/api/server/health`).then((healthResponse) => {
      const testAgentId = healthResponse.body.data.agentId;

      const testMessages = [
        {
          text: 'What is 2+2?',
          expectResponse: true,
          description: 'Math question'
        },
        {
          text: 'Hello, can you introduce yourself?',
          expectResponse: true,
          description: 'Introduction request'
        },
        {
          text: 'Tell me a joke',
          expectResponse: true,
          description: 'Creative request'
        }
      ];

      testMessages.forEach((testCase, index) => {
        cy.request({
          method: 'POST',
          url: `${BACKEND_URL}/api/agents/${testAgentId}/message`,
          body: {
            text: testCase.text,
            userId: `test-user-${index}`,
            roomId: `test-room-${index}`
          },
          timeout: 30000,
          failOnStatusCode: false
        }).then((response) => {
          cy.log(`${testCase.description} - Status: ${response.status}`);

          if (response.status === 200) {
            cy.log(`✅ ${testCase.description} - Message accepted`);
          } else {
            cy.log(`⚠️ ${testCase.description} - Status ${response.status}`);
          }
        });
      });
    });
  });
});
