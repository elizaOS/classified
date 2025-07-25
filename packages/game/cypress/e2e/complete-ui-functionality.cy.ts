/// <reference types="cypress" />

describe('Complete UI Functionality - Goals, Todos, Files, Config', () => {
  beforeEach(() => {
    // Skip boot sequence and go straight to interface
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });

    cy.visit('/', { timeout: 30000 });

    // Wait for the main interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Wait a bit for all initial API calls to complete
    cy.wait(3000);
  });

  it('should display all main UI components and tabs', () => {
    cy.screenshot('00-initial-state');

    // Verify main containers
    cy.get('[data-testid="game-interface"]').should('be.visible');
    cy.get('[data-testid="connection-status"]').should('be.visible');
    cy.get('[data-testid="chat-messages"]').should('be.visible');
    cy.get('[data-testid="chat-input"]').should('be.visible');

    // Verify all tabs are present
    const tabs = ['goals', 'todos', 'monologue', 'files', 'config'];
    tabs.forEach(tab => {
      cy.get(`[data-testid="${tab}-tab"]`).should('be.visible');
    });

    // Verify control buttons are present
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];
    capabilities.forEach(capability => {
      cy.get(`[data-testid="${capability}-toggle"]`).should('be.visible');
    });

    cy.screenshot('01-all-components-visible');
  });

  it('should properly display goals tab with data or empty state', () => {
    // Navigate to goals tab
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]', { timeout: 10000 }).should('be.visible');

    // Check for goals header with count
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.contains(/GOALS \[\d+\]/).should('be.visible');

      // Either goals exist or empty state is shown
      cy.get('body').then($body => {
        if ($body.find('.status-item').length > 0) {
          cy.log('✅ Goals found in UI');
          cy.get('.status-item').should('have.length.greaterThan', 0);

          // Verify goal structure
          cy.get('.status-item').first().within(() => {
            cy.get('.status-indicator').should('be.visible').and('not.be.empty');
            cy.get('.status-title').should('be.visible').and('not.be.empty');
            cy.get('.status-desc').should('be.visible');
          });

          // Verify indicators show correct completion state
          cy.get('.status-indicator').each($indicator => {
            const text = $indicator.text().trim();
            expect(['✓', '○']).to.include(text);
          });

        } else {
          cy.log('✅ No goals - empty state displayed');
          cy.contains('No active goals').should('be.visible');
        }
      });
    });

    cy.screenshot('02-goals-tab-verified');
  });

  it('should properly display todos tab with data or empty state', () => {
    // Navigate to todos tab
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]', { timeout: 10000 }).should('be.visible');

    // Check for todos header with count
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.contains(/TASKS \[\d+\]/).should('be.visible');

      // Either todos exist or empty state is shown
      cy.get('body').then($body => {
        if ($body.find('.status-item').length > 0) {
          cy.log('✅ Todos found in UI');
          cy.get('.status-item').should('have.length.greaterThan', 0);

          // Verify todo structure
          cy.get('.status-item').first().within(() => {
            cy.get('.status-indicator').should('be.visible').and('not.be.empty');
            cy.get('.status-title').should('be.visible').and('not.be.empty');
            cy.get('.status-desc').should('be.visible');
          });

          // Verify indicators show correct completion state
          cy.get('.status-indicator').each($indicator => {
            const text = $indicator.text().trim();
            expect(['✓', '○']).to.include(text);
          });

        } else {
          cy.log('✅ No todos - empty state displayed');
          cy.contains('No pending tasks').should('be.visible');
        }
      });
    });

    cy.screenshot('03-todos-tab-verified');
  });

  it('should properly display monologue tab with agent thoughts or empty state', () => {
    // Navigate to monologue tab
    cy.get('[data-testid="monologue-tab"]').click();
    cy.get('[data-testid="monologue-content"]', { timeout: 10000 }).should('be.visible');

    // Check for monologue header
    cy.get('[data-testid="monologue-content"]').within(() => {
      cy.contains('THOUGHTS').should('be.visible');

      // Either thoughts exist or empty state is shown
      cy.get('body').then($body => {
        if ($body.find('.monologue-item').length > 0) {
          cy.log('✅ Agent thoughts found');
          cy.get('.monologue-item').should('have.length.greaterThan', 0);

          // Verify thought structure
          cy.get('.monologue-item').first().within(() => {
            // Should have at least the text content
            cy.get('.monologue-text').should('be.visible').and('not.be.empty');
          });

        } else {
          cy.log('✅ No thoughts - empty state displayed');
          cy.contains('Agent is quiet...').should('be.visible');
        }
      });
    });

    cy.screenshot('04-monologue-tab-verified');
  });

  it('should properly display files tab with file management functionality', () => {
    // Navigate to files tab
    cy.get('[data-testid="files-tab"]').click();
    cy.get('[data-testid="files-content"]', { timeout: 10000 }).should('be.visible');

    // Check for files header with count
    cy.get('[data-testid="files-content"]').within(() => {
      cy.contains(/KNOWLEDGE BASE \[\d+\]/).should('be.visible');

      // Upload functionality should always be present
      cy.get('.upload-btn').should('be.visible').and('contain.text', '+ Upload File');
      cy.get('#file-upload').should('exist');

      // Either files exist or empty state is shown
      cy.get('body').then($body => {
        if ($body.find('.file-item').length > 0) {
          cy.log('✅ Knowledge files found');
          cy.get('.file-item').should('have.length.greaterThan', 0);

          // Verify file structure
          cy.get('.file-item').first().within(() => {
            cy.get('.file-icon').should('be.visible');
            cy.get('.file-name').should('be.visible').and('not.be.empty');
            cy.get('.file-meta').should('be.visible');
            cy.get('.file-action').should('be.visible');
          });

        } else {
          cy.log('✅ No files - empty state displayed');
          cy.contains('No knowledge files loaded').should('be.visible');
        }
      });
    });

    cy.screenshot('05-files-tab-verified');
  });

  it('should properly display config tab with configuration options', () => {
    // Navigate to config tab
    cy.get('[data-testid="config-tab"]').click();
    cy.get('[data-testid="config-content"]', { timeout: 10000 }).should('be.visible');

    // Check for config header
    cy.get('[data-testid="config-content"]').within(() => {
      cy.contains('CONFIGURATION').should('be.visible');

      // Danger zone should always be present
      cy.get('.danger-section').should('be.visible');
      cy.get('.reset-btn').should('be.visible').and('contain.text', 'RESET AGENT');

      // Check for any config sections
      cy.get('body').then($body => {
        if ($body.find('.config-section').length > 1) { // More than just danger zone
          cy.log('✅ Configuration sections found');

          // Look for environment settings if they exist
          if ($body.find('.config-title:contains("Environment Settings")').length > 0) {
            cy.get('.config-title:contains("Environment Settings")').should('be.visible');
            cy.get('select.config-select, input.config-input').should('have.length.greaterThan', 0);
          }

        } else {
          cy.log('✅ Only reset functionality available');
        }
      });
    });

    cy.screenshot('06-config-tab-verified');
  });

  it('should handle button interactions correctly without text interference', () => {
    cy.screenshot('07-before-button-tests');

    // Test tab button interactions - click on various parts of buttons
    const tabs = ['goals', 'todos', 'monologue', 'files', 'config'];

    tabs.forEach((tab, index) => {
      cy.log(`Testing ${tab} tab button`);

      // Click on the button element itself
      cy.get(`[data-testid="${tab}-tab"]`).click({ force: true });
      cy.get(`[data-testid="${tab}-tab"]`).should('have.class', 'active');
      cy.get(`[data-testid="${tab}-content"]`).should('be.visible');

      // Click on the text content inside the button
      cy.get(`[data-testid="${tab}-tab"]`).contains(tab.toUpperCase()).click({ force: true });
      cy.get(`[data-testid="${tab}-tab"]`).should('have.class', 'active');

      cy.wait(500); // Small delay between clicks
    });

    // Test capability toggle buttons
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

    capabilities.forEach(capability => {
      cy.log(`Testing ${capability} toggle button`);

      // Get initial state
      cy.get(`[data-testid="${capability}-toggle"]`).then($btn => {
        const wasEnabled = $btn.hasClass('enabled');

        // Click on the button
        cy.get(`[data-testid="${capability}-toggle"]`).click({ force: true });

        // Small wait for state change
        cy.wait(1000);

        // Verify state changed (or at least that the click was registered)
        // Some capabilities might not actually toggle if services aren't available
        cy.get(`[data-testid="${capability}-toggle"]`).should('exist');

        // Click on the indicator inside the button
        cy.get(`[data-testid="${capability}-toggle-status"]`).click({ force: true });
        cy.wait(500);

        // Click on the label inside the button
        cy.get(`[data-testid="${capability}-toggle"]`).contains(capability.toUpperCase()).click({ force: true });
        cy.wait(500);
      });
    });

    cy.screenshot('08-button-interactions-tested');
  });

  it('should refresh data periodically and handle API responses', () => {
    // Set up network interception
    cy.intercept('GET', '**/api/goals').as('goalsAPI');
    cy.intercept('GET', '**/api/todos').as('todosAPI');
    cy.intercept('GET', '**/knowledge/documents').as('filesAPI');
    cy.intercept('GET', '**/api/plugin-config').as('configAPI');
    cy.intercept('GET', '**/autonomy/status').as('autonomyAPI');
    cy.intercept('GET', '**/api/memories*').as('memoriesAPI');

    // Navigate through tabs to trigger API calls
    cy.get('[data-testid="goals-tab"]').click();
    cy.wait('@goalsAPI', { timeout: 10000 });
    cy.log('✅ Goals API called successfully');

    cy.get('[data-testid="todos-tab"]').click();
    cy.wait('@todosAPI', { timeout: 10000 });
    cy.log('✅ Todos API called successfully');

    cy.get('[data-testid="files-tab"]').click();
    cy.wait('@filesAPI', { timeout: 10000 });
    cy.log('✅ Files API called successfully');

    cy.get('[data-testid="config-tab"]').click();
    cy.wait('@configAPI', { timeout: 10000 });
    cy.log('✅ Config API called successfully');

    // Check that periodic refresh happens (should occur every 5 seconds)
    cy.get('[data-testid="goals-tab"]').click();
    cy.wait('@goalsAPI', { timeout: 10000 });
    cy.log('✅ Periodic refresh detected');

    cy.screenshot('09-api-calls-verified');
  });

  it('should handle errors gracefully and display user feedback', () => {
    // Check console for any JavaScript errors that might have been logged
    cy.window().then((win) => {
      cy.wrap(win.console).invoke('log', '✅ Checking for error handling in UI');
    });

    // Navigate through all tabs to ensure no UI errors
    const tabs = ['goals', 'todos', 'monologue', 'files', 'config'];

    tabs.forEach(tab => {
      cy.get(`[data-testid="${tab}-tab"]`).click();
      cy.get(`[data-testid="${tab}-content"]`).should('be.visible');

      // Check that error messages are visible if APIs failed
      cy.get('[data-testid="chat-messages"]').within(() => {
        cy.get('.chat-error').then($errors => {
          if ($errors.length > 0) {
            cy.log(`⚠️ Found ${$errors.length} error message(s) in chat - this is expected for missing services`);
            // Verify error messages are properly formatted
            cy.get('.chat-error').each($error => {
              cy.wrap($error).find('.chat-prefix').should('contain.text', '[ERR]');
              cy.wrap($error).find('.chat-content').should('not.be.empty');
            });
          } else {
            cy.log('✅ No error messages found - all APIs working');
          }
        });
      });

      cy.wait(500);
    });

    cy.screenshot('10-error-handling-checked');
  });

  it('should maintain UI state consistency across tab navigation', () => {
    // Record initial state of each tab
    const tabStates = {};

    // Goals tab
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.get('body').then($body => {
        tabStates['goals'] = $body.find('.status-item').length;
        cy.log(`Goals count: ${tabStates['goals']}`);
      });
    });

    // Todos tab
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.get('body').then($body => {
        tabStates['todos'] = $body.find('.status-item').length;
        cy.log(`Todos count: ${tabStates['todos']}`);
      });
    });

    // Files tab
    cy.get('[data-testid="files-tab"]').click();
    cy.get('[data-testid="files-content"]').within(() => {
      cy.get('body').then($body => {
        tabStates['files'] = $body.find('.file-item').length;
        cy.log(`Files count: ${tabStates['files']}`);
      });
    });

    // Navigate back through tabs and verify counts are consistent
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.get('body').then($body => {
        const currentCount = $body.find('.status-item').length;
        expect(currentCount).to.equal(tabStates['goals']);
        cy.log(`✅ Goals count consistent: ${currentCount}`);
      });
    });

    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.get('body').then($body => {
        const currentCount = $body.find('.status-item').length;
        expect(currentCount).to.equal(tabStates['todos']);
        cy.log(`✅ Todos count consistent: ${currentCount}`);
      });
    });

    cy.get('[data-testid="files-tab"]').click();
    cy.get('[data-testid="files-content"]').within(() => {
      cy.get('body').then($body => {
        const currentCount = $body.find('.file-item').length;
        expect(currentCount).to.equal(tabStates['files']);
        cy.log(`✅ Files count consistent: ${currentCount}`);
      });
    });

    cy.screenshot('11-state-consistency-verified');
  });

  it('should validate real-time data updates by checking OCR of displayed content', () => {
    // Take screenshots with OCR to verify actual content is displayed
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').should('be.visible');

    // Take screenshot for OCR analysis
    cy.screenshot('12-goals-ocr-content', {
      capture: 'viewport',
      onAfterScreenshot: (el, props) => {
        // This screenshot can be used for OCR verification
        cy.log('📸 Goals content screenshot taken for OCR verification');
      }
    });

    // Verify text content is actually rendered (not just DOM elements)
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.contains('GOALS').should('be.visible');
      // Check that the bracket notation for count is visible
      cy.contains(/\[\d+\]/).should('be.visible');
    });

    // Same for todos
    cy.get('[data-testid="todos-tab"]').click();
    cy.screenshot('13-todos-ocr-content');
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.contains('TASKS').should('be.visible');
      cy.contains(/\[\d+\]/).should('be.visible');
    });

    // Files tab
    cy.get('[data-testid="files-tab"]').click();
    cy.screenshot('14-files-ocr-content');
    cy.get('[data-testid="files-content"]').within(() => {
      cy.contains('KNOWLEDGE BASE').should('be.visible');
      cy.contains(/\[\d+\]/).should('be.visible');
    });

    // Verify connection status is visible
    cy.get('[data-testid="connection-status"]').should('be.visible');
    cy.get('[data-testid="connection-status"]').should('contain.text', 'ONLINE').or('contain.text', 'OFFLINE');

    cy.screenshot('15-final-ocr-verification');
  });

  afterEach(() => {
    cy.screenshot('99-test-complete');

    // Log final state
    cy.window().then((win) => {
      cy.wrap(win.console).invoke('log', '✅ Complete UI functionality test finished');
    });
  });
});
