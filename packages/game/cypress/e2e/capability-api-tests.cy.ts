/**
 * API Tests for Agent Capability Management
 * Tests the backend API endpoints directly
 */

describe('Agent Capability API Tests', () => {
  const baseUrl = 'http://localhost:7777';

  describe('Autonomy API', () => {
    it('should get autonomy status', () => {
      cy.request('GET', `${baseUrl}/autonomy/status`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('enabled');
        expect(response.body.data).to.have.property('running');
        expect(response.body.data).to.have.property('interval');
      });
    });

    it('should enable autonomy', () => {
      cy.request('POST', `${baseUrl}/autonomy/enable`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('enabled', true);
      });
    });

    it('should disable autonomy', () => {
      cy.request('POST', `${baseUrl}/autonomy/disable`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('enabled', false);
      });
    });

    it('should toggle autonomy state', () => {
      // Get initial state
      cy.request('GET', `${baseUrl}/autonomy/status`).then((initialResponse) => {
        const initialState = initialResponse.body.data.enabled;

        // Toggle
        cy.request('POST', `${baseUrl}/autonomy/toggle`).then((toggleResponse) => {
          expect(toggleResponse.status).to.equal(200);
          expect(toggleResponse.body.data.enabled).to.equal(!initialState);
        });

        // Toggle back
        cy.request('POST', `${baseUrl}/autonomy/toggle`).then((toggleBackResponse) => {
          expect(toggleBackResponse.status).to.equal(200);
          expect(toggleBackResponse.body.data.enabled).to.equal(initialState);
        });
      });
    });
  });

  describe('Capability API', () => {
    const capabilities = ['shell', 'browser'];

    capabilities.forEach((capability) => {
      describe(`${capability} capability`, () => {
        it(`should get ${capability} status`, () => {
          cy.request('GET', `${baseUrl}/api/agents/default/capabilities/${capability}`).then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('success', true);
            expect(response.body.data).to.have.property('enabled');
            expect(response.body.data).to.have.property('service_available');
          });
        });

        it(`should toggle ${capability} capability`, () => {
          // Get initial state
          cy.request('GET', `${baseUrl}/api/agents/default/capabilities/${capability}`).then((initialResponse) => {
            const initialState = initialResponse.body.data.enabled;

            // Toggle
            cy.request('POST', `${baseUrl}/api/agents/default/capabilities/${capability}/toggle`).then((toggleResponse) => {
              expect(toggleResponse.status).to.equal(200);
              expect(toggleResponse.body.data.enabled).to.equal(!initialState);
            });

            // Verify state changed
            cy.request('GET', `${baseUrl}/api/agents/default/capabilities/${capability}`).then((verifyResponse) => {
              expect(verifyResponse.body.data.enabled).to.equal(!initialState);
            });

            // Toggle back
            cy.request('POST', `${baseUrl}/api/agents/default/capabilities/${capability}/toggle`).then((toggleBackResponse) => {
              expect(toggleBackResponse.status).to.equal(200);
              expect(toggleBackResponse.body.data.enabled).to.equal(initialState);
            });
          });
        });
      });
    });
  });

  describe('Vision Settings API', () => {
    it('should get vision settings', () => {
      cy.request('GET', `${baseUrl}/api/agents/default/settings/vision`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('ENABLE_CAMERA');
        expect(response.body.data).to.have.property('ENABLE_SCREEN_CAPTURE');
        expect(response.body.data).to.have.property('ENABLE_MICROPHONE');
        expect(response.body.data).to.have.property('ENABLE_SPEAKER');
      });
    });

    it('should refresh vision service', () => {
      cy.request('POST', `${baseUrl}/api/agents/default/vision/refresh`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('refreshed');
      });
    });
  });

  describe('Settings API', () => {
    it('should update agent settings', () => {
      const testKey = `TEST_SETTING_${Date.now()}`;
      const testValue = `test_value_${Date.now()}`;

      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/agents/default/settings`,
        body: {
          key: testKey,
          value: testValue
        }
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('key', testKey);
        expect(response.body.data).to.have.property('value', testValue);
      });
    });

    it('should get all agent settings', () => {
      cy.request('GET', `${baseUrl}/api/agents/default/settings`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('object');
      });
    });

    it('should handle missing key error', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/agents/default/settings`,
        body: {
          value: 'test'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400);
        expect(response.body.success).to.equal(false);
        expect(response.body.error.code).to.equal('MISSING_KEY');
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple capability toggles concurrently', () => {
      const promises = ['shell', 'browser'].map(cap =>
        cy.request('POST', `${baseUrl}/api/agents/default/capabilities/${cap}/toggle`)
      );

      cy.wrap(Promise.all(promises)).then((responses) => {
        responses.forEach(response => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.equal(true);
        });
      });
    });

    it('should handle rapid toggling without race conditions', () => {
      const capability = 'shell';

      // Get initial state
      cy.request('GET', `${baseUrl}/api/agents/default/capabilities/${capability}`).then((initialResponse) => {
        const initialState = initialResponse.body.data.enabled;

        // Rapid toggles (odd number)
        cy.request('POST', `${baseUrl}/api/agents/default/capabilities/${capability}/toggle`);
        cy.request('POST', `${baseUrl}/api/agents/default/capabilities/${capability}/toggle`);
        cy.request('POST', `${baseUrl}/api/agents/default/capabilities/${capability}/toggle`);

        // Final state should be opposite of initial
        cy.request('GET', `${baseUrl}/api/agents/default/capabilities/${capability}`).then((finalResponse) => {
          expect(finalResponse.body.data.enabled).to.equal(!initialState);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid capability gracefully', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/api/agents/default/capabilities/invalid_capability`,
        failOnStatusCode: false
      }).then((response) => {
        // Should still return a valid response structure
        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data.service_available).to.equal(false);
      });
    });

    it('should handle malformed requests', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/agents/default/settings`,
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 500]);
      });
    });
  });
});
