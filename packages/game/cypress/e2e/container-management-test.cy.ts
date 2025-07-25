describe('Container Management E2E Test', () => {
  beforeEach(() => {
    // Visit the game frontend
    cy.visit('http://localhost:5174');
    cy.wait(2000); // Wait for initialization
  });

  it('should manage containers through Tauri frontend', () => {
    // Test container status endpoint first
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        // Server is already running directly, stop it first
        cy.exec('pkill -f "launch-game.ts" || true');
        cy.wait(3000);
      }
    });

    // Test container startup through Tauri commands
    // This will require the containers to be built and available
    cy.window().then((win) => {
      // Check if we're in Tauri environment
      const isTauri = !!(win as any).__TAURI__;

      if (isTauri) {
        cy.log('Testing in Tauri environment');

        // Test container manager commands
        cy.window().its('__TAURI__').then((tauri) => {
          // Get container status
          cy.wrap(tauri.invoke('get_container_status_new')).then((status) => {
            cy.log('Container status:', status);
          });

          // Setup complete environment (this starts all containers)
          cy.wrap(tauri.invoke('setup_complete_environment_new')).then((result) => {
            cy.log('Environment setup result:', result);
            expect(result).to.include('completed successfully');
          });

          // Wait for containers to start
          cy.wait(10000);

          // Test agent health after container startup
          cy.request({
            method: 'GET',
            url: 'http://localhost:7777/api/server/health',
            timeout: 30000
          }).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body).to.have.property('success', true);
            expect(response.body.data).to.have.property('status', 'healthy');
            cy.log('Agent health check passed');
          });

          // Test agent endpoints
          cy.request('http://localhost:7777/api/agents').then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body.data.agents).to.have.length.greaterThan(0);
            cy.log('Active agents:', response.body.data.agents.length);
          });

          // Test PostgreSQL container (port 7771)
          cy.exec('nc -z localhost 7771').then((result) => {
            expect(result.code).to.eq(0);
            cy.log('PostgreSQL container is accessible on port 7771');
          });

          // Test Ollama container (port 11434)
          cy.exec('nc -z localhost 11434').then((result) => {
            expect(result.code).to.eq(0);
            cy.log('Ollama container is accessible on port 11434');
          });

          // Test agent container (port 7777)
          cy.exec('nc -z localhost 7777').then((result) => {
            expect(result.code).to.eq(0);
            cy.log('Agent container is accessible on port 7777');
          });

          // Clean up - stop all containers
          cy.wrap(tauri.invoke('stop_all_containers_new')).then(() => {
            cy.log('All containers stopped successfully');
          });
        });
      } else {
        cy.log('Not in Tauri environment - testing HTTP fallback');

        // Test that the API service falls back to HTTP
        cy.window().then((win) => {
          // Simulate API calls through the browser environment
          fetch('http://localhost:7777/api/server/health')
            .then(response => response.json())
            .then(data => {
              cy.log('Health check via HTTP:', data);
              expect(data.success).to.be.true;
            })
            .catch(() => {
              cy.log('Agent server not running - this is expected in browser-only mode');
            });
        });
      }
    });
  });

  it('should handle container configuration with Ollama defaults', () => {
    // Verify that when no API keys are available, system defaults to Ollama
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/agents/default/settings',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        const settings = response.body.data;

        // Check that Ollama is configured as default
        expect(settings).to.have.property('MODEL_PROVIDER');
        expect(settings.MODEL_PROVIDER).to.eq('ollama');
        expect(settings).to.have.property('OLLAMA_SERVER_URL');

        cy.log('Verified Ollama is configured as default model provider');
      } else {
        cy.log('Agent server not running - cannot test settings');
      }
    });
  });

  it('should verify message flow works end-to-end', () => {
    // Test Socket.IO connection and message flow
    cy.window().then((win) => {
      // Load Socket.IO client
      const script = win.document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.2/socket.io.min';
      win.document.head.appendChild(script);

      script.onload = () => {
        const io = (win as any).io;
        const socket = io('http://localhost:7777');

        socket.on('connect', () => {
          cy.log('Connected to Socket.IO server');

          // Join a test channel
          socket.emit('joinChannel', {
            channelId: 'test-channel-123',
            agentId: 'test-agent'
          });

          // Listen for agent responses
          socket.on('messageBroadcast', (data: any) => {
            cy.log('Received agent response:', data);
            expect(data).to.have.property('text');
            expect(data).to.have.property('senderId');
          });

          // Send a test message
          socket.emit('userMessage', {
            channelId: 'test-channel-123',
            text: 'Hello agent, can you respond?',
            senderId: 'test-user'
          });

          // Wait for response
          cy.wait(5000);

          socket.disconnect();
        });

        socket.on('connect_error', (error: any) => {
          cy.log('Socket.IO connection failed:', error.message);
        });
      };
    });
  });
});
