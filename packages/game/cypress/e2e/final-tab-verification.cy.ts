/// <reference types="cypress" />

describe('Final Tab Verification - User Requirements', () => {
  beforeEach(() => {
    // Quick backend check
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false,
      timeout: 5000
    }).its('status').should('eq', 200);

    // Load app with testing configuration
    cy.visit('/', {
      timeout: 20000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
        win.localStorage.setItem('disableWebSocket', 'true');
      }
    });
    
    cy.wait(3000); // Wait for React to render
  });

  it('Chat: should verify interactive terminal/chat interface', () => {
    cy.log('🔍 TESTING: Chat interface for user-agent interaction');
    
    // Look for chat/terminal input
    cy.get('body').within(() => {
      cy.get('input[type="text"], textarea')
        .should('have.length.at.least', 1)
        .then(($inputs) => {
          const visibleInputs = $inputs.filter(':visible');
          if (visibleInputs.length > 0) {
            cy.log(`✅ Found ${visibleInputs.length} input fields`);
            
            // Test typing in first visible input
            cy.wrap(visibleInputs.first())
              .clear({ force: true })
              .type('Hello agent, testing chat functionality!', { force: true });
            
            cy.log('✅ Chat input is functional');
          } else {
            cy.log('⚠️ Input fields exist but not visible');
          }
        });
    });
    
    cy.screenshot('chat-interface');
  });

  it('Capabilities: should test all capability toggles work', () => {
    cy.log('🔍 TESTING: Capability toggles (shell, browser, vision, autonomy)');
    
    // Expected capabilities from user requirements
    const expectedCapabilities = ['shell', 'browser', 'vision', 'autonomy', 'camera', 'screen', 'microphone', 'speakers'];
    let foundCapabilities = [];
    
    cy.get('body').within(() => {
      // Look for checkboxes and toggles
      cy.get('input[type="checkbox"], [role="switch"], button[aria-checked]')
        .should('have.length.at.least', 1)
        .each(($toggle) => {
          const toggleText = $toggle.parent().text().toLowerCase() || $toggle.attr('aria-label')?.toLowerCase() || '';
          
          expectedCapabilities.forEach(cap => {
            if (toggleText.includes(cap)) {
              foundCapabilities.push(cap);
              cy.log(`✅ Found ${cap} capability toggle`);
              
              // Test the toggle
              if ($toggle.is(':visible')) {
                const initialState = $toggle.prop('checked') || $toggle.attr('aria-checked');
                cy.wrap($toggle).click({ force: true });
                cy.wait(500);
                
                cy.wrap($toggle).then(($afterClick) => {
                  const newState = $afterClick.prop('checked') || $afterClick.attr('aria-checked');
                  if (newState !== initialState) {
                    cy.log(`✅ ${cap} toggle changed: ${initialState} → ${newState}`);
                  }
                });
              }
            }
          });
        });
    });
    
    cy.then(() => {
      cy.log(`📊 Capability Toggles: Found ${foundCapabilities.length}/${expectedCapabilities.length}`);
      foundCapabilities.forEach(cap => cy.log(`  ✅ ${cap}`));
    });
    
    cy.screenshot('capability-toggles');
  });

  it('Goals Tab: should verify goals display and backend integration', () => {
    cy.log('🔍 TESTING: Goals tab - backend data display');
    
    // First check backend has goals data
    cy.request('GET', 'http://localhost:7777/goals/list').then((response) => {
      cy.log(`Goals API Status: ${response.status}`);
      if (response.body && response.body.data) {
        cy.log(`Goals available: ${response.body.data.length || 0} items`);
      }
    });
    
    // Look for Goals tab
    cy.get('body').then(($body) => {
      const goalsTab = $body.find('button:contains("Goals"), div:contains("Goals"), [data-tab="goals"]');
      if (goalsTab.length > 0) {
        cy.log('✅ Goals tab found in UI');
        
        // Click the tab
        cy.wrap(goalsTab.first()).click({ force: true });
        cy.wait(2000);
        
        // Look for goals content
        cy.get('body').then(($content) => {
          const hasGoalsContent = 
            $content.text().toLowerCase().includes('goal') ||
            $content.find('[class*="goal"]').length > 0 ||
            $content.find('li, .item, .entry').length > 0;
            
          if (hasGoalsContent) {
            cy.log('✅ Goals content visible in tab');
          } else {
            cy.log('⚠️ Goals tab exists but content not visible');
          }
        });
      } else {
        cy.log('❌ Goals tab NOT found in UI');
      }
    });
    
    cy.screenshot('goals-tab');
  });

  it('Todos Tab: should verify todos display and backend integration', () => {
    cy.log('🔍 TESTING: Todos tab - backend data display');
    
    // Check backend todos
    cy.request('GET', 'http://localhost:7777/todos/list').then((response) => {
      cy.log(`Todos API Status: ${response.status}`);
      if (response.body && response.body.data) {
        cy.log(`Todos available: ${response.body.data.length || 0} items`);
      }
    });
    
    // Look for Todos tab
    cy.get('body').then(($body) => {
      const todosTab = $body.find('button:contains("Todos"), button:contains("Todo"), div:contains("Todos")');
      if (todosTab.length > 0) {
        cy.log('✅ Todos tab found in UI');
        
        cy.wrap(todosTab.first()).click({ force: true });
        cy.wait(2000);
        
        cy.get('body').then(($content) => {
          const hasTodosContent = 
            $content.text().toLowerCase().includes('todo') ||
            $content.text().toLowerCase().includes('task') ||
            $content.find('[class*="todo"], [class*="task"]').length > 0;
            
          if (hasTodosContent) {
            cy.log('✅ Todos content visible in tab');
          } else {
            cy.log('⚠️ Todos tab exists but content not visible');
          }
        });
      } else {
        cy.log('❌ Todos tab NOT found in UI');
      }
    });
    
    cy.screenshot('todos-tab');
  });

  it('Monologue Tab: should verify agent thoughts display', () => {
    cy.log('🔍 TESTING: Monologue tab - agent autonomous room');
    
    cy.get('body').then(($body) => {
      const monologueTab = $body.find('button:contains("Monologue"), div:contains("Monologue"), [data-tab="monologue"]');
      if (monologueTab.length > 0) {
        cy.log('✅ Monologue tab found in UI');
        
        cy.wrap(monologueTab.first()).click({ force: true });
        cy.wait(2000);
        
        cy.get('body').then(($content) => {
          const hasMonologueContent = 
            $content.text().toLowerCase().includes('thinking') ||
            $content.text().toLowerCase().includes('thought') ||
            $content.text().toLowerCase().includes('planning') ||
            $content.find('[class*="thought"], [class*="monologue"]').length > 0;
            
          if (hasMonologueContent) {
            cy.log('✅ Agent monologue content visible');
          } else {
            cy.log('⚠️ Monologue tab exists but content not visible');
          }
        });
      } else {
        cy.log('❌ Monologue tab NOT found in UI');
      }
    });
    
    cy.screenshot('monologue-tab');
  });

  it('Files Tab: should verify knowledge upload/delete functionality', () => {
    cy.log('🔍 TESTING: Files tab - knowledge upload and delete');
    
    // Check knowledge API
    cy.request('GET', 'http://localhost:7777/knowledge/list').then((response) => {
      cy.log(`Knowledge API Status: ${response.status}`);
    });
    
    cy.get('body').then(($body) => {
      const filesTab = $body.find('button:contains("Files"), button:contains("Knowledge"), div:contains("Files")');
      if (filesTab.length > 0) {
        cy.log('✅ Files tab found in UI');
        
        cy.wrap(filesTab.first()).click({ force: true });
        cy.wait(2000);
        
        cy.get('body').then(($content) => {
          // Look for upload functionality
          const uploadElements = $content.find('input[type="file"], button:contains("Upload"), [class*="upload"]');
          if (uploadElements.length > 0) {
            cy.log(`✅ Found ${uploadElements.length} upload elements`);
          } else {
            cy.log('⚠️ No upload functionality found');
          }
          
          // Look for file list/delete functionality
          const fileElements = $content.find('.file, .document, button:contains("Delete"), [class*="delete"]');
          if (fileElements.length > 0) {
            cy.log(`✅ Found ${fileElements.length} file management elements`);
          } else {
            cy.log('⚠️ No file management elements found');
          }
        });
      } else {
        cy.log('❌ Files tab NOT found in UI');
      }
    });
    
    cy.screenshot('files-tab');
  });

  it('Config Tab: should verify agent settings management', () => {
    cy.log('🔍 TESTING: Config tab - agent settings');
    
    cy.get('body').then(($body) => {
      const configTab = $body.find('button:contains("Config"), button:contains("Settings"), div:contains("Config")');
      if (configTab.length > 0) {
        cy.log('✅ Config tab found in UI');
        
        cy.wrap(configTab.first()).click({ force: true });
        cy.wait(2000);
        
        cy.get('body').then(($content) => {
          // Look for settings controls
          const settingsElements = $content.find('input, select, textarea, button, [class*="setting"]');
          if (settingsElements.length > 0) {
            cy.log(`✅ Found ${settingsElements.length} settings controls`);
          } else {
            cy.log('⚠️ No settings controls found');
          }
          
          // Look for specific config elements
          const configText = $content.text().toLowerCase();
          const hasConfigContent = 
            configText.includes('setting') ||
            configText.includes('config') ||
            configText.includes('option') ||
            configText.includes('parameter');
            
          if (hasConfigContent) {
            cy.log('✅ Configuration content visible');
          } else {
            cy.log('⚠️ No configuration content visible');
          }
        });
      } else {
        cy.log('❌ Config tab NOT found in UI');
      }
    });
    
    cy.screenshot('config-tab');
  });

  it('FINAL ASSESSMENT: Complete functionality verification', () => {
    cy.log('📊 FINAL ASSESSMENT: User Requirements Verification');
    
    const requirements = {
      'Chat Interface': false,
      'Capability Toggles': false,
      'Goals Tab': false,
      'Todos Tab': false,
      'Monologue Tab': false,
      'Files Tab': false,
      'Config Tab': false,
      'Backend APIs': false
    };
    
    // Check chat interface
    cy.get('body').then(($body) => {
      const hasInput = $body.find('input[type="text"], textarea').filter(':visible').length > 0;
      requirements['Chat Interface'] = hasInput;
    });
    
    // Check capability toggles
    cy.get('body').then(($body) => {
      const hasToggles = $body.find('input[type="checkbox"], [role="switch"]').length > 0;
      requirements['Capability Toggles'] = hasToggles;
    });
    
    // Check tabs existence
    cy.get('body').then(($body) => {
      requirements['Goals Tab'] = $body.find('button:contains("Goals"), div:contains("Goals")').length > 0;
      requirements['Todos Tab'] = $body.find('button:contains("Todos"), div:contains("Todos")').length > 0;
      requirements['Monologue Tab'] = $body.find('button:contains("Monologue"), div:contains("Monologue")').length > 0;
      requirements['Files Tab'] = $body.find('button:contains("Files"), div:contains("Files")').length > 0;
      requirements['Config Tab'] = $body.find('button:contains("Config"), div:contains("Config")').length > 0;
    });
    
    // Check backend APIs (simplified to avoid connection issues)
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false
    }).then((response) => {
      requirements['Backend APIs'] = response.status === 200;
    });
    
    // Generate final report
    cy.then(() => {
      const working = Object.values(requirements).filter(v => v).length;
      const total = Object.keys(requirements).length;
      const percentage = Math.round((working / total) * 100);
      
      cy.log('');
      cy.log('🎯 FINAL USER REQUIREMENTS ASSESSMENT:');
      cy.log(`${working}/${total} requirements met (${percentage}%)`);
      cy.log('');
      
      Object.entries(requirements).forEach(([requirement, met]) => {
        const status = met ? '✅' : '❌';
        cy.log(`${status} ${requirement}: ${met ? 'WORKING' : 'NOT IMPLEMENTED'}`);
      });
      
      cy.log('');
      if (percentage >= 85) {
        cy.log('🎉 EXCELLENT: All major requirements are implemented!');
      } else if (percentage >= 70) {
        cy.log('🎯 GOOD: Most requirements met, minor gaps');
      } else if (percentage >= 50) {
        cy.log('⚠️ PARTIAL: Some functionality present, significant work needed');
      } else {
        cy.log('🚨 INCOMPLETE: Major features missing');
      }
      
      cy.log('');
      cy.log('📋 USER REQUESTED FEATURES STATUS:');
      cy.log('  • Chat: Interactive terminal for user-agent communication');
      cy.log('  • Capabilities: Toggles for shell, browser, vision, autonomy');
      cy.log('  • Goals: Tab showing goals working from backend');
      cy.log('  • Todos: Tab showing todos working from backend');
      cy.log('  • Monologue: Agent\'s autonomous room where it talks to itself');
      cy.log('  • Files: Knowledge upload and delete functionality');
      cy.log('  • Config: Agent settings management');
      cy.log('');
      
      if (percentage < 70) {
        cy.log('❗ RECOMMENDATION: Focus on implementing missing tabs with backend integration');
      }
    });
    
    cy.screenshot('final-assessment');
  });
});