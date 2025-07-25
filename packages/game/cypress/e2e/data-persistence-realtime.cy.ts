/// <reference types="cypress" />

describe('Data Persistence and Real-time Updates', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });

    cy.visit('/', { timeout: 30000 });
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Wait for initial data to load
    cy.wait(5000);
  });

  it('should verify data persistence across page refreshes', () => {
    cy.screenshot('01-before-refresh');

    // Record initial state of all components
    const initialState = {};

    // Check Goals
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.get('.status-header').invoke('text').then(text => {
        const match = text.match(/\[(\d+)\]/);
        initialState.goals = match ? parseInt(match[1]) : 0;
        cy.log(`Initial goals count: ${initialState.goals}`);
      });
    });

    // Check Todos
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.get('.status-header').invoke('text').then(text => {
        const match = text.match(/\[(\d+)\]/);
        initialState.todos = match ? parseInt(match[1]) : 0;
        cy.log(`Initial todos count: ${initialState.todos}`);
      });
    });

    // Check Files
    cy.get('[data-testid="files-tab"]').click();
    cy.get('[data-testid="files-content"]').within(() => {
      cy.get('.status-header').invoke('text').then(text => {
        const match = text.match(/\[(\d+)\]/);
        initialState.files = match ? parseInt(match[1]) : 0;
        cy.log(`Initial files count: ${initialState.files}`);
      });
    });

    // Refresh the page
    cy.reload();
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
    cy.wait(5000); // Wait for data to reload

    cy.screenshot('02-after-refresh');

    // Verify Goals persisted
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.get('.status-header').invoke('text').then(text => {
        const match = text.match(/\[(\d+)\]/);
        const currentCount = match ? parseInt(match[1]) : 0;
        expect(currentCount).to.equal(initialState.goals);
        cy.log(`✅ Goals persisted: ${currentCount} = ${initialState.goals}`);
      });
    });

    // Verify Todos persisted
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.get('.status-header').invoke('text').then(text => {
        const match = text.match(/\[(\d+)\]/);
        const currentCount = match ? parseInt(match[1]) : 0;
        expect(currentCount).to.equal(initialState.todos);
        cy.log(`✅ Todos persisted: ${currentCount} = ${initialState.todos}`);
      });
    });

    // Verify Files persisted
    cy.get('[data-testid="files-tab"]').click();
    cy.get('[data-testid="files-content"]').within(() => {
      cy.get('.status-header').invoke('text').then(text => {
        const match = text.match(/\[(\d+)\]/);
        const currentCount = match ? parseInt(match[1]) : 0;
        expect(currentCount).to.equal(initialState.files);
        cy.log(`✅ Files persisted: ${currentCount} = ${initialState.files}`);
      });
    });
  });

  it('should verify periodic data refresh happens automatically', () => {
    // Set up network intercepts with aliases
    cy.intercept('GET', '**/api/goals').as('goalsRefresh');
    cy.intercept('GET', '**/api/todos').as('todosRefresh');
    cy.intercept('GET', '**/knowledge/documents').as('filesRefresh');
    cy.intercept('GET', '**/api/plugin-config').as('configRefresh');
    cy.intercept('GET', '**/autonomy/status').as('autonomyRefresh');
    cy.intercept('GET', '**/api/memories*').as('memoriesRefresh');

    cy.screenshot('03-before-refresh-test');

    // Wait for first set of API calls to complete
    cy.wait('@goalsRefresh', { timeout: 10000 });
    cy.wait('@todosRefresh', { timeout: 10000 });
    cy.log('✅ Initial data loaded');

    // Wait for periodic refresh (should happen every 5 seconds)
    cy.wait('@goalsRefresh', { timeout: 10000 });
    cy.wait('@todosRefresh', { timeout: 10000 });
    cy.log('✅ First periodic refresh detected');

    // Wait for another refresh cycle
    cy.wait('@goalsRefresh', { timeout: 10000 });
    cy.wait('@todosRefresh', { timeout: 10000 });
    cy.log('✅ Second periodic refresh detected');

    // Verify other endpoints are also being called
    cy.wait('@configRefresh', { timeout: 10000 });
    cy.wait('@filesRefresh', { timeout: 10000 });
    cy.log('✅ Config and files refreshes detected');

    cy.screenshot('04-periodic-refresh-verified');
  });

  it('should handle API failures gracefully and show user feedback', () => {
    // Intercept APIs and make them fail
    cy.intercept('GET', '**/api/goals', { statusCode: 500, body: { error: 'Server error' } }).as('goalsError');
    cy.intercept('GET', '**/api/todos', { statusCode: 404, body: { error: 'Not found' } }).as('todosError');

    // Reload to trigger the failing API calls
    cy.reload();
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Wait for the failing API calls
    cy.wait('@goalsError', { timeout: 10000 });
    cy.wait('@todosError', { timeout: 10000 });

    // Check that error messages appear in the chat
    cy.get('[data-testid="chat-messages"]').within(() => {
      // Should have error messages
      cy.get('.chat-error').should('have.length.greaterThan', 0);

      // Verify error message format
      cy.get('.chat-error').each($error => {
        cy.wrap($error).find('.chat-prefix').should('contain.text', '[ERR]');
        cy.wrap($error).find('.chat-content').should('not.be.empty');
        cy.wrap($error).find('.chat-timestamp').should('be.visible');
      });
    });

    // Verify that the UI still functions despite API errors
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').should('be.visible');
    cy.get('[data-testid="goals-content"]').within(() => {
      // Should show empty state or previous data
      cy.contains('GOALS').should('be.visible');
    });

    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]').should('be.visible');
    cy.get('[data-testid="todos-content"]').within(() => {
      // Should show empty state or previous data
      cy.contains('TASKS').should('be.visible');
    });

    cy.screenshot('05-error-handling-verified');
  });

  it('should verify real-time monologue updates when available', () => {
    cy.screenshot('06-before-monologue-test');

    // Navigate to monologue tab
    cy.get('[data-testid="monologue-tab"]').click();
    cy.get('[data-testid="monologue-content"]', { timeout: 10000 }).should('be.visible');

    // Record initial monologue state
    cy.get('[data-testid="monologue-content"]').within(() => {
      cy.get('body').then($body => {
        const initialCount = $body.find('.monologue-item').length;
        cy.log(`Initial monologue items: ${initialCount}`);

        if (initialCount > 0) {
          // Verify monologue structure
          cy.get('.monologue-item').first().within(() => {
            cy.get('.monologue-text').should('be.visible').and('not.be.empty');
            // Timestamp might be present
            cy.get('body').then($item => {
              if ($item.find('.monologue-timestamp').length > 0) {
                cy.get('.monologue-timestamp').should('be.visible');
              }
            });
          });

          // Verify monologue items have actual content
          cy.get('.monologue-item').each($item => {
            cy.wrap($item).find('.monologue-text').should('not.be.empty');
          });

        } else {
          cy.contains('Agent is quiet...').should('be.visible');
        }
      });
    });

    // Test that monologue updates when new data comes in
    cy.intercept('GET', '**/api/memories*').as('memoriesUpdate');

    // Wait for data refresh
    cy.wait('@memoriesUpdate', { timeout: 10000 });
    cy.log('✅ Memories API called for monologue update');

    // Verify the monologue area is still functional
    cy.get('[data-testid="monologue-content"]').within(() => {
      cy.contains('THOUGHTS').should('be.visible');
    });

    cy.screenshot('07-monologue-updates-verified');
  });

  it('should verify agent status and connection state updates', () => {
    cy.screenshot('08-before-connection-test');

    // Check connection status indicator
    cy.get('[data-testid="connection-status"]').should('be.visible');
    cy.get('[data-testid="connection-status"]').then($status => {
      const statusText = $status.text();
      expect(statusText).to.match(/(ONLINE|OFFLINE)/);
      cy.log(`Connection status: ${statusText}`);
    });

    // Check autonomy status
    cy.get('[data-testid="autonomy-status"]').should('be.visible');
    cy.get('[data-testid="autonomy-status"]').then($autonomy => {
      const autonomyText = $autonomy.text();
      expect(autonomyText).to.match(/(Active|Paused)/);
      cy.log(`Autonomy status: ${autonomyText}`);
    });

    // Verify capability toggles reflect current state
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

    capabilities.forEach(capability => {
      cy.get(`[data-testid="${capability}-toggle"]`).then($toggle => {
        const isEnabled = $toggle.hasClass('enabled');
        const indicator = $toggle.find(`[data-testid="${capability}-toggle-status"]`).text();

        if (isEnabled) {
          expect(indicator).to.equal('◉');
          cy.log(`✅ ${capability} is enabled (◉)`);
        } else {
          expect(indicator).to.equal('◯');
          cy.log(`✅ ${capability} is disabled (◯)`);
        }
      });
    });

    cy.screenshot('09-status-indicators-verified');
  });

  it('should verify OCR-readable content is actually displayed on screen', () => {
    // Take detailed screenshots for OCR verification
    cy.screenshot('10-full-interface-ocr', { capture: 'fullPage' });

    // Goals tab OCR verification
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').should('be.visible');

    // Verify specific text is visible to OCR
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.contains('GOALS').should('be.visible');
      cy.get('.status-header').should('contain.text', 'GOALS');

      // Check if any goals are displayed
      cy.get('body').then($body => {
        if ($body.find('.status-item').length > 0) {
          cy.get('.status-item').first().within(() => {
            cy.get('.status-title').should('be.visible').and('not.be.empty');
            cy.get('.status-indicator').should('be.visible').and('not.be.empty');
          });
        }
      });
    });

    cy.screenshot('11-goals-ocr-detail', {
      clip: { x: 0, y: 0, width: 1280, height: 720 }
    });

    // Todos tab OCR verification
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]').should('be.visible');

    cy.get('[data-testid="todos-content"]').within(() => {
      cy.contains('TASKS').should('be.visible');
      cy.get('.status-header').should('contain.text', 'TASKS');
    });

    cy.screenshot('12-todos-ocr-detail');

    // Files tab OCR verification
    cy.get('[data-testid="files-tab"]').click();
    cy.get('[data-testid="files-content"]').should('be.visible');

    cy.get('[data-testid="files-content"]').within(() => {
      cy.contains('KNOWLEDGE BASE').should('be.visible');
      cy.get('.status-header').should('contain.text', 'KNOWLEDGE BASE');
      cy.get('.upload-btn').should('be.visible').and('contain.text', '+ Upload File');
    });

    cy.screenshot('13-files-ocr-detail');

    // Config tab OCR verification
    cy.get('[data-testid="config-tab"]').click();
    cy.get('[data-testid="config-content"]').should('be.visible');

    cy.get('[data-testid="config-content"]').within(() => {
      cy.contains('CONFIGURATION').should('be.visible');
      cy.get('.status-header').should('contain.text', 'CONFIGURATION');
      cy.get('.reset-btn').should('be.visible').and('contain.text', 'RESET AGENT');
    });

    cy.screenshot('14-config-ocr-detail');

    // Final comprehensive screenshot
    cy.screenshot('15-final-comprehensive-ocr', {
      capture: 'fullPage',
      onAfterScreenshot: () => {
        cy.log('📸 All OCR verification screenshots completed');
      }
    });
  });

  afterEach(() => {
    cy.screenshot('99-test-complete');
  });
});
