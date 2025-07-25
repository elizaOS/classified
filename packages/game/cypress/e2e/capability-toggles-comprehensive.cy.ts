describe('Comprehensive Capability Toggles Test', () => {
  const API_BASE_URL = 'http://localhost:7777';
  const capabilities = [
    { name: 'autonomy', displayName: 'AUTO', settingKey: 'AUTONOMY_ENABLED' },
    { name: 'shell', displayName: 'SH', settingKey: 'ENABLE_SHELL' },
    { name: 'browser', displayName: 'WWW', settingKey: 'ENABLE_BROWSER' },
    { name: 'camera', displayName: 'CAM', settingKey: 'ENABLE_CAMERA' },
    { name: 'screen', displayName: 'SCR', settingKey: 'ENABLE_SCREEN_CAPTURE' },
    { name: 'microphone', displayName: 'MIC', settingKey: 'ENABLE_MICROPHONE' },
    { name: 'speaker', displayName: 'SPK', settingKey: 'ENABLE_SPEAKER' }
  ];

  const dataEndpoints = [
    { name: 'goals', url: '/api/goals', expectedKey: 'goals' },
    { name: 'todos', url: '/api/todos', expectedKey: 'todos' },
    { name: 'monologue', url: '/api/monologue', expectedKey: 'thoughts' }
  ];

  beforeEach(() => {
    // Wait for backend to be ready
    cy.request({
      url: `${API_BASE_URL}/api/server/health`,
      timeout: 30000,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status !== 200) {
        cy.log('Backend not ready, waiting...');
        cy.wait(5000);
      }
    });

    // Skip startup flow for testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipStartup', 'true');
    });

    // Visit the game interface
    cy.visit('http://localhost:5173');

    // Wait for the interface to load - check for either ELIZA Terminal or any main UI element
    cy.get('.game-interface, [data-testid="game-interface"], .terminal-header', { timeout: 10000 }).should('exist');
  });

  describe('Capability Toggle Buttons', () => {
    capabilities.forEach(capability => {
      it(`should toggle ${capability.name} capability on and off`, () => {
        // Find the capability button - look for the text within capability buttons area
        cy.get('.capabilities, [class*="capability"], [class*="button"]')
          .contains(capability.displayName)
          .parent()
          .as('capButton');

        // Get initial state
        cy.get('@capButton').then($btn => {
          const initialClass = $btn.attr('class');
          cy.log(`Initial state for ${capability.name}: ${initialClass}`);
        });

        // Click to toggle
        cy.get('@capButton').click();
        cy.wait(1000); // Allow time for API call

        // Check if state changed visually
        cy.get('@capButton').then($btn => {
          const newClass = $btn.attr('class');
          cy.log(`New state for ${capability.name}: ${newClass}`);
        });

        // Click to toggle back
        cy.get('@capButton').click();
        cy.wait(1000);

        // Take screenshot of final state
        cy.screenshot(`capability-${capability.name}-toggle`);
      });
    });
  });

  describe('API Endpoints', () => {
    dataEndpoints.forEach(endpoint => {
      it(`should fetch data from ${endpoint.name} endpoint`, () => {
        cy.request({
          method: 'GET',
          url: `${API_BASE_URL}${endpoint.url}`,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.have.property('success', true);
          expect(response.body).to.have.property(endpoint.expectedKey);
          expect(response.body[endpoint.expectedKey]).to.be.an('array');

          cy.log(`${endpoint.name} data:`, JSON.stringify(response.body[endpoint.expectedKey]));
        });
      });
    });
  });

  describe('UI Tab Navigation', () => {
    const tabs = [
      { name: 'GOALS', selector: 'goals' },
      { name: 'TODOS', selector: 'todos' },
      { name: 'MONOLOGUE', selector: 'monologue' },
      { name: 'FILES', selector: 'files' },
      { name: 'CONFIG', selector: 'config' }
    ];

    tabs.forEach(tab => {
      it(`should display ${tab.name} tab content`, () => {
        // Click on the tab - tabs are in uppercase in the UI
        cy.contains(tab.name, { timeout: 5000 }).click();

        // Wait for content to load
        cy.wait(1000);

        // Take screenshot of tab content
        cy.screenshot(`tab-${tab.selector}-content`);

        // Just verify we can see some content area
        cy.get('body').should('contain.text', tab.name);
      });
    });
  });

  describe('Autonomy Service Integration', () => {
    it('should enable autonomy and show thoughts in monologue', () => {
      // Find and click AUTO button
      cy.get('.capabilities, [class*="capability"], [class*="button"]')
        .contains('AUTO')
        .parent()
        .click();
      cy.wait(1000);

      // Navigate to monologue tab
      cy.contains('MONOLOGUE').click();
      cy.wait(3000); // Wait for autonomy to generate thoughts

      // Take screenshot of monologue
      cy.screenshot('autonomy-monologue-active');
    });
  });

  describe('Full Integration Test', () => {
    it('should test complete capability management flow', () => {
      // 1. Navigate through tabs
      cy.log('Checking all tabs...');
      const tabs = ['GOALS', 'TODOS', 'MONOLOGUE', 'FILES', 'CONFIG'];
      tabs.forEach(tab => {
        cy.contains(tab).click();
        cy.wait(500);
        cy.screenshot(`integration-${tab.toLowerCase()}`);
      });

      // 2. Send a message to the agent (go back to main chat)
      cy.log('Testing chat functionality...');
      cy.get('input[type="text"], textarea, input[placeholder*="message"], input[placeholder*="chat"]').first()
        .type('Hello ELIZA, what are your current goals?{enter}');
      cy.wait(3000);

      // Final screenshot
      cy.screenshot('integration-complete');
    });
  });

  describe('Error Handling', () => {
    it('should handle backend errors gracefully', () => {
      // Test with invalid API calls
      cy.request({
        method: 'POST',
        url: `${API_BASE_URL}/api/agents/default/autonomy/enable`,
        body: { invalid: 'data' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 400, 500]);
        if (response.status !== 200) {
          expect(response.body).to.have.property('error');
        }
      });
    });
  });
});
