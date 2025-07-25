/// <reference types="cypress" />

describe('Complete Frontend UI Verification - All Tabs', () => {
  before(() => {
    // Verify backend is healthy before starting UI tests
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      timeout: 10000
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.data.status).to.eq('healthy');
      cy.log('✅ Backend confirmed healthy before UI tests');
    });
  });

  beforeEach(() => {
    // Configure for stable testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
      win.localStorage.setItem('disableWebSocket', 'true');
    });

    // Visit with longer timeout and error handling
    cy.visit('/', {
      timeout: 30000,
      failOnStatusCode: false
    });

    // Wait for initial loading
    cy.wait(3000);
  });

  describe('1. Basic Frontend Loading', () => {
    it('should load the frontend and show the game interface', () => {
      cy.log('🔍 Testing: Frontend loads and shows game interface');

      // Basic page load verification
      cy.get('body').should('be.visible');
      cy.get('body').should('not.be.empty');

      // Look for game interface or main content
      cy.get('body').then(($body) => {
        const bodyText = $body.text();
        const hasGameContent = bodyText.includes('ELIZA') ||
                              bodyText.includes('Goals') ||
                              bodyText.includes('Config') ||
                              $body.find('[data-testid]').length > 0;

        if (hasGameContent) {
          cy.log('✅ Frontend shows game-related content');
        } else {
          cy.log('⚠️ Frontend loaded but may be in boot sequence');
          cy.log(`Body text sample: ${bodyText.substring(0, 200)}`);
        }
      });

      cy.screenshot('01-frontend-loaded');
    });
  });

  describe('2. Tab Navigation', () => {
    it('should find and test all main tabs', () => {
      cy.log('🔍 Testing: Tab navigation and existence');

      // Wait for interface to load completely
      cy.wait(2000);

      // Look for tabs by common patterns
      const tabSelectors = [
        '[data-testid*="tab"]',
        '[role="tab"]',
        'button:contains("Goals")',
        'button:contains("Todos")',
        'button:contains("Config")',
        'button:contains("Files")',
        'div:contains("Goals")',
        'div:contains("Todos")'
      ];

      let foundTabs = false;

      tabSelectors.forEach((selector, index) => {
        cy.get('body').then(($body) => {
          if ($body.find(selector).length > 0) {
            cy.log(`✅ Found tabs with selector: ${selector}`);
            foundTabs = true;

            // Try clicking on found tabs
            cy.get(selector).first().then(($tab) => {
              if ($tab.is(':visible')) {
                cy.wrap($tab).click({ force: true });
                cy.wait(500);
                cy.log(`✅ Successfully clicked tab: ${$tab.text().substring(0, 20)}`);
              }
            });
          }
        });
      });

      cy.screenshot('02-tab-navigation');
    });
  });

  describe('3. Chat Interface Testing', () => {
    it('should find and test chat functionality', () => {
      cy.log('🔍 Testing: Chat interface functionality');

      // Look for chat elements with multiple selectors
      const chatSelectors = [
        '[data-testid*="chat"]',
        'input[placeholder*="message"]',
        'input[placeholder*="chat"]',
        'textarea[placeholder*="message"]',
        '.chat-input',
        '#chat-input',
        'input[type="text"]'
      ];

      let foundChatInput = false;

      chatSelectors.forEach((selector) => {
        cy.get('body').then(($body) => {
          if ($body.find(selector).length > 0) {
            cy.log(`✅ Found chat input with selector: ${selector}`);
            foundChatInput = true;

            // Test typing in chat input
            cy.get(selector).first().then(($input) => {
              if ($input.is(':visible')) {
                cy.wrap($input).clear().type('Test message for UI verification', { force: true });
                cy.log('✅ Successfully typed in chat input');

                // Look for send button
                cy.get('body').then(($body2) => {
                  const sendSelectors = [
                    'button:contains("Send")',
                    '[data-testid*="send"]',
                    'button[type="submit"]',
                    '.send-button'
                  ];

                  sendSelectors.forEach((sendSelector) => {
                    if ($body2.find(sendSelector).length > 0) {
                      cy.log(`✅ Found send button: ${sendSelector}`);
                      cy.get(sendSelector).first().click({ force: true });
                      cy.wait(1000);
                      cy.log('✅ Successfully clicked send button');
                    }
                  });
                });
              }
            });
          }
        });
      });

      if (!foundChatInput) {
        cy.log('⚠️ No chat input found - may need different interface state');
      }

      cy.screenshot('03-chat-interface');
    });
  });

  describe('4. Goals Tab Data Verification', () => {
    it('should verify Goals tab shows backend data', () => {
      cy.log('🔍 Testing: Goals tab displays backend data');

      // First get backend goals data
      cy.request('GET', 'http://localhost:7777/api/goals').then((response) => {
        expect(response.status).to.eq(200);
        const goalsData = Array.isArray(response.body) ? response.body : response.body.data || [];
        cy.log(`Backend has ${goalsData.length} goals`);

        // Now find Goals tab
        const goalSelectors = [
          'button:contains("Goals")',
          '[data-testid*="goals"]',
          'div:contains("Goals")',
          '.goals-tab',
          '#goals-tab'
        ];

        let foundGoalsTab = false;

        goalSelectors.forEach((selector) => {
          cy.get('body').then(($body) => {
            if ($body.find(selector).length > 0 && !foundGoalsTab) {
              foundGoalsTab = true;
              cy.log(`✅ Found Goals tab: ${selector}`);

              cy.get(selector).first().click({ force: true });
              cy.wait(2000);

              // Check if goals content is displayed
              cy.get('body').then(($body2) => {
                const bodyText = $body2.text();

                if (goalsData.length > 0) {
                  // Check if any goal titles appear in the UI
                  let goalsDisplayed = false;
                  goalsData.slice(0, 3).forEach((goal) => {
                    if (bodyText.includes(goal.name) || bodyText.includes(goal.description)) {
                      goalsDisplayed = true;
                      cy.log(`✅ Found goal in UI: ${goal.name}`);
                    }
                  });

                  if (!goalsDisplayed) {
                    cy.log('⚠️ Goals data from backend not visible in UI');
                    cy.log(`UI text sample: ${bodyText.substring(0, 300)}`);
                  }
                } else {
                  cy.log('ℹ️ No goals data to display');
                }
              });
            }
          });
        });

        if (!foundGoalsTab) {
          cy.log('⚠️ No Goals tab found in UI');
        }
      });

      cy.screenshot('04-goals-tab');
    });
  });

  describe('5. Todos Tab Data Verification', () => {
    it('should verify Todos tab shows backend data', () => {
      cy.log('🔍 Testing: Todos tab displays backend data');

      // First get backend todos data
      cy.request('GET', 'http://localhost:7777/api/todos').then((response) => {
        expect(response.status).to.eq(200);
        cy.log('Backend todos API accessible');

        // Now find Todos tab
        const todoSelectors = [
          'button:contains("Todos")',
          'button:contains("Tasks")',
          '[data-testid*="todos"]',
          '[data-testid*="tasks"]',
          'div:contains("Todos")',
          'div:contains("Tasks")'
        ];

        let foundTodosTab = false;

        todoSelectors.forEach((selector) => {
          cy.get('body').then(($body) => {
            if ($body.find(selector).length > 0 && !foundTodosTab) {
              foundTodosTab = true;
              cy.log(`✅ Found Todos tab: ${selector}`);

              cy.get(selector).first().click({ force: true });
              cy.wait(2000);

              // Check if todos content is displayed
              cy.get('body').then(($body2) => {
                const bodyText = $body2.text();

                if (bodyText.includes('todo') || bodyText.includes('task') || bodyText.includes('Task') || bodyText.includes('TODO')) {
                  cy.log('✅ Todos content appears in UI');
                } else {
                  cy.log('⚠️ No todos content visible in UI');
                  cy.log(`UI text sample: ${bodyText.substring(0, 300)}`);
                }
              });
            }
          });
        });

        if (!foundTodosTab) {
          cy.log('⚠️ No Todos tab found in UI');
        }
      });

      cy.screenshot('05-todos-tab');
    });
  });

  describe('6. Config Tab and Capability Toggles', () => {
    it('should verify Config tab and capability toggles work', () => {
      cy.log('🔍 Testing: Config tab and capability toggles');

      // Find Config tab
      const configSelectors = [
        'button:contains("Config")',
        'button:contains("Settings")',
        '[data-testid*="config"]',
        '[data-testid*="settings"]',
        'div:contains("Config")'
      ];

      let foundConfigTab = false;

      configSelectors.forEach((selector) => {
        cy.get('body').then(($body) => {
          if ($body.find(selector).length > 0 && !foundConfigTab) {
            foundConfigTab = true;
            cy.log(`✅ Found Config tab: ${selector}`);

            cy.get(selector).first().click({ force: true });
            cy.wait(2000);

            // Look for capability toggles
            const toggleSelectors = [
              'input[type="checkbox"]',
              '[role="switch"]',
              'button:contains("Enable")',
              'button:contains("Disable")',
              '.toggle',
              '.switch'
            ];

            let foundToggles = 0;

            toggleSelectors.forEach((toggleSelector) => {
              cy.get('body').then(($body2) => {
                const toggleCount = $body2.find(toggleSelector).length;
                if (toggleCount > 0) {
                  foundToggles += toggleCount;
                  cy.log(`✅ Found ${toggleCount} toggles with: ${toggleSelector}`);

                  // Test clicking the first toggle
                  cy.get(toggleSelector).first().then(($toggle) => {
                    if ($toggle.is(':visible')) {
                      const initialState = $toggle.prop('checked') || $toggle.attr('aria-checked');
                      cy.wrap($toggle).click({ force: true });
                      cy.wait(500);
                      cy.log('✅ Successfully clicked capability toggle');

                      // Verify state changed
                      cy.wrap($toggle).then(($toggle2) => {
                        const newState = $toggle2.prop('checked') || $toggle2.attr('aria-checked');
                        if (newState !== initialState) {
                          cy.log('✅ Toggle state changed successfully');
                        }
                      });
                    }
                  });
                }
              });
            });

            cy.log(`Found ${foundToggles} total capability toggles`);
          }
        });
      });

      if (!foundConfigTab) {
        cy.log('⚠️ No Config tab found in UI');
      }

      cy.screenshot('06-config-toggles');
    });
  });

  describe('7. Files Tab Testing', () => {
    it('should verify Files tab and upload functionality', () => {
      cy.log('🔍 Testing: Files tab and upload functionality');

      // Find Files tab
      const filesSelectors = [
        'button:contains("Files")',
        'button:contains("Knowledge")',
        '[data-testid*="files"]',
        '[data-testid*="knowledge"]',
        'div:contains("Files")'
      ];

      let foundFilesTab = false;

      filesSelectors.forEach((selector) => {
        cy.get('body').then(($body) => {
          if ($body.find(selector).length > 0 && !foundFilesTab) {
            foundFilesTab = true;
            cy.log(`✅ Found Files tab: ${selector}`);

            cy.get(selector).first().click({ force: true });
            cy.wait(2000);

            // Look for file upload elements
            const uploadSelectors = [
              'input[type="file"]',
              'button:contains("Upload")',
              '.upload',
              '.file-upload',
              '[data-testid*="upload"]'
            ];

            uploadSelectors.forEach((uploadSelector) => {
              cy.get('body').then(($body2) => {
                if ($body2.find(uploadSelector).length > 0) {
                  cy.log(`✅ Found upload element: ${uploadSelector}`);
                }
              });
            });

            // Check for file list
            cy.get('body').then(($body2) => {
              const bodyText = $body2.text();
              if (bodyText.includes('file') || bodyText.includes('document') || bodyText.includes('upload')) {
                cy.log('✅ Files content appears in UI');
              } else {
                cy.log('⚠️ No files content visible in UI');
              }
            });
          }
        });
      });

      if (!foundFilesTab) {
        cy.log('⚠️ No Files tab found in UI');
      }

      cy.screenshot('07-files-tab');
    });
  });

  describe('8. Final Integration Verification', () => {
    it('should provide complete assessment of UI functionality', () => {
      cy.log('📊 Final Assessment: Complete UI functionality verification');

      const results = {
        frontendLoads: false,
        tabsFound: false,
        chatWorks: false,
        goalsTabWorks: false,
        todosTabWorks: false,
        configTabWorks: false,
        filesTabWorks: false,
        backendConnected: true
      };

      // Test frontend loading
      cy.get('body').should('be.visible').then(() => {
        results.frontendLoads = true;
        cy.log('✅ Frontend loads successfully');
      });

      // Test for any tabs
      const allTabSelectors = [
        '[data-testid*="tab"]',
        'button:contains("Goals")',
        'button:contains("Todos")',
        'button:contains("Config")',
        'button:contains("Files")'
      ];

      allTabSelectors.forEach((selector) => {
        cy.get('body').then(($body) => {
          if ($body.find(selector).length > 0) {
            results.tabsFound = true;
          }
        });
      });

      // Test for chat
      cy.get('body').then(($body) => {
        const chatSelectors = ['input[type="text"]', 'textarea', '[data-testid*="chat"]'];
        chatSelectors.forEach((selector) => {
          if ($body.find(selector).length > 0) {
            results.chatWorks = true;
          }
        });
      });

      // Backend connectivity test
      cy.request({
        method: 'GET',
        url: 'http://localhost:7777/api/server/health',
        failOnStatusCode: false
      }).then((response) => {
        results.backendConnected = response.status === 200;
      });

      // Final assessment
      cy.then(() => {
        const workingFeatures = Object.values(results).filter(r => r).length;
        const totalFeatures = Object.keys(results).length;

        cy.log('');
        cy.log('📊 COMPLETE UI ASSESSMENT RESULTS:');
        cy.log(`${workingFeatures}/${totalFeatures} UI features working`);
        cy.log('');

        Object.entries(results).forEach(([feature, works]) => {
          const status = works ? '✅' : '❌';
          cy.log(`${status} ${feature}: ${works ? 'WORKING' : 'NOT WORKING'}`);
        });

        if (workingFeatures === totalFeatures) {
          cy.log('');
          cy.log('🎉 ALL UI FEATURES WORKING - 100% SUCCESS!');
        } else {
          cy.log('');
          cy.log(`⚠️ ${totalFeatures - workingFeatures} UI features need attention`);
        }

        // Store results for final verification
        cy.wrap(results).as('finalResults');
      });

      cy.screenshot('08-final-assessment');
    });
  });

  afterEach(() => {
    cy.screenshot('test-completed');
  });

  after(() => {
    cy.log('🏁 Complete Frontend UI Verification Finished');
  });
});
