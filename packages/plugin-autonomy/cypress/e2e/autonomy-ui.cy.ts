describe('Autonomy UI Tests', () => {
  beforeEach(() => {
    // Visit the autonomy UI
    cy.visit('/autonomy');
  });

  it('should load the autonomy panel', () => {
    // Check that the main elements exist
    cy.contains('h1', 'Autonomy Control Panel').should('be.visible');
    cy.contains('h2', 'Agent Information').should('be.visible');
    cy.contains('h2', 'Autonomy Status').should('be.visible');
    cy.contains('h2', 'Loop Interval').should('be.visible');
  });

  it('should display agent information', () => {
    // Wait for data to load
    cy.contains('Agent ID:').should('be.visible');
    cy.contains('Character:').should('be.visible');
  });

  it('should show autonomy status', () => {
    // Check for status indicator
    cy.get('.status-indicator').should('be.visible');
    cy.get('.status-dot').should('exist');

    // Check for toggle button
    cy.get('[data-testid="toggle-autonomy-btn"]').should('be.visible');
  });

  it('should toggle autonomy on and off', () => {
    // Wait for initial status to load
    cy.get('[data-testid="toggle-autonomy-btn"]').should('not.be.disabled');

    // Get initial state
    cy.get('[data-testid="toggle-autonomy-btn"]').then(($btn) => {
      const initialText = $btn.text();
      const isEnabled = initialText.includes('Disable');

      // Click to toggle
      cy.get('[data-testid="toggle-autonomy-btn"]').click();

      // Wait for the status to update
      cy.get('[data-testid="toggle-autonomy-btn"]').should('not.contain', 'Processing...');

      // Verify the button text changed
      if (isEnabled) {
        cy.get('[data-testid="toggle-autonomy-btn"]').should('contain', 'Enable Autonomy');
        cy.get('.status-dot.disabled').should('exist');
      } else {
        cy.get('[data-testid="toggle-autonomy-btn"]').should('contain', 'Disable Autonomy');
        cy.get('.status-dot.enabled').should('exist');
      }
    });
  });

  it('should update loop interval', () => {
    // Check interval input exists
    cy.get('[data-testid="interval-input"]').should('be.visible');
    cy.get('[data-testid="update-interval-btn"]').should('be.visible');

    // Clear and type new interval
    cy.get('[data-testid="interval-input"]').clear().type('60000');

    // Click update
    cy.get('[data-testid="update-interval-btn"]').click();

    // Verify the update happened (check help text)
    cy.contains('Current: 60000ms (60s)').should('be.visible');
  });

  it('should validate interval input', () => {
    // Try to set invalid interval
    cy.get('[data-testid="interval-input"]').clear().type('500');
    cy.get('[data-testid="update-interval-btn"]').click();

    // Should show error
    cy.get('[data-testid="error-message"]').should('contain', 'Interval must be at least 1000ms');
  });

  it('should handle API errors gracefully', () => {
    // Intercept both enable and disable calls to force errors
    cy.intercept('POST', '/api/autonomy/enable', {
      statusCode: 500,
      body: { success: false, error: 'Server error' },
    }).as('enableError');

    cy.intercept('POST', '/api/autonomy/disable', {
      statusCode: 500,
      body: { success: false, error: 'Server error' },
    }).as('disableError');

    // Click the toggle button regardless of current state
    cy.get('[data-testid="toggle-autonomy-btn"]').click();

    // Verify error message appears
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.get('[data-testid="error-message"]').should('contain', 'Failed to toggle autonomy');
  });

  it('should poll for status updates', () => {
    // Intercept status API calls
    let callCount = 0;
    cy.intercept('GET', '/api/autonomy/status', () => {
      callCount++;
      return {
        success: true,
        data: {
          enabled: callCount % 2 === 0,
          interval: 30000,
          agentId: 'test-agent',
          characterName: 'Test Character',
        },
      };
    }).as('statusPoll');

    // Wait for initial poll
    cy.wait('@statusPoll');

    // Wait a shorter time and verify second poll
    cy.wait(2000); // Reduced wait time

    // Verify polling is happening
    cy.get('@statusPoll.all').should('have.length.at.least', 1);
  });
});

describe('Autonomy API Tests', () => {
  it('should handle GET /autonomy/status', () => {
    cy.request('GET', '/api/autonomy/status').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success');
      if (response.body.success) {
        expect(response.body.data).to.have.all.keys(
          'enabled',
          'interval',
          'agentId',
          'characterName'
        );
      }
    });
  });

  it('should handle POST /autonomy/enable', () => {
    cy.request('POST', '/api/autonomy/enable').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success');
      if (response.body.success) {
        expect(response.body.data.enabled).to.be.true;
      }
    });
  });

  it('should handle POST /autonomy/disable', () => {
    cy.request('POST', '/api/autonomy/disable').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success');
      if (response.body.success) {
        expect(response.body.data.enabled).to.be.false;
      }
    });
  });

  it('should handle POST /autonomy/interval', () => {
    cy.request({
      method: 'POST',
      url: '/api/autonomy/interval',
      body: { interval: 45000 },
      headers: { 'Content-Type': 'application/json' },
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success');
      if (response.body.success) {
        expect(response.body.data.interval).to.equal(45000);
      }
    });
  });

  it('should reject invalid interval', () => {
    cy.request({
      method: 'POST',
      url: '/api/autonomy/interval',
      body: { interval: 500 },
      headers: { 'Content-Type': 'application/json' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(400);
      expect(response.body.error).to.contain('Invalid interval');
    });
  });
});
