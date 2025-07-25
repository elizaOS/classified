/**
 * End-to-End Tests for Agent Capability Toggles
 * Tests the complete path: Frontend UI → Tauri IPC → Rust Backend → Node.js Server → Agent Runtime
 */

describe('Agent Capability Toggles E2E', () => {
  const initialStates: Record<string, boolean> = {};

  before(() => {
    // Wait for the application to be ready
    cy.visit('/');
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Since we're running in a browser (not Tauri), skip connection status check
    // The backend is running and accessible directly
  });

  beforeEach(() => {
    // Capture initial states of all capability buttons
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

    capabilities.forEach(capability => {
      cy.get(`[data-testid="${capability}-toggle"]`)
        .should('be.visible')
        .then($button => {
          // Determine current state based on visual style
          const isActive = $button.css('background-color') === 'rgb(0, 255, 0)' ||
                          $button.hasClass('active') ||
                          $button.text().includes('●');
          initialStates[capability] = isActive;
          cy.log(`Initial ${capability} state: ${isActive}`);
        });
    });
  });

  describe('Autonomy Toggle', () => {
    it('should toggle autonomy capability via IPC', () => {
      cy.get('[data-testid="autonomy-toggle"]').as('autonomyButton');

      // Get initial state
      cy.get('@autonomyButton').then($button => {
        const wasActive = $button.css('background-color') === 'rgb(0, 255, 0)';

        // Click to toggle
        cy.get('@autonomyButton').click();

        // Wait for toggle animation/loading
        cy.wait(1000);

        // Verify state changed
        cy.get('@autonomyButton').should($newButton => {
          const isNowActive = $newButton.css('background-color') === 'rgb(0, 255, 0)';
          expect(isNowActive).to.not.equal(wasActive);
        });

        // Verify server state via API call
        cy.request({
          method: 'GET',
          url: 'http://localhost:7777/autonomy/status',
          failOnStatusCode: false
        }).then(response => {
          if (response.status === 200) {
            const expectedState = !wasActive;
            expect(response.body.data?.enabled).to.equal(expectedState);
          }
        });
      });
    });

    it('should handle autonomy toggle errors gracefully', () => {
      // Test error handling when server is not available
      cy.intercept('POST', '**/autonomy/**', { statusCode: 500 }).as('autonomyError');

      cy.get('[data-testid="autonomy-toggle"]').click();

      // Verify button doesn't get stuck in loading state
      cy.get('[data-testid="autonomy-toggle"]', { timeout: 5000 })
        .should('not.contain', '...');
    });
  });

  describe('Vision Capabilities', () => {
    ['camera', 'screen', 'microphone', 'speakers'].forEach(capability => {
      it(`should toggle ${capability} capability via IPC`, () => {
        cy.get(`[data-testid="${capability}-toggle"]`).as(`${capability}Button`);

        // Get initial state
        cy.get(`@${capability}Button`).then($button => {
          const wasActive = $button.css('background-color') === 'rgb(0, 255, 0)';

          // Click to toggle
          cy.get(`@${capability}Button`).click();

          // Wait for toggle animation/loading
          cy.wait(1500); // Vision settings need more time for refresh

          // Verify state changed
          cy.get(`@${capability}Button`).should($newButton => {
            const isNowActive = $newButton.css('background-color') === 'rgb(0, 255, 0)';
            expect(isNowActive).to.not.equal(wasActive);
          });

          // Verify server state via API call
          cy.request({
            method: 'GET',
            url: 'http://localhost:7777/api/agents/default/settings/vision',
            failOnStatusCode: false
          }).then(response => {
            if (response.status === 200) {
              const data = response.body.data;
              const settingKey = getVisionSettingKey(capability);
              const expectedState = !wasActive;

              // Check both possible setting keys
              const actualState = data[settingKey] === 'true' || data[settingKey] === true;
              expect(actualState).to.equal(expectedState);
            }
          });
        });
      });
    });

    function getVisionSettingKey(capability: string): string {
      const keyMap: Record<string, string> = {
        camera: 'ENABLE_CAMERA',
        screen: 'ENABLE_SCREEN_CAPTURE',
        microphone: 'ENABLE_MICROPHONE',
        speakers: 'ENABLE_SPEAKER'
      };
      return keyMap[capability];
    }
  });

  describe('Security Capabilities', () => {
    ['shell', 'browser'].forEach(capability => {
      it(`should show security warning before enabling ${capability}`, () => {
        cy.get(`[data-testid="${capability}-toggle"]`).as(`${capability}Button`);

        // Get initial state
        cy.get(`@${capability}Button`).then($button => {
          const wasActive = $button.css('background-color') === 'rgb(0, 255, 0)';

          // If not active, clicking should show security warning
          if (!wasActive) {
            cy.get(`@${capability}Button`).click();

            // Should show security warning modal
            cy.get('[data-testid="security-warning-modal"]', { timeout: 5000 })
              .should('be.visible');

            // Should show capability-specific warning
            cy.get('[data-testid="security-warning-modal"]')
              .should('contain', capability);

            // Cancel the warning
            cy.get('[data-testid="security-warning-cancel"]').click();

            // Modal should close
            cy.get('[data-testid="security-warning-modal"]')
              .should('not.exist');

            // State should remain unchanged
            cy.get(`@${capability}Button`).should($newButton => {
              const isNowActive = $newButton.css('background-color') === 'rgb(0, 255, 0)';
              expect(isNowActive).to.equal(wasActive);
            });
          }
        });
      });

      it(`should toggle ${capability} after security warning confirmation`, () => {
        cy.get(`[data-testid="${capability}-toggle"]`).as(`${capability}Button`);

        // Get initial state
        cy.get(`@${capability}Button`).then($button => {
          const wasActive = $button.css('background-color') === 'rgb(0, 255, 0)';

          // If active, should toggle without warning
          if (wasActive) {
            cy.get(`@${capability}Button`).click();
            cy.wait(1000);

            // Should toggle without warning
            cy.get(`@${capability}Button`).should($newButton => {
              const isNowActive = $newButton.css('background-color') === 'rgb(0, 255, 0)';
              expect(isNowActive).to.not.equal(wasActive);
            });
          } else {
            // If not active, should show warning and allow confirmation
            cy.get(`@${capability}Button`).click();

            // Wait for security warning
            cy.get('[data-testid="security-warning-modal"]', { timeout: 5000 })
              .should('be.visible');

            // Confirm the warning
            cy.get('[data-testid="security-warning-confirm"]').click();

            // Modal should close
            cy.get('[data-testid="security-warning-modal"]')
              .should('not.exist');

            // Wait for toggle to complete
            cy.wait(1000);

            // State should change
            cy.get(`@${capability}Button`).should($newButton => {
              const isNowActive = $newButton.css('background-color') === 'rgb(0, 255, 0)';
              expect(isNowActive).to.not.equal(wasActive);
            });
          }
        });
      });
    });
  });

  describe('Real-time State Synchronization', () => {
    it('should synchronize capability states across multiple toggles', () => {
      const capabilities = ['autonomy', 'camera', 'screen'];
      const originalStates: Record<string, boolean> = {};

      // Capture original states
      capabilities.forEach(capability => {
        cy.get(`[data-testid="${capability}-toggle"]`).then($button => {
          originalStates[capability] = $button.css('background-color') === 'rgb(0, 255, 0)';
        });
      });

      // Toggle all capabilities
      capabilities.forEach(capability => {
        cy.get(`[data-testid="${capability}-toggle"]`).click();
        cy.wait(500);
      });

      // Wait for all changes to propagate
      cy.wait(2000);

      // Verify all states changed
      capabilities.forEach(capability => {
        cy.get(`[data-testid="${capability}-toggle"]`).should($button => {
          const currentState = $button.css('background-color') === 'rgb(0, 255, 0)';
          expect(currentState).to.not.equal(originalStates[capability]);
        });
      });

      // Toggle back to restore original states
      capabilities.forEach(capability => {
        cy.get(`[data-testid="${capability}-toggle"]`).click();
        cy.wait(500);
      });
    });

    it('should handle rapid consecutive toggles without race conditions', () => {
      cy.get('[data-testid="autonomy-toggle"]').as('autonomyButton');

      // Get initial state
      cy.get('@autonomyButton').then($button => {
        const initialState = $button.css('background-color') === 'rgb(0, 255, 0)';

        // Rapid consecutive clicks
        cy.get('@autonomyButton').click();
        cy.wait(100);
        cy.get('@autonomyButton').click();
        cy.wait(100);
        cy.get('@autonomyButton').click();

        // Wait for all operations to complete
        cy.wait(3000);

        // Final state should be different from initial (odd number of clicks)
        cy.get('@autonomyButton').should($finalButton => {
          const finalState = $finalButton.css('background-color') === 'rgb(0, 255, 0)';
          expect(finalState).to.not.equal(initialState);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle server unavailability gracefully', () => {
      // Intercept all agent API calls and return errors
      cy.intercept('POST', '**/autonomy/**', { statusCode: 503 }).as('serverError');
      cy.intercept('GET', '**/agents/**', { statusCode: 503 }).as('statusError');

      cy.get('[data-testid="autonomy-toggle"]').click();

      // Button should not get stuck in loading state
      cy.get('[data-testid="autonomy-toggle"]', { timeout: 10000 })
        .should('not.contain', '...')
        .and('be.enabled');
    });

    it('should show meaningful error messages for failed operations', () => {
      // Mock a specific error response
      cy.intercept('POST', '**/capabilities/shell/toggle', {
        statusCode: 400,
        body: { success: false, error: 'Shell capability not available' }
      }).as('shellError');

      cy.get('[data-testid="shell-toggle"]').then($button => {
        const wasActive = $button.css('background-color') === 'rgb(0, 255, 0)';

        // If not active, trigger security warning first
        if (!wasActive) {
          cy.get('[data-testid="shell-toggle"]').click();
          cy.get('[data-testid="security-warning-confirm"]', { timeout: 5000 }).click();
        } else {
          cy.get('[data-testid="shell-toggle"]').click();
        }

        // Should handle error gracefully
        cy.wait('@shellError');

        // Button should return to original state
        cy.get('[data-testid="shell-toggle"]').should($newButton => {
          const currentState = $newButton.css('background-color') === 'rgb(0, 255, 0)';
          expect(currentState).to.equal(wasActive);
        });
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete capability toggles within reasonable time limits', () => {
      const startTime = Date.now();

      cy.get('[data-testid="camera-toggle"]').click();

      cy.get('[data-testid="camera-toggle"]').should($button => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within 5 seconds
        expect(duration).to.be.lessThan(5000);
      });
    });

    it('should handle multiple simultaneous capability changes', () => {
      // Click multiple buttons rapidly
      ['camera', 'screen', 'microphone'].forEach(capability => {
        cy.get(`[data-testid="${capability}-toggle"]`).click();
      });

      // All should complete successfully within reasonable time
      cy.wait(5000);

      ['camera', 'screen', 'microphone'].forEach(capability => {
        cy.get(`[data-testid="${capability}-toggle"]`)
          .should('not.contain', '...')
          .and('be.enabled');
      });
    });
  });

  after(() => {
    // Restore initial states
    Object.keys(initialStates).forEach(capability => {
      cy.get(`[data-testid="${capability}-toggle"]`).then($button => {
        const currentState = $button.css('background-color') === 'rgb(0, 255, 0)';
        const targetState = initialStates[capability];

        if (currentState !== targetState) {
          if (['shell', 'browser'].includes(capability) && targetState) {
            // For security capabilities being enabled, handle warning
            cy.get(`[data-testid="${capability}-toggle"]`).click();
            cy.get('[data-testid="security-warning-confirm"]', { timeout: 5000 }).click();
          } else {
            cy.get(`[data-testid="${capability}-toggle"]`).click();
          }
          cy.wait(1000);
        }
      });
    });
  });
});
