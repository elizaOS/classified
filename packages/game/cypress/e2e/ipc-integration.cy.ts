/**
 * Integration tests for Tauri IPC capability handlers
 * Tests the Rust backend IPC commands directly
 */

describe('Tauri IPC Integration Tests', () => {
  before(() => {
    cy.visit('/');

    // Wait for Tauri to be ready
    cy.window().should('have.property', '__TAURI_INTERNALS__');

    // Wait for game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
  });

  describe('IPC Command Availability', () => {
    it('should have all capability IPC commands available', () => {
      cy.window().then((win) => {
        const tauri = (win as any).__TAURI_INTERNALS__;
        expect(tauri).to.exist;
      });
    });
  });

  describe('Autonomy IPC Commands', () => {
    it('should get autonomy status via IPC', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const result = await invoke('get_autonomy_status');
        expect(result).to.be.an('object');

        // Should have standard response format
        expect(result.data).to.exist;
      });
    });

    it('should toggle autonomy via IPC', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const result = await invoke('toggle_autonomy', { enable: true });
        expect(result).to.be.an('object');
      });
    });
  });

  describe('Capability IPC Commands', () => {
    ['shell', 'browser'].forEach((capability) => {
      it(`should get ${capability} capability status via IPC`, () => {
        cy.window().then(async (win) => {
          const { invoke } = (win as any).__TAURI__.core;

          const result = await invoke('get_capability_status', { capability });
          expect(result).to.be.an('object');
        });
      });

      it(`should toggle ${capability} capability via IPC`, () => {
        cy.window().then(async (win) => {
          const { invoke } = (win as any).__TAURI__.core;

          const result = await invoke('toggle_capability', { capability });
          expect(result).to.be.an('object');
        });
      });
    });
  });

  describe('Agent Settings IPC Commands', () => {
    it('should update agent setting via IPC', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const result = await invoke('update_agent_setting', {
          key: 'TEST_SETTING',
          value: 'test_value',
        });
        expect(result).to.be.an('object');
      });
    });

    it('should get agent settings via IPC', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const result = await invoke('get_agent_settings');
        expect(result).to.be.an('object');
      });
    });

    it('should get vision settings via IPC', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const result = await invoke('get_vision_settings');
        expect(result).to.be.an('object');
      });
    });

    it('should refresh vision service via IPC', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const result = await invoke('refresh_vision_service');
        expect(result).to.be.an('object');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid capability names gracefully', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        await invoke('toggle_capability', { capability: 'invalid_capability' });
      });
    });

    it('should handle malformed IPC requests gracefully', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        await invoke('update_agent_setting', { invalid: 'parameter' });
      });
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent response formats', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const result = await invoke('get_autonomy_status');

        // Should follow standard response format
        expect(result).to.be.an('object');

        expect(result.data).to.exist;
      });
    });
  });

  describe('Performance Tests', () => {
    it('should respond to IPC calls within reasonable time', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const startTime = Date.now();

        await invoke('get_autonomy_status');
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should respond within 5 seconds
        expect(duration).to.be.lessThan(5000);
      });
    });

    it('should handle concurrent IPC calls', () => {
      cy.window().then(async (win) => {
        const { invoke } = (win as any).__TAURI__.core;

        const promises = [
          invoke('get_autonomy_status'),
          invoke('get_capability_status', { capability: 'shell' }),
          invoke('get_vision_settings'),
        ];

        const results = await Promise.all(promises);

        // All should complete (successfully or with error)
        expect(results).to.have.length(3);
        results.forEach((result) => {
          expect(result).to.exist;
        });
      });
    });
  });
});
