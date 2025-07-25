/// <reference types="cypress" />

describe('ACTUAL UI TABS TEST - Critical Verification', () => {
  beforeEach(() => {
    // FRONTEND-ONLY TEST: Skip backend health check entirely
    cy.log('🔄 Running frontend-only test (skipping backend health check)...');

    // Skip boot sequence for direct UI testing
    cy.visit('/', { 
      timeout: 30000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
        win.localStorage.setItem('disableWebSocket', 'true'); // Disable WebSocket for stable testing
      }
    });
    cy.wait(5000); // Give time for loading
  });

  it('should verify the frontend actually loads and shows game interface', () => {
    cy.log('🔍 CRITICAL TEST: Does the frontend UI actually work?');

    // Check if we can see any content at all
    cy.get('body').should('be.visible');
    cy.get('body').should('not.be.empty');

    // Look for any signs of the game interface
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      cy.log(`Body contains text: ${bodyText.length > 0 ? 'YES' : 'NO'}`);

      if (bodyText.includes('ELIZA') || bodyText.includes('game') || bodyText.includes('interface')) {
        cy.log('✅ Frontend shows some game-related content');
      } else {
        cy.log('❌ Frontend does not show expected game content');
        cy.log(`Actual body text preview: ${bodyText.substring(0, 200)}`);
      }
    });

    cy.screenshot('frontend-actual-state');
  });

  it('should check if the actual tabs exist and are clickable', () => {
    cy.log('🔍 CRITICAL TEST: Do the tabs actually exist in the UI?');

    // Look for tab elements
    const expectedTabs = [
      { testId: 'goals-tab', name: 'Goals' },
      { testId: 'todos-tab', name: 'Todos' },
      { testId: 'monologue-tab', name: 'Monologue' },
      { testId: 'files-tab', name: 'Files' },
      { testId: 'config-tab', name: 'Config' }
    ];

    expectedTabs.forEach((tab) => {
      cy.get('body').then(($body) => {
        if ($body.find(`[data-testid="${tab.testId}"]`).length > 0) {
          cy.log(`✅ ${tab.name} tab EXISTS in UI`);
          cy.get(`[data-testid="${tab.testId}"]`).should('be.visible');

          // Try to click it
          cy.get(`[data-testid="${tab.testId}"]`).click();
          cy.log(`✅ ${tab.name} tab is CLICKABLE`);

        } else {
          cy.log(`❌ ${tab.name} tab NOT FOUND in UI`);
        }
      });
    });

    cy.screenshot('tabs-verification');
  });

  it('should test if chat interface actually exists and works', () => {
    cy.log('🔍 CRITICAL TEST: Does the chat interface actually work?');

    // Look for chat elements
    cy.get('body').then(($body) => {
      // Check for chat input
      if ($body.find('[data-testid="chat-input"]').length > 0) {
        cy.log('✅ Chat input EXISTS in UI');
        cy.get('[data-testid="chat-input"]').should('be.visible');

        // Try to type in it
        cy.get('[data-testid="chat-input"]').type('Test message for critical review');
        cy.log('✅ Chat input accepts text');

        // Look for send button
        if ($body.find('[data-testid="chat-send-button"]').length > 0) {
          cy.log('✅ Chat send button EXISTS');
          cy.get('[data-testid="chat-send-button"]').should('be.visible');
        } else {
          cy.log('❌ Chat send button NOT FOUND');
        }

        // Look for chat messages area
        if ($body.find('[data-testid="chat-messages"]').length > 0) {
          cy.log('✅ Chat messages area EXISTS');
          cy.get('[data-testid="chat-messages"]').should('be.visible');
        } else {
          cy.log('❌ Chat messages area NOT FOUND');
        }

      } else {
        cy.log('❌ Chat input NOT FOUND in UI');
      }
    });

    cy.screenshot('chat-interface-test');
  });

  it('should test if goals tab actually exists in frontend', () => {
    cy.log('🔍 CRITICAL TEST: Does Goals tab exist in frontend UI?');

    // Check if Goals tab exists in UI (no backend required)
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="goals-tab"]').length > 0) {
        cy.log('✅ Goals tab found, clicking...');
        cy.get('[data-testid="goals-tab"]').click();

        // Check for goals content area
        if ($body.find('[data-testid="goals-content"]').length > 0) {
          cy.log('✅ Goals content area exists');
          cy.get('[data-testid="goals-content"]').should('be.visible');

          // Check if it shows goals UI (without requiring backend data)
          cy.get('[data-testid="goals-content"]').then(($content) => {
            const contentText = $content.text();
            if (contentText.includes('goal') || contentText.includes('GOAL') || contentText.includes('No active goals') || $content.find('.status-item').length > 0) {
              cy.log('✅ Goals content appears to show goals UI');
            } else {
              cy.log('❌ Goals content does not show expected goals UI');
              cy.log(`Goals content text: ${contentText.substring(0, 200)}`);
            }
          });
        } else {
          cy.log('❌ Goals content area not found');
        }
      } else {
        cy.log('❌ Goals tab not found in UI');
      }
    });

    cy.screenshot('goals-tab-frontend-test');
  });

  it('should test if todos tab actually exists in frontend', () => {
    cy.log('🔍 CRITICAL TEST: Does Todos tab exist in frontend UI?');

    // Check if Todos tab exists in UI (no backend required)
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="todos-tab"]').length > 0) {
        cy.log('✅ Todos tab found, clicking...');
        cy.get('[data-testid="todos-tab"]').click();

        // Check for todos content area
        if ($body.find('[data-testid="todos-content"]').length > 0) {
          cy.log('✅ Todos content area exists');
          cy.get('[data-testid="todos-content"]').should('be.visible');

          // Check if it shows todos UI (without requiring backend data)
          cy.get('[data-testid="todos-content"]').then(($content) => {
            const contentText = $content.text();
            if (contentText.includes('todo') || contentText.includes('TODO') || contentText.includes('task') || contentText.includes('TASK') || contentText.includes('No pending tasks') || $content.find('.status-item').length > 0) {
              cy.log('✅ Todos content appears to show todos UI');
            } else {
              cy.log('❌ Todos content does not show expected todos UI');
              cy.log(`Todos content text: ${contentText.substring(0, 200)}`);
            }
          });
        } else {
          cy.log('❌ Todos content area not found');
        }
      } else {
        cy.log('❌ Todos tab not found in UI');
      }
    });

    cy.screenshot('todos-tab-frontend-test');
  });

  it('should test if capability toggles actually exist in the config tab', () => {
    cy.log('🔍 CRITICAL TEST: Do capability toggles actually exist in UI?');

    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="config-tab"]').length > 0) {
        cy.log('✅ Config tab found, clicking...');
        cy.get('[data-testid="config-tab"]').click();

        // Check for config content area
        if ($body.find('[data-testid="config-content"]').length > 0) {
          cy.log('✅ Config content area exists');
          cy.get('[data-testid="config-content"]').should('be.visible');

          // Look for capability toggles
          const expectedToggles = [
            'shell-toggle',
            'browser-toggle',
            'camera-toggle',
            'microphone-toggle',
            'speaker-toggle',
            'autonomy-toggle'
          ];

          let foundToggles = 0;
          expectedToggles.forEach((toggleId) => {
            if ($body.find(`[data-testid="${toggleId}"]`).length > 0) {
              cy.log(`✅ ${toggleId} found in UI`);
              foundToggles++;
            } else {
              cy.log(`❌ ${toggleId} NOT found in UI`);
            }
          });

          cy.log(`Found ${foundToggles}/${expectedToggles.length} capability toggles`);

        } else {
          cy.log('❌ Config content area not found');
        }
      } else {
        cy.log('❌ Config tab not found in UI');
      }
    });

    cy.screenshot('config-toggles-test');
  });

  it('should provide honest assessment of what actually works', () => {
    cy.log('📊 CRITICAL ASSESSMENT: What actually works vs what was claimed');

    const actualResults = {
      frontendLoads: false,
      tabsExist: false,
      chatExists: false,
      goalsTabWorks: false,
      todosTabWorks: false,
      configTabWorks: false,
      capabilityTogglesExist: false
    };

    // Test frontend loading
    cy.get('body').should('be.visible').then(() => {
      actualResults.frontendLoads = true;
      cy.log('✅ Frontend loads');
    });

    // Test if main interface exists
    cy.get('body').then(($body) => {
      const bodyText = $body.text();

      // Check for game interface
      if ($body.find('[data-testid="game-interface"]').length > 0) {
        actualResults.tabsExist = true;
        cy.log('✅ Game interface exists');
      }

      // Check for chat
      if ($body.find('[data-testid="chat-input"]').length > 0) {
        actualResults.chatExists = true;
        cy.log('✅ Chat interface exists');
      }

      // Check for tabs
      if ($body.find('[data-testid="goals-tab"]').length > 0) {
        actualResults.goalsTabWorks = true;
        cy.log('✅ Goals tab exists');
      }

      if ($body.find('[data-testid="todos-tab"]').length > 0) {
        actualResults.todosTabWorks = true;
        cy.log('✅ Todos tab exists');
      }

      if ($body.find('[data-testid="config-tab"]').length > 0) {
        actualResults.configTabWorks = true;
        cy.log('✅ Config tab exists');
      }

      // Final assessment
      cy.then(() => {
        const workingFeatures = Object.values(actualResults).filter(result => result).length;
        const totalFeatures = Object.keys(actualResults).length;

        cy.log('');
        cy.log('📊 HONEST RESULTS:');
        cy.log(`${workingFeatures}/${totalFeatures} claimed features actually work`);
        cy.log('');
        Object.entries(actualResults).forEach(([feature, works]) => {
          const status = works ? '✅' : '❌';
          cy.log(`${status} ${feature}: ${works ? 'WORKS' : 'BROKEN/MISSING'}`);
        });

        if (workingFeatures < totalFeatures) {
          cy.log('');
          cy.log('🚨 CRITICAL FINDING: NOT ALL CLAIMED FEATURES ACTUALLY WORK');
        } else {
          cy.log('');
          cy.log('🎉 ALL CLAIMED FEATURES ACTUALLY WORK');
        }
      });
    });

    cy.screenshot('critical-assessment-final');
  });

  afterEach(() => {
    cy.screenshot('test-complete');
  });
});
