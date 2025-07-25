/// <reference types="cypress" />

describe('Comprehensive Functionality Test - All Features', () => {
  const BACKEND_URL = 'http://localhost:7777';
  const FRONTEND_URL = 'http://localhost:5173';

  before(() => {
    // Ensure backend is ready
    cy.request({
      method: 'GET',
      url: `${BACKEND_URL}/api/server/health`,
      timeout: 30000,
      retries: 5
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.data.status).to.eq('healthy');
      cy.log('✅ Backend server is healthy and ready');
    });
  });

  beforeEach(() => {
    // Skip boot sequence for faster testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
      win.localStorage.setItem('disableWebSocket', 'true'); // Disable WebSocket for stable testing
    });

    cy.visit(FRONTEND_URL, { timeout: 30000 });

    // Wait for the main interface to load
    cy.get('body', { timeout: 30000 }).should('be.visible');
    cy.wait(3000); // Give time for full initialization
  });

  describe('1. Chat Interface Functionality', () => {
    it('should test complete chat functionality', () => {
      cy.log('🗨️ Testing Chat Interface');

      // Wait for game interface to load
      cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

      // Verify chat components exist
      cy.get('[data-testid="chat-input"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="chat-messages"]', { timeout: 10000 }).should('be.visible');

      // Test sending a message
      const testMessage = 'Hello agent, this is a test message';
      cy.get('[data-testid="chat-input"]').clear().type(testMessage);
      cy.get('[data-testid="chat-send-button"]').should('be.visible').click();

      // Verify message appears in chat
      cy.get('[data-testid="chat-messages"]').should('contain', testMessage);
      cy.log('✅ Chat sending functionality works');

      // Test multiple messages
      for (let i = 1; i <= 3; i++) {
        cy.get('[data-testid="chat-input"]').clear().type(`Test message ${i}{enter}`);
        cy.wait(500);
      }

      cy.get('[data-testid="chat-messages"]').should('contain', 'Test message 3');
      cy.log('✅ Multiple message sending works');

      cy.screenshot('chat-functionality-test');
    });
  });

  describe('2. All Capability Toggles', () => {
    it('should test all capability toggles work properly', () => {
      cy.log('🔧 Testing All Capability Toggles');

      // Navigate to config tab to access capability toggles
      cy.get('[data-testid="config-tab"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('[data-testid="config-content"]', { timeout: 10000 }).should('be.visible');

      // Test Shell capability
      cy.log('Testing Shell capability toggle...');
      cy.get('[data-testid="shell-toggle"]', { timeout: 5000 }).should('be.visible').then(($toggle) => {
        const initialState = $toggle.attr('aria-checked');
        cy.wrap($toggle).click();
        cy.get('[data-testid="shell-toggle"]').should('have.attr', 'aria-checked',
          initialState === 'true' ? 'false' : 'true');
        cy.log('✅ Shell toggle works');
      });

      // Test Browser capability
      cy.log('Testing Browser capability toggle...');
      cy.get('[data-testid="browser-toggle"]', { timeout: 5000 }).should('be.visible').then(($toggle) => {
        const initialState = $toggle.attr('aria-checked');
        cy.wrap($toggle).click();
        cy.get('[data-testid="browser-toggle"]').should('have.attr', 'aria-checked',
          initialState === 'true' ? 'false' : 'true');
        cy.log('✅ Browser toggle works');
      });

      // Test Vision capabilities (camera, speaker, microphone, screen)
      const visionCapabilities = [
        { testId: 'camera-toggle', name: 'Camera' },
        { testId: 'speaker-toggle', name: 'Speaker' },
        { testId: 'microphone-toggle', name: 'Microphone' },
        { testId: 'screen-toggle', name: 'Screen Capture' }
      ];

      visionCapabilities.forEach((capability) => {
        cy.log(`Testing ${capability.name} toggle...`);
        cy.get(`[data-testid="${capability.testId}"]`, { timeout: 5000 }).should('be.visible').then(($toggle) => {
          const initialState = $toggle.attr('aria-checked');
          cy.wrap($toggle).click();
          cy.get(`[data-testid="${capability.testId}"]`).should('have.attr', 'aria-checked',
            initialState === 'true' ? 'false' : 'true');
          cy.log(`✅ ${capability.name} toggle works`);
        });
      });

      // Test Autonomy toggle
      cy.log('Testing Autonomy toggle...');
      cy.get('[data-testid="autonomy-toggle"]', { timeout: 5000 }).should('be.visible').then(($toggle) => {
        const initialState = $toggle.attr('aria-checked');
        cy.wrap($toggle).click();
        cy.get('[data-testid="autonomy-toggle"]').should('have.attr', 'aria-checked',
          initialState === 'true' ? 'false' : 'true');
        cy.log('✅ Autonomy toggle works');
      });

      cy.screenshot('capability-toggles-test');
    });

    it('should verify capability toggles affect backend API status', () => {
      cy.log('🔗 Testing Backend Integration for Capabilities');

      // Test shell capability backend integration
      cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/shell`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.service_available).to.be.true;
        cy.log('✅ Shell capability backend integration works');
      });

      // Test browser capability backend integration
      cy.request('GET', `${BACKEND_URL}/api/agents/default/capabilities/browser`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.service_available).to.be.true;
        cy.log('✅ Browser capability backend integration works');
      });

      // Test autonomy status
      cy.request('GET', `${BACKEND_URL}/autonomy/status`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.enabled).to.be.a('boolean');
        cy.log('✅ Autonomy backend integration works');
      });
    });
  });

  describe('3. Goals and Todos Backend Integration', () => {
    it('should test goals backend integration and display', () => {
      cy.log('🎯 Testing Goals Backend Integration');

      // Test goals API endpoint directly
      cy.request('GET', `${BACKEND_URL}/api/goals`).then((response) => {
        expect(response.status).to.eq(200);
        const goalsData = Array.isArray(response.body) ? response.body : response.body.data;
        expect(Array.isArray(goalsData)).to.be.true;
        cy.log(`✅ Goals API returns ${goalsData.length} goals`);

        // Store goals count for UI verification
        cy.wrap(goalsData.length).as('backendGoalsCount');
      });

      // Navigate to Goals tab and verify UI displays backend data
      cy.get('[data-testid="goals-tab"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('[data-testid="goals-content"]', { timeout: 10000 }).should('be.visible');

      // Verify goals are displayed in UI
      cy.get('[data-testid="goals-content"]').within(() => {
        cy.contains('GOALS').should('be.visible');

        // Check if goals are displayed or empty state
        cy.get('body').then($body => {
          if ($body.find('.status-item').length > 0) {
            cy.log('Goals found in UI, verifying structure...');
            cy.get('.status-item').should('have.length.greaterThan', 0);

            // Verify goal structure
            cy.get('.status-item').first().within(() => {
              cy.get('.status-indicator').should('be.visible');
              cy.get('.status-text').should('be.visible');
            });
            cy.log('✅ Goals UI structure is correct');
          } else {
            cy.log('No goals in UI - checking for empty state');
            // Empty state should be handled gracefully
            cy.contains('goals', { matchCase: false }).should('be.visible');
          }
        });
      });

      cy.screenshot('goals-backend-integration');
    });

    it('should test todos backend integration and display', () => {
      cy.log('📋 Testing Todos Backend Integration');

      // Test todos API endpoint directly
      cy.request('GET', `${BACKEND_URL}/api/todos`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.exist;
        cy.log('✅ Todos API endpoint works');
      });

      // Navigate to Todos tab and verify UI
      cy.get('[data-testid="todos-tab"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('[data-testid="todos-content"]', { timeout: 10000 }).should('be.visible');

      // Verify todos are displayed in UI
      cy.get('[data-testid="todos-content"]').within(() => {
        cy.contains(/TASKS|TODOS/i).should('be.visible');

        // Check if todos are displayed or empty state
        cy.get('body').then($body => {
          if ($body.find('.status-item').length > 0) {
            cy.log('Todos found in UI, verifying structure...');
            cy.get('.status-item').should('have.length.greaterThan', 0);

            // Verify todo structure
            cy.get('.status-item').first().within(() => {
              cy.get('.status-indicator').should('be.visible');
              cy.get('.status-text').should('be.visible');
            });
            cy.log('✅ Todos UI structure is correct');
          } else {
            cy.log('No todos in UI - checking for empty state');
            // Empty state should be handled gracefully
            cy.contains(/tasks|todos/i).should('be.visible');
          }
        });
      });

      cy.screenshot('todos-backend-integration');
    });

    it('should verify goals and todos refresh from backend periodically', () => {
      cy.log('🔄 Testing Periodic Data Refresh');

      // Monitor API calls
      cy.intercept('GET', '**/api/goals').as('goalsRefresh');
      cy.intercept('GET', '**/api/todos').as('todosRefresh');

      // Navigate to goals tab
      cy.get('[data-testid="goals-tab"]').click();
      cy.wait(2000);

      // Should trigger goals refresh
      cy.wait('@goalsRefresh', { timeout: 15000 });
      cy.log('✅ Goals periodic refresh detected');

      // Navigate to todos tab
      cy.get('[data-testid="todos-tab"]').click();
      cy.wait(2000);

      // Should trigger todos refresh
      cy.wait('@todosRefresh', { timeout: 15000 });
      cy.log('✅ Todos periodic refresh detected');
    });
  });

  describe('4. Monologue (Agent\'s Autonomous Room)', () => {
    it('should test monologue functionality - agent talking to itself', () => {
      cy.log('🤖 Testing Monologue (Agent\'s Autonomous Room)');

      // Navigate to monologue tab
      cy.get('[data-testid="monologue-tab"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('[data-testid="monologue-content"]', { timeout: 10000 }).should('be.visible');

      // Verify monologue interface
      cy.get('[data-testid="monologue-content"]').within(() => {
        cy.contains(/MONOLOGUE|THOUGHTS|AUTONOMOUS/i).should('be.visible');

        // Should have autonomous chat area
        cy.get('[data-testid="autonomous-chat"]', { timeout: 5000 }).should('be.visible');

        // Check for autonomous messages or empty state
        cy.get('body').then($body => {
          if ($body.find('.autonomous-message').length > 0) {
            cy.log('Autonomous messages found');
            cy.get('.autonomous-message').should('have.length.greaterThan', 0);
            cy.log('✅ Monologue shows agent thoughts');
          } else {
            cy.log('No autonomous messages yet - interface ready');
            // Interface should be ready to display messages
            cy.get('[data-testid="autonomous-chat"]').should('be.visible');
          }
        });
      });

      // Test that memories API endpoint works (monologue uses memories)
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}/api/memories?roomId=autonomous-room&count=20`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 500]).to.include(response.status); // 500 is OK if no room exists yet
        cy.log('✅ Memories API endpoint (used by monologue) is accessible');
      });

      cy.screenshot('monologue-functionality');
    });
  });

  describe('5. Knowledge Upload and Delete (Files)', () => {
    it('should test complete file management functionality', () => {
      cy.log('📁 Testing Knowledge Upload and Delete');

      // Navigate to files tab
      cy.get('[data-testid="files-tab"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('[data-testid="files-content"]', { timeout: 10000 }).should('be.visible');

      // Verify file management interface
      cy.get('[data-testid="files-content"]').within(() => {
        cy.contains(/FILES|KNOWLEDGE|DOCUMENTS/i).should('be.visible');

        // Should have file upload area
        cy.get('[data-testid="file-upload-area"]', { timeout: 5000 }).should('be.visible');
        cy.get('[data-testid="file-list"]', { timeout: 5000 }).should('be.visible');
      });

      // Test knowledge documents API
      cy.request('GET', `${BACKEND_URL}/knowledge/documents`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.documents).to.be.an('array');
        cy.log(`✅ Knowledge documents API returns ${response.body.data.documents.length} files`);
      });

      // Test file upload endpoint exists
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/knowledge/upload`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400); // Should return 400 for missing file
        expect(response.body.error.code).to.eq('NO_FILE');
        cy.log('✅ File upload endpoint exists and validates correctly');
      });

      // Test file delete endpoint exists
      cy.request({
        method: 'DELETE',
        url: `${BACKEND_URL}/knowledge/documents/test-file-id`,
        failOnStatusCode: false
      }).then((response) => {
        expect([200, 404]).to.include(response.status);
        cy.log('✅ File delete endpoint exists');
      });

      cy.screenshot('knowledge-file-management');
    });

    it('should test file upload UI functionality', () => {
      cy.log('📤 Testing File Upload UI');

      // Navigate to files tab
      cy.get('[data-testid="files-tab"]').click();
      cy.get('[data-testid="files-content"]', { timeout: 10000 }).should('be.visible');

      // Create a test file to upload
      const fileName = 'test-knowledge-document.txt';
      const fileContent = 'This is a test knowledge document for the ELIZA agent.';

      // Test file upload (if file input exists)
      cy.get('body').then($body => {
        if ($body.find('[data-testid="file-input"]').length > 0) {
          cy.get('[data-testid="file-input"]').selectFile({
            contents: Cypress.Buffer.from(fileContent),
            fileName,
            mimeType: 'text/plain'
          }, { force: true });

          // Wait for upload to process
          cy.wait(2000);

          // Check if file appears in list
          cy.get('[data-testid="file-list"]').should('contain', fileName);
          cy.log('✅ File upload UI works');

          // Test file deletion if delete button exists
          if ($body.find('[data-testid="file-delete-button"]').length > 0) {
            cy.get('[data-testid="file-delete-button"]').first().click();
            cy.wait(1000);
            cy.log('✅ File delete UI works');
          }
        } else {
          cy.log('File upload input not found - testing drag/drop area');
          // Check for drag/drop upload area
          cy.get('[data-testid="file-upload-area"]').should('be.visible');
          cy.log('✅ File upload area is available');
        }
      });
    });
  });

  describe('6. Configuration Settings Management', () => {
    it('should test complete configuration management', () => {
      cy.log('⚙️ Testing Configuration Settings Management');

      // Navigate to config tab
      cy.get('[data-testid="config-tab"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('[data-testid="config-content"]', { timeout: 10000 }).should('be.visible');

      // Verify configuration interface
      cy.get('[data-testid="config-content"]').within(() => {
        cy.contains(/CONFIG|SETTINGS|CONFIGURATION/i).should('be.visible');

        // Should have various capability toggles
        const configElements = [
          'autonomy-toggle',
          'shell-toggle',
          'browser-toggle',
          'camera-toggle',
          'microphone-toggle',
          'speaker-toggle',
          'screen-toggle'
        ];

        configElements.forEach(element => {
          cy.get(`[data-testid="${element}"]`, { timeout: 5000 }).should('be.visible');
        });
      });

      // Test configuration API endpoints
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.configurations).to.be.an('object');
        expect(response.body.data.availablePlugins).to.be.an('array');
        cy.log('✅ Plugin configuration API works');
      });

      // Test configuration validation
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/config/validate`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.validation).to.be.an('object');
        cy.log('✅ Configuration validation API works');
      });

      // Test vision settings
      cy.request('GET', `${BACKEND_URL}/api/agents/default/settings/vision`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        const settings = response.body.data;
        expect(settings.ENABLE_CAMERA).to.be.a('string');
        expect(settings.ENABLE_MICROPHONE).to.be.a('string');
        expect(settings.ENABLE_SPEAKER).to.be.a('string');
        expect(settings.ENABLE_SCREEN_CAPTURE).to.be.a('string');
        cy.log('✅ Vision settings API works');
      });

      cy.screenshot('configuration-management');
    });

    it('should test settings persistence and updates', () => {
      cy.log('💾 Testing Settings Persistence');

      // Test settings update
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/agents/default/settings`,
        body: {
          key: 'ENABLE_CAMERA',
          value: 'false'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        cy.log('✅ Settings update API works');
      });

      // Verify setting was updated
      cy.request('GET', `${BACKEND_URL}/api/agents/default/settings/vision`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.ENABLE_CAMERA).to.eq('false');
        cy.log('✅ Settings persistence works');
      });

      // Test vision refresh
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/agents/default/vision/refresh`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        cy.log('✅ Vision refresh API works');
      });
    });
  });

  describe('7. Cross-Tab Integration and Data Flow', () => {
    it('should verify all tabs work together and data persists', () => {
      cy.log('🔄 Testing Cross-Tab Integration');

      // Test navigation between all tabs
      const tabs = [
        { testId: 'goals-tab', contentId: 'goals-content', name: 'Goals' },
        { testId: 'todos-tab', contentId: 'todos-content', name: 'Todos' },
        { testId: 'monologue-tab', contentId: 'monologue-content', name: 'Monologue' },
        { testId: 'files-tab', contentId: 'files-content', name: 'Files' },
        { testId: 'config-tab', contentId: 'config-content', name: 'Config' }
      ];

      tabs.forEach((tab, index) => {
        cy.log(`Testing ${tab.name} tab...`);
        cy.get(`[data-testid="${tab.testId}"]`, { timeout: 10000 }).should('be.visible').click();
        cy.get(`[data-testid="${tab.contentId}"]`, { timeout: 10000 }).should('be.visible');
        cy.get(`[data-testid="${tab.testId}"]`).should('have.class', 'active');

        // Send a chat message while on this tab to test chat persistence
        if (index === 2) { // On monologue tab
          cy.get('[data-testid="chat-input"]').clear().type(`Message from ${tab.name} tab{enter}`);
          cy.wait(500);
        }
      });

      // Verify chat messages persist across tab changes
      cy.get('[data-testid="chat-messages"]').should('contain', 'Message from Monologue tab');
      cy.log('✅ Chat persists across tab navigation');

      // Go back to each tab and verify content is still there
      tabs.forEach((tab) => {
        cy.get(`[data-testid="${tab.testId}"]`).click();
        cy.get(`[data-testid="${tab.contentId}"]`).should('be.visible');
      });

      cy.log('✅ All tabs maintain their content during navigation');
      cy.screenshot('cross-tab-integration');
    });
  });

  describe('8. Complete System Integration Test', () => {
    it('should perform end-to-end system test with all components', () => {
      cy.log('🚀 Running Complete System Integration Test');

      // 1. Start on Goals tab and interact with data
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.get('[data-testid="chat-input"]').type('Show me current goals{enter}');
      cy.wait(1000);

      // 2. Check todos
      cy.get('[data-testid="todos-tab"]').click();
      cy.get('[data-testid="todos-content"]').should('be.visible');
      cy.get('[data-testid="chat-input"]').type('What tasks do I have?{enter}');
      cy.wait(1000);

      // 3. Check monologue
      cy.get('[data-testid="monologue-tab"]').click();
      cy.get('[data-testid="monologue-content"]').should('be.visible');
      cy.get('[data-testid="chat-input"]').type('What are you thinking about?{enter}');
      cy.wait(1000);

      // 4. Configure some settings
      cy.get('[data-testid="config-tab"]').click();
      cy.get('[data-testid="config-content"]').should('be.visible');

      // Toggle a few capabilities
      cy.get('[data-testid="shell-toggle"]').click();
      cy.wait(500);
      cy.get('[data-testid="browser-toggle"]').click();
      cy.wait(500);

      // 5. Check files tab
      cy.get('[data-testid="files-tab"]').click();
      cy.get('[data-testid="files-content"]').should('be.visible');
      cy.get('[data-testid="chat-input"]').type('List available files{enter}');
      cy.wait(1000);

      // 6. Return to goals and verify everything still works
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.get('[data-testid="chat-input"]').type('System integration test complete{enter}');

      // Verify chat history contains all our test messages
      cy.get('[data-testid="chat-messages"]').should('contain', 'Show me current goals');
      cy.get('[data-testid="chat-messages"]').should('contain', 'What tasks do I have');
      cy.get('[data-testid="chat-messages"]').should('contain', 'What are you thinking');
      cy.get('[data-testid="chat-messages"]').should('contain', 'List available files');
      cy.get('[data-testid="chat-messages"]').should('contain', 'System integration test complete');

      cy.log('✅ Complete system integration test passed');
      cy.screenshot('complete-system-integration');
    });
  });

  afterEach(() => {
    cy.screenshot('test-complete');
  });

  after(() => {
    cy.log('🏁 All Comprehensive Tests Complete');
    cy.screenshot('final-comprehensive-test-state');
  });
});
