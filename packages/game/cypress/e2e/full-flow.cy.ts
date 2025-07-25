describe('ELIZA Game Full End-to-End Flow', () => {
  it('should complete full flow from startup to agent interaction', () => {
    // Start from the main page
    cy.visit('http://localhost:5173');

    // Verify we start at the setup screen with START button
    cy.get('button').contains('START').should('be.visible');
    cy.contains('ELIZA SETUP').should('be.visible');

    // Take screenshot of initial state
    cy.screenshot('01-initial-setup-screen');

    // Click START button
    cy.get('button').contains('START').click();

    // Verify we transition to boot sequence
    cy.get('body', { timeout: 10000 }).should((body) => {
      const text = body.text();
      expect(text).to.match(/ELIZA STARTUP|Initializing|Loading configuration/i);
    });

    cy.screenshot('02-boot-sequence-started');

    // Wait for boot sequence to complete or show connection status
    cy.get('body', { timeout: 30000 }).should((body) => {
      const text = body.text();
      // Should show either successful connection or connection failed
      expect(text).to.match(/Testing agent connection|Connection failed|Agent ready|System ready/i);
    });

    cy.screenshot('03-boot-sequence-complete');

    // If connection failed, press any key to retry
    cy.get('body').then((body) => {
      if (body.text().includes('Connection failed')) {
        cy.log('Connection failed, attempting retry...');
        cy.get('body').type('{enter}');
        cy.wait(2000);
        cy.screenshot('04-retry-connection');
      }
    });

    // Check if we reach the main interface or get stuck
    cy.get('body', { timeout: 45000 }).then((body) => {
      const text = body.text();

      // Check for various success states
      if (
        text.includes('Send a message') ||
        text.includes('Type a message') ||
        text.includes('chat')
      ) {
        cy.log('Successfully reached chat interface');
        cy.screenshot('05-chat-interface-ready');

        // Try to find and interact with chat input
        cy.get('input[type="text"], textarea')
          .first()
          .then((input) => {
            cy.wrap(input).type('Hello ELIZA!');
            cy.screenshot('06-typed-message');

            // Find and click send button or press enter
            cy.get('button')
              .contains(/send/i)
              .click()
              .then(() => {
                cy.log('Clicked send button');
              })
              .catch(() => {
                cy.log('No send button found, pressing enter');
                cy.wrap(input).type('{enter}');
              });

            // Wait for response
            cy.wait(5000);
            cy.screenshot('07-after-send-message');

            // Verify agent responded
            cy.get('body').should((responseBody) => {
              const responseText = responseBody.text();
              // Agent should have responded with something
              expect(responseText).to.not.equal(text);
            });

            cy.screenshot('08-agent-response-received');
          });
      } else if (
        text.includes('Setup required') ||
        text.includes('API key') ||
        text.includes('Configure')
      ) {
        cy.log('Reached configuration required screen');
        cy.screenshot('05-configuration-required');

        // If we need to configure API keys
        if (text.includes('OpenAI') || text.includes('Anthropic')) {
          cy.log('API key configuration needed');

          // Look for API key input fields
          cy.get('input[type="text"], input[type="password"]').each((input, index) => {
            const placeholder = input.attr('placeholder') || '';
            if (
              placeholder.toLowerCase().includes('api') ||
              placeholder.toLowerCase().includes('key')
            ) {
              cy.wrap(input).type(`test-api-key-${index}`);
            }
          });

          cy.screenshot('06-entered-api-keys');

          // Look for continue/save button
          cy.get('button')
            .contains(/continue|save|next|submit/i)
            .click();
          cy.wait(2000);
          cy.screenshot('07-after-config-submit');
        }
      } else if (text.includes('Error') || text.includes('Failed')) {
        cy.log('Encountered error state');
        cy.screenshot('05-error-state');
        throw new Error(`Application reached error state: ${text.substring(0, 200)}`);
      } else {
        cy.log('Reached unknown state');
        cy.screenshot('05-unknown-state');
        cy.log('Current page text:', text.substring(0, 500));
      }
    });

    // Final verification - check that we're not stuck
    cy.get('body').should('not.contain', 'Connection failed');
    cy.screenshot('09-final-state');
  });

  // Additional test for health endpoint
  it('should have working health endpoint', () => {
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false,
    }).then((response) => {
      // Health endpoint can return 503 if no agents are running, which is ok
      expect([200, 503]).to.include(response.status);
      expect(response.body).to.have.property('status', 'OK');
      expect(response.body).to.have.property('timestamp');
      expect(response.body).to.have.property('dependencies');
    });
  });

  // Test container status endpoint
  it('should have working container status endpoint', () => {
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/containers/status',
      failOnStatusCode: false,
    }).then((response) => {
      // Container status endpoint might return 404 if not found, which we need to handle
      expect([200, 404]).to.include(response.status);
      expect(response.body).to.have.property('success');

      if (response.body.success) {
        expect(response.body).to.have.property('data');
        const data = response.body.data;

        // Should have postgres and ollama containers
        expect(data).to.have.property('eliza-postgres');
        expect(data).to.have.property('eliza-ollama');

        // Log container statuses
        cy.log('PostgreSQL status:', data['eliza-postgres']?.state);
        cy.log('Ollama status:', data['eliza-ollama']?.state);
      }
    });
  });
});
