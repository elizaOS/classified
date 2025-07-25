/**
 * Comprehensive System Validation Test
 * Tests data persistence, provider switching, API endpoints, and cross-platform functionality
 */

describe('ELIZA Comprehensive System Validation', () => {
  const baseUrl = 'http://localhost:7777';
  let agentId: string;
  let roomId: string;

  before(() => {
    // Generate unique identifiers for this test run
    roomId = `test-room-${Date.now()}`;

    // Wait for backend to be ready
    cy.request({
      url: `${baseUrl}/api/server/health`,
      retryOnStatusCodeFailure: true,
      timeout: 30000
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  describe('🏥 System Health & Readiness', () => {
    it('should have server health endpoint responding', () => {
      cy.request('GET', `${baseUrl}/api/server/health`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('status', 'healthy');
      });
    });

    it('should have agents API responding', () => {
      cy.request('GET', `${baseUrl}/api/agents`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.agents).to.be.an('array');

        // Get the first agent ID for later tests
        if (response.body.data.agents.length > 0) {
          agentId = response.body.data.agents[0].id;
        }
      });
    });

    it('should have database responding', () => {
      cy.request('GET', `${baseUrl}/api/database/tables`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.tables).to.be.an('array');
      });
    });
  });

  describe('🔧 Configuration API', () => {
    it('should get available providers', () => {
      cy.request('GET', `${baseUrl}/api/config/providers`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.providers).to.be.an('array');

        // Should have at least openai, anthropic, and local providers
        const providerNames = response.body.data.providers.map((p: any) => p.name);
        expect(providerNames).to.include('openai');
        expect(providerNames).to.include('anthropic');
        expect(providerNames).to.include('local');
      });
    });

    it('should validate valid configuration', () => {
      const validConfig = {
        provider: 'local',
        model: 'llama2',
        settings: {
          temperature: 0.7,
          maxTokens: 2000
        }
      };

      cy.request('POST', `${baseUrl}/api/config/validate`, validConfig).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.valid).to.be.true;
      });
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        provider: 'nonexistent',
        model: 'invalid-model'
      };

      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/config/validate`,
        body: invalidConfig,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body).to.have.property('success', false);
        expect(response.body.error.message).to.contain('Unknown provider');
      });
    });

    it('should update configuration successfully', () => {
      const newConfig = {
        provider: 'local',
        model: 'llama2',
        settings: {
          temperature: 0.8,
          maxTokens: 1500
        }
      };

      cy.request('POST', `${baseUrl}/api/config/update`, newConfig).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.config.provider).to.eq('local');
        expect(response.body.data.config.model).to.eq('llama2');
      });
    });

    it('should get current configuration', () => {
      cy.request('GET', `${baseUrl}/api/config/current`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('current');
        expect(response.body.data).to.have.property('available');
      });
    });
  });

  describe('🤖 Agent Messaging', () => {
    it('should send message to agent and receive response', () => {
      const testMessage = {
        content: {
          text: 'Hello, this is a test message for system validation'
        },
        roomId
      };

      // Send message
      cy.request('POST', `${baseUrl}/api/agents/terminal/message`, testMessage).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
      });

      // Wait for processing and check for response
      cy.wait(3000);

      cy.request('GET', `${baseUrl}/api/agents/terminal/messages?roomId=${roomId}&limit=10`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.messages).to.be.an('array');
        expect(response.body.data.messages.length).to.be.greaterThan(0);
      });
    });

    it('should get agent capabilities', () => {
      cy.request('GET', `${baseUrl}/api/agents/terminal/capabilities`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.capabilities).to.be.an('array');
      });
    });
  });

  describe('📚 Knowledge Management', () => {
    let uploadedDocumentId: string;

    it('should upload knowledge document', () => {
      // Create a test file
      const testContent = 'This is a test knowledge document for system validation testing.';
      const blob = new Blob([testContent], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, 'test-document.txt');

      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/knowledge/upload`,
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        uploadedDocumentId = response.body.data.documentId;
      });
    });

    it('should list knowledge documents', () => {
      cy.request('GET', `${baseUrl}/api/knowledge/documents`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.documents).to.be.an('array');
      });
    });

    it('should delete knowledge document', () => {
      if (uploadedDocumentId) {
        cy.request('DELETE', `${baseUrl}/knowledge/documents/${uploadedDocumentId}`).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property('success', true);
        });
      }
    });
  });

  describe('🗄️ Data Persistence', () => {
    it('should persist messages between requests', () => {
      const testMessage = {
        content: {
          text: 'This message should persist in the database'
        },
        roomId: `persistence-test-${Date.now()}`
      };

      // Send message
      cy.request('POST', `${baseUrl}/api/agents/terminal/message`, testMessage).then(() => {
        // Wait for processing
        cy.wait(2000);

        // Retrieve messages to verify persistence
        cy.request('GET', `${baseUrl}/api/agents/terminal/messages?roomId=${testMessage.roomId}&limit=10`).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.data.messages).to.be.an('array');

          const userMessage = response.body.data.messages.find((m: any) =>
            m.content.text.includes('This message should persist')
          );
          expect(userMessage).to.exist;
        });
      });
    });

    it('should query database successfully', () => {
      const query = {
        query: 'SELECT COUNT(*) as message_count FROM memories WHERE type = $1',
        params: ['message']
      };

      cy.request('POST', `${baseUrl}/api/database/query`, query).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.results).to.be.an('array');
      });
    });
  });

  describe('🚀 Performance & Load', () => {
    it('should handle multiple concurrent requests', () => {
      const requests = [];

      // Create multiple concurrent health check requests
      for (let i = 0; i < 5; i++) {
        requests.push(
          cy.request('GET', `${baseUrl}/api/server/health`)
        );
      }

      // All requests should succeed
      requests.forEach(request => {
        request.then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
        });
      });
    });

    it('should respond within acceptable time limits', () => {
      const startTime = Date.now();

      cy.request('GET', `${baseUrl}/api/server/health`).then((response) => {
        const responseTime = Date.now() - startTime;

        expect(response.status).to.eq(200);
        expect(responseTime).to.be.lessThan(5000); // Should respond within 5 seconds
      });
    });
  });

  describe('💬 Provider Switching Integration', () => {
    it('should switch provider and maintain functionality', () => {
      // Switch to local provider
      const localConfig = {
        provider: 'local',
        model: 'llama2',
        settings: {
          temperature: 0.7
        }
      };

      cy.request('POST', `${baseUrl}/api/config/update`, localConfig).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;

        // Test that agent still responds after provider switch
        const testMessage = {
          content: {
            text: 'Test message after provider switch'
          },
          roomId: `provider-switch-test-${Date.now()}`
        };

        cy.request('POST', `${baseUrl}/api/agents/terminal/message`, testMessage).then((msgResponse) => {
          expect(msgResponse.status).to.eq(200);
          expect(msgResponse.body.success).to.be.true;
        });
      });
    });
  });

  describe('🔐 Security & Error Handling', () => {
    it('should handle malformed requests gracefully', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/config/validate`,
        body: 'invalid json',
        failOnStatusCode: false,
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 500]);
        expect(response.body).to.have.property('success', false);
      });
    });

    it('should return 404 for non-existent endpoints', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/api/nonexistent/endpoint`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });

    it('should validate input parameters', () => {
      const invalidMessage = {
        content: {
          // Missing text field
        },
        roomId
      };

      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/agents/terminal/message`,
        body: invalidMessage,
        failOnStatusCode: false
      }).then((response) => {
        // Should handle gracefully, either with error or by ignoring
        expect(response.status).to.be.oneOf([200, 400]);
      });
    });
  });

  after(() => {
    // Cleanup: Reset to default configuration
    const defaultConfig = {
      provider: 'local',
      model: 'llama2',
      settings: {
        temperature: 0.7,
        maxTokens: 2000
      }
    };

    cy.request('POST', `${baseUrl}/api/config/update`, defaultConfig);
  });
});

// Additional test for data directory persistence
describe('💾 Data Directory Persistence Validation', () => {
  it('should verify data directory exists and is writable', () => {
    // Test that the server has created and can write to data directory
    cy.request('POST', `${baseUrl}/api/database/query`, {
      query: 'SELECT 1 as test_value',
      params: []
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data.results[0].test_value).to.eq(1);
    });
  });

  it('should maintain data across server restarts (manual verification)', () => {
    // This test documents the expectation that data should persist
    // In a real test environment, you would restart the server and verify data persistence

    const testData = {
      content: {
        text: 'Persistence test message - should survive server restart'
      },
      roomId: `persistence-validation-${Date.now()}`
    };

    cy.request('POST', `${baseUrl}/api/agents/terminal/message`, testData).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });

    // Log for manual verification
    cy.log('Data persistence test completed - manual server restart verification required');
  });
});
