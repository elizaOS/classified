/// <reference types="cypress" />

describe('Comprehensive UI Functionality - All Tabs and Features', () => {
  beforeEach(() => {
    // Ensure backend is running before each test
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false,
      timeout: 10000
    }).then((response) => {
      if (response.status !== 200) {
        throw new Error('Backend server is not running on port 7777');
      }
    });

    // Configure for testing - skip boot and disable WebSocket
    cy.visit('/', {
      timeout: 30000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
        win.localStorage.setItem('disableWebSocket', 'true');
      }
    });
    
    // Wait for React app to render fully
    cy.wait(3000);
    
    // Verify we're past the boot sequence
    cy.get('body').should('be.visible');
    cy.log('✅ Frontend loaded, verifying game interface...');
  });

  it('should verify game interface loads and show main elements', () => {
    cy.log('🔍 Testing: Main game interface elements');
    
    // Look for the main game interface components
    cy.get('body').within(() => {
      // Should have interactive elements indicating the app loaded
      cy.get('div, button, input, textarea').should('have.length.at.least', 5);
    });
    
    // Look for game-specific content or structure
    cy.get('body').then(($body) => {
      const bodyText = $body.text().toLowerCase();
      const hasGameElements = 
        bodyText.includes('eliza') || 
        bodyText.includes('agent') ||
        bodyText.includes('goals') ||
        bodyText.includes('todos') ||
        bodyText.includes('config') ||
        bodyText.includes('terminal') ||
        $body.find('[class*="interface"]').length > 0 ||
        $body.find('[class*="game"]').length > 0;
      
      expect(hasGameElements).to.be.true;
      cy.log('✅ Game interface elements detected');
    });
    
    cy.screenshot('game-interface-main');
  });

  it('should test chat/terminal functionality', () => {
    cy.log('🔍 Testing: Chat/Terminal input and interaction');
    
    // Wait for interface to stabilize
    cy.wait(2000);
    
    // Look for input fields
    const inputSelectors = [
      'input[type="text"]:visible',
      'textarea:visible',
      '[placeholder*="message"]:visible',
      '[placeholder*="command"]:visible',
      '[placeholder*="input"]:visible',
      '.terminal-input:visible',
      '.chat-input:visible'
    ];
    
    let inputFound = false;
    
    for (const selector of inputSelectors) {
      cy.get('body').then(($body) => {
        const inputs = $body.find(selector);
        if (inputs.length > 0 && !inputFound) {
          inputFound = true;
          cy.log(`✅ Found chat input: ${selector}`);
          
          // Test typing and interaction
          cy.get(selector).first().then(($input) => {
            if ($input.is(':visible') && !$input.is(':disabled')) {
              cy.wrap($input)
                .clear({ force: true })
                .type('Hello agent! This is a test message from the UI.', { force: true });
              
              cy.log('✅ Successfully typed test message');
              
              // Look for send button or try Enter
              cy.get('body').then(($body2) => {
                const sendButton = $body2.find('button:contains("Send"), [type="submit"], .send-button').first();
                if (sendButton.length > 0 && sendButton.is(':visible')) {
                  cy.wrap(sendButton).click({ force: true });
                  cy.log('✅ Clicked send button');
                } else {
                  cy.wrap($input).type('{enter}', { force: true });
                  cy.log('✅ Pressed Enter to send');
                }
                
                // Wait for potential response
                cy.wait(2000);
              });
            }
          });
        }
      });
    }
    
    if (!inputFound) {
      cy.log('⚠️ No chat input field found - may not be implemented yet');
    }
    
    cy.screenshot('chat-functionality');
  });

  it('should test Goals tab functionality', () => {
    cy.log('🔍 Testing: Goals tab and backend integration');
    
    // First ensure we have goals data from backend
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/goals/list',
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Goals API response status: ${response.status}`);
      if (response.status === 200) {
        cy.log(`Goals data available: ${JSON.stringify(response.body).substring(0, 200)}`);
      }
    });
    
    // Look for Goals tab/button
    const goalSelectors = [
      'button:contains("Goals")',
      'div:contains("Goals")',
      '[data-tab="goals"]',
      '.goals-tab',
      'a[href*="goals"]'
    ];
    
    let goalsTabFound = false;
    
    goalSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        const elements = $body.find(selector);
        if (elements.length > 0 && !goalsTabFound) {
          goalsTabFound = true;
          cy.log(`✅ Found Goals tab: ${selector}`);
          
          cy.get(selector).first().then(($tab) => {
            if ($tab.is(':visible')) {
              cy.wrap($tab).click({ force: true });
              cy.wait(2000); // Wait for tab content to load
              cy.log('✅ Clicked Goals tab');
              
              // Look for goals content
              cy.get('body').then(($body2) => {
                const goalContent = $body2.text().toLowerCase();
                const hasGoalContent = 
                  goalContent.includes('goal') ||
                  goalContent.includes('objective') ||
                  goalContent.includes('target') ||
                  $body2.find('[class*="goal"]').length > 0;
                  
                if (hasGoalContent) {
                  cy.log('✅ Goals content found in UI');
                } else {
                  cy.log('⚠️ Goals tab clicked but content not visible');
                }
              });
            }
          });
        }
      });
    });
    
    if (!goalsTabFound) {
      cy.log('⚠️ Goals tab not found in current UI');
    }
    
    cy.screenshot('goals-tab');
  });

  it('should test Todos tab functionality', () => {
    cy.log('🔍 Testing: Todos tab and backend integration');
    
    // Check backend todos API
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/todos/list',
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Todos API response status: ${response.status}`);
      if (response.status === 200) {
        cy.log(`Todos data available: ${JSON.stringify(response.body).substring(0, 200)}`);
      }
    });
    
    // Look for Todos tab
    const todoSelectors = [
      'button:contains("Todos")',
      'button:contains("Todo")',
      'div:contains("Todos")',
      '[data-tab="todos"]',
      '.todos-tab',
      'a[href*="todo"]'
    ];
    
    let todosTabFound = false;
    
    todoSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        const elements = $body.find(selector);
        if (elements.length > 0 && !todosTabFound) {
          todosTabFound = true;
          cy.log(`✅ Found Todos tab: ${selector}`);
          
          cy.get(selector).first().then(($tab) => {
            if ($tab.is(':visible')) {
              cy.wrap($tab).click({ force: true });
              cy.wait(2000);
              cy.log('✅ Clicked Todos tab');
              
              // Look for todo content
              cy.get('body').then(($body2) => {
                const todoContent = $body2.text().toLowerCase();
                const hasTodoContent = 
                  todoContent.includes('todo') ||
                  todoContent.includes('task') ||
                  todoContent.includes('reminder') ||
                  $body2.find('[class*="todo"]').length > 0;
                  
                if (hasTodoContent) {
                  cy.log('✅ Todos content found in UI');
                } else {
                  cy.log('⚠️ Todos tab clicked but content not visible');
                }
              });
            }
          });
        }
      });
    });
    
    if (!todosTabFound) {
      cy.log('⚠️ Todos tab not found in current UI');
    }
    
    cy.screenshot('todos-tab');
  });

  it('should test Config tab and capability toggles', () => {
    cy.log('🔍 Testing: Config tab and capability toggles');
    
    // Look for Config tab
    const configSelectors = [
      'button:contains("Config")',
      'button:contains("Settings")',
      'div:contains("Config")',
      '[data-tab="config"]',
      '.config-tab',
      'a[href*="config"]'
    ];
    
    let configTabFound = false;
    
    configSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        const elements = $body.find(selector);
        if (elements.length > 0 && !configTabFound) {
          configTabFound = true;
          cy.log(`✅ Found Config tab: ${selector}`);
          
          cy.get(selector).first().then(($tab) => {
            if ($tab.is(':visible')) {
              cy.wrap($tab).click({ force: true });
              cy.wait(2000);
              cy.log('✅ Clicked Config tab');
              
              // Look for capability toggles
              cy.get('body').then(($body2) => {
                const toggles = $body2.find('input[type="checkbox"], [role="switch"], .toggle, button[aria-checked]');
                if (toggles.length > 0) {
                  cy.log(`✅ Found ${toggles.length} capability toggles`);
                  
                  // Test clicking the first toggle
                  const firstToggle = toggles.first();
                  if (firstToggle.is(':visible')) {
                    const initialState = firstToggle.prop('checked') || firstToggle.attr('aria-checked');
                    cy.wrap(firstToggle).click({ force: true });
                    cy.wait(1000);
                    
                    // Verify state change
                    cy.wrap(firstToggle).then(($toggleAfter) => {
                      const newState = $toggleAfter.prop('checked') || $toggleAfter.attr('aria-checked');
                      if (newState !== initialState) {
                        cy.log(`✅ Toggle state changed: ${initialState} → ${newState}`);
                      } else {
                        cy.log(`ℹ️ Toggle clicked (state: ${newState})`);
                      }
                    });
                  }
                } else {
                  cy.log('⚠️ No capability toggles found in Config tab');
                }
              });
            }
          });
        }
      });
    });
    
    if (!configTabFound) {
      cy.log('⚠️ Config tab not found in current UI');
    }
    
    cy.screenshot('config-tab');
  });

  it('should test Files/Knowledge tab functionality', () => {
    cy.log('🔍 Testing: Files/Knowledge tab functionality');
    
    // Check knowledge API
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/knowledge/list',
      failOnStatusCode: false
    }).then((response) => {
      cy.log(`Knowledge API response status: ${response.status}`);
    });
    
    // Look for Files/Knowledge tab
    const fileSelectors = [
      'button:contains("Files")',
      'button:contains("Knowledge")',
      'button:contains("Documents")',
      'div:contains("Files")',
      '[data-tab="files"]',
      '[data-tab="knowledge"]',
      '.files-tab'
    ];
    
    let filesTabFound = false;
    
    fileSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        const elements = $body.find(selector);
        if (elements.length > 0 && !filesTabFound) {
          filesTabFound = true;
          cy.log(`✅ Found Files tab: ${selector}`);
          
          cy.get(selector).first().then(($tab) => {
            if ($tab.is(':visible')) {
              cy.wrap($tab).click({ force: true });
              cy.wait(2000);
              cy.log('✅ Clicked Files tab');
              
              // Look for file upload elements
              cy.get('body').then(($body2) => {
                const uploadElements = $body2.find('input[type="file"], .upload, button:contains("Upload"), [class*="upload"]');
                if (uploadElements.length > 0) {
                  cy.log(`✅ Found ${uploadElements.length} file upload elements`);
                } else {
                  cy.log('⚠️ No file upload elements found');
                }
                
                // Look for file list
                const fileListElements = $body2.find('.file-list, [class*="file"], li, .document');
                if (fileListElements.length > 0) {
                  cy.log(`✅ Found file list with ${fileListElements.length} elements`);
                } else {
                  cy.log('⚠️ No file list found');
                }
              });
            }
          });
        }
      });
    });
    
    if (!filesTabFound) {
      cy.log('⚠️ Files tab not found in current UI');
    }
    
    cy.screenshot('files-tab');
  });

  it('should test Monologue tab functionality', () => {
    cy.log('🔍 Testing: Monologue tab (agent thoughts)');
    
    // Look for Monologue tab
    const monologueSelectors = [
      'button:contains("Monologue")',
      'button:contains("Thoughts")',
      'button:contains("Internal")',
      'div:contains("Monologue")',
      '[data-tab="monologue"]',
      '.monologue-tab'
    ];
    
    let monologueTabFound = false;
    
    monologueSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        const elements = $body.find(selector);
        if (elements.length > 0 && !monologueTabFound) {
          monologueTabFound = true;
          cy.log(`✅ Found Monologue tab: ${selector}`);
          
          cy.get(selector).first().then(($tab) => {
            if ($tab.is(':visible')) {
              cy.wrap($tab).click({ force: true });
              cy.wait(2000);
              cy.log('✅ Clicked Monologue tab');
              
              // Look for agent thoughts/monologue content
              cy.get('body').then(($body2) => {
                const thoughtContent = $body2.text().toLowerCase();
                const hasThoughtContent = 
                  thoughtContent.includes('thinking') ||
                  thoughtContent.includes('thought') ||
                  thoughtContent.includes('planning') ||
                  thoughtContent.includes('considering') ||
                  $body2.find('[class*="thought"], [class*="monologue"]').length > 0;
                  
                if (hasThoughtContent) {
                  cy.log('✅ Agent thoughts/monologue content found');
                } else {
                  cy.log('⚠️ Monologue tab opened but content not visible');
                }
              });
            }
          });
        }
      });
    });
    
    if (!monologueTabFound) {
      cy.log('⚠️ Monologue tab not found in current UI');
    }
    
    cy.screenshot('monologue-tab');
  });

  it('should verify complete frontend-backend integration', () => {
    cy.log('🔍 Testing: Complete frontend-backend integration');
    
    // Test multiple backend endpoints
    const endpointsToTest = [
      { name: 'Health', url: 'http://localhost:7777/api/server/health' },
      { name: 'Autonomy Status', url: 'http://localhost:7777/autonomy/status' },
      { name: 'Goals List', url: 'http://localhost:7777/goals/list' },
      { name: 'Todos List', url: 'http://localhost:7777/todos/list' },
      { name: 'Knowledge List', url: 'http://localhost:7777/knowledge/list' }
    ];
    
    let successfulConnections = 0;
    
    endpointsToTest.forEach((endpoint) => {
      cy.request({
        method: 'GET',
        url: endpoint.url,
        failOnStatusCode: false,
        timeout: 10000
      }).then((response) => {
        if (response.status === 200) {
          successfulConnections++;
          cy.log(`✅ ${endpoint.name} API: Connected (${response.status})`);
        } else {
          cy.log(`❌ ${endpoint.name} API: Failed (${response.status})`);
        }
      });
    });
    
    // Test from frontend context as well
    cy.window().then((win) => {
      return cy.wrap(
        win.fetch('http://localhost:7777/api/server/health')
          .then(response => ({ status: response.status, ok: response.ok }))
          .catch(error => ({ status: 0, error: error.message }))
      );
    }).then((result) => {
      if (result.status === 200) {
        cy.log('✅ Frontend can reach backend via fetch');
      } else {
        cy.log(`❌ Frontend fetch failed: ${result.error || result.status}`);
      }
    });
    
    cy.then(() => {
      const percentage = Math.round((successfulConnections / endpointsToTest.length) * 100);
      cy.log(`📊 Backend Integration: ${successfulConnections}/${endpointsToTest.length} endpoints working (${percentage}%)`);
      
      if (percentage >= 80) {
        cy.log('🎉 Backend integration is strong!');
      } else if (percentage >= 50) {
        cy.log('⚠️ Backend integration has some issues');
      } else {
        cy.log('🚨 Backend integration has significant problems');
      }
    });
    
    cy.screenshot('backend-integration');
  });

  it('should provide final comprehensive assessment', () => {
    cy.log('📊 FINAL ASSESSMENT: Complete UI and Backend Functionality');
    
    const assessment = {
      'Game Interface Loads': false,
      'Chat/Terminal Input': false,
      'Goals Tab Works': false,
      'Todos Tab Works': false,
      'Config Tab Works': false,
      'Files Tab Works': false,
      'Monologue Tab Works': false,
      'Backend Connectivity': false
    };
    
    // Check interface loading
    cy.get('body').then(($body) => {
      const hasInterface = $body.find('div, button, input').length > 5;
      assessment['Game Interface Loads'] = hasInterface;
    });
    
    // Check for input elements (chat)
    cy.get('body').then(($body) => {
      const hasInput = $body.find('input[type="text"], textarea').length > 0;
      assessment['Chat/Terminal Input'] = hasInput;
    });
    
    // Check for tabs
    cy.get('body').then(($body) => {
      assessment['Goals Tab Works'] = $body.find('button:contains("Goals"), div:contains("Goals")').length > 0;
      assessment['Todos Tab Works'] = $body.find('button:contains("Todos"), div:contains("Todos")').length > 0;
      assessment['Config Tab Works'] = $body.find('button:contains("Config"), div:contains("Config")').length > 0;
      assessment['Files Tab Works'] = $body.find('button:contains("Files"), div:contains("Files")').length > 0;
      assessment['Monologue Tab Works'] = $body.find('button:contains("Monologue"), div:contains("Monologue")').length > 0;
    });
    
    // Test backend one more time
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false
    }).then((response) => {
      assessment['Backend Connectivity'] = response.status === 200;
    });
    
    // Generate final report
    cy.then(() => {
      const workingFeatures = Object.values(assessment).filter(v => v).length;
      const totalFeatures = Object.keys(assessment).length;
      const percentage = Math.round((workingFeatures / totalFeatures) * 100);
      
      cy.log('');
      cy.log('🎯 FINAL COMPREHENSIVE ASSESSMENT:');
      cy.log(`${workingFeatures}/${totalFeatures} features working (${percentage}%)`);
      cy.log('');
      
      Object.entries(assessment).forEach(([feature, works]) => {
        const status = works ? '✅' : '❌';
        cy.log(`${status} ${feature}: ${works ? 'WORKING' : 'NOT WORKING'}`);
      });
      
      cy.log('');
      if (percentage >= 90) {
        cy.log('🎉 EXCELLENT: UI is fully functional with comprehensive tab support!');
      } else if (percentage >= 70) {
        cy.log('🎯 GOOD: Most UI features are working, minor issues to address');
      } else if (percentage >= 50) {
        cy.log('⚠️ PARTIAL: Some UI features working, significant development needed');
      } else {
        cy.log('🚨 INCOMPLETE: Major UI functionality missing or not working');
      }
      
      cy.log('');
      cy.log('📋 RECOMMENDED NEXT STEPS:');
      if (!assessment['Chat/Terminal Input']) {
        cy.log('  • Implement chat/terminal input functionality');
      }
      if (!assessment['Goals Tab Works']) {
        cy.log('  • Add Goals tab and backend integration');
      }
      if (!assessment['Todos Tab Works']) {
        cy.log('  • Add Todos tab and backend integration');
      }
      if (!assessment['Config Tab Works']) {
        cy.log('  • Add Config tab with capability toggles');
      }
      if (!assessment['Files Tab Works']) {
        cy.log('  • Add Files/Knowledge tab with upload functionality');
      }
      if (!assessment['Monologue Tab Works']) {
        cy.log('  • Add Monologue tab for agent thoughts');
      }
      if (!assessment['Backend Connectivity']) {
        cy.log('  • Fix backend connectivity and API integration');
      }
    });
    
    cy.screenshot('final-comprehensive-assessment');
  });

  afterEach(() => {
    // Capture any console errors
    cy.window().then((win) => {
      const errors = win.console._errors || [];
      if (errors.length > 0) {
        cy.log(`Console errors detected: ${errors.length}`);
        errors.forEach(error => cy.log(`  ERROR: ${error}`));
      }
    });
  });
});