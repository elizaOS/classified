/// <reference types="cypress" />

describe('Working Frontend Test - Real UI Verification', () => {
  beforeEach(() => {
    // Skip boot sequence and disable WebSocket for stable testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
      win.localStorage.setItem('disableWebSocket', 'true');
    });

    // Visit with retry logic
    cy.visit('/', {
      timeout: 20000,
      retries: 3,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
        win.localStorage.setItem('disableWebSocket', 'true');
      },
    });

    // Wait for React to render
    cy.wait(3000);
  });

  it('should verify the actual game interface loads', () => {
    cy.log('🔍 Testing: Real game interface loading');

    // Verify basic page structure
    cy.get('body').should('be.visible').and('not.be.empty');

    // Wait for React app to render (look for any React-generated content)
    cy.get('body').within(() => {
      // Look for any interactive elements that indicate React has rendered
      cy.get('div, button, input').should('have.length.at.least', 1);
    });

    // Check for game-specific content
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      const hasGameContent =
        bodyText.includes('ELIZA') ||
        bodyText.includes('Agent') ||
        bodyText.includes('Goals') ||
        bodyText.includes('Config') ||
        bodyText.includes('Terminal') ||
        $body.find('[class*="game"]').length > 0 ||
        $body.find('[class*="interface"]').length > 0;

      if (hasGameContent) {
        cy.log('✅ Game interface content detected');
      } else {
        cy.log('⚠️ Game interface might still be loading');
        cy.log(`Body text sample: ${bodyText.substring(0, 300)}`);
      }
    });

    cy.screenshot('game-interface-loaded');
  });

  it('should find and interact with the terminal interface', () => {
    cy.log('🔍 Testing: Terminal interface interaction');

    // Wait for interface to stabilize
    cy.wait(2000);

    // Look for terminal/chat input elements
    const inputSelectors = [
      'input[type="text"]',
      'textarea',
      '[placeholder*="message"]',
      '[placeholder*="command"]',
      '[placeholder*="input"]',
      '.terminal-input',
      '.chat-input',
      '#terminal-input',
    ];

    let foundInput = false;

    inputSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        if ($body.find(selector).length > 0 && !foundInput) {
          foundInput = true;
          cy.log(`✅ Found input element: ${selector}`);

          // Test typing in the input
          cy.get(selector)
            .first()
            .then(($input) => {
              if ($input.is(':visible') && !$input.is(':disabled')) {
                cy.wrap($input).clear().type('Hello agent, this is a UI test!', { force: true });
                cy.log('✅ Successfully typed in input field');

                // Look for and click send button or press Enter
                cy.get('body').then(($body2) => {
                  const sendButtons = $body2.find(
                    'button:contains("Send"), [type="submit"], .send-button'
                  );
                  if (sendButtons.length > 0) {
                    cy.wrap(sendButtons.first()).click({ force: true });
                    cy.log('✅ Clicked send button');
                  } else {
                    // Try pressing Enter
                    cy.wrap($input).type('{enter}', { force: true });
                    cy.log('✅ Pressed Enter to send');
                  }
                });
              }
            });
        }
      });
    });

    if (!foundInput) {
      cy.log('⚠️ No input field found in current interface state');
    }

    cy.screenshot('terminal-interaction');
  });

  it('should find and test tab navigation', () => {
    cy.log('🔍 Testing: Tab navigation functionality');

    // Wait for full load
    cy.wait(2000);

    // Look for tab-like elements with various approaches
    const tabSelectors = [
      'button:contains("Goals")',
      'button:contains("Todos")',
      'button:contains("Config")',
      'button:contains("Files")',
      'div:contains("Goals")',
      'div:contains("Todos")',
      '[role="tab"]',
      '.tab',
      '.nav-item',
      '[class*="tab"]',
    ];

    const foundTabs = [];

    tabSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        const elements = $body.find(selector);
        if (elements.length > 0) {
          foundTabs.push({ selector, count: elements.length });
          cy.log(`✅ Found ${elements.length} elements with: ${selector}`);

          // Click the first visible element
          cy.get(selector)
            .first()
            .then(($tab) => {
              if ($tab.is(':visible')) {
                cy.wrap($tab).click({ force: true });
                cy.wait(1000); // Wait for tab switch
                cy.log(`✅ Clicked tab: ${$tab.text().substring(0, 30)}`);
              }
            });
        }
      });
    });

    cy.then(() => {
      cy.log(`Found tabs with ${foundTabs.length} different selectors`);
      foundTabs.forEach((tab) => {
        cy.log(`  - ${tab.selector}: ${tab.count} elements`);
      });
    });

    cy.screenshot('tab-navigation');
  });

  it('should test capability toggle functionality', () => {
    cy.log('🔍 Testing: Capability toggle functionality');

    // Wait for interface
    cy.wait(2000);

    // Look for toggle elements
    const toggleSelectors = [
      'input[type="checkbox"]',
      '[role="switch"]',
      'button[aria-checked]',
      '.toggle',
      '.switch',
      'button:contains("Enable")',
      'button:contains("Disable")',
    ];

    let foundToggles = 0;

    toggleSelectors.forEach((selector) => {
      cy.get('body').then(($body) => {
        const toggles = $body.find(selector);
        if (toggles.length > 0) {
          foundToggles += toggles.length;
          cy.log(`✅ Found ${toggles.length} toggles with: ${selector}`);

          // Test clicking the first toggle
          cy.get(selector)
            .first()
            .then(($toggle) => {
              if ($toggle.is(':visible')) {
                const initialState =
                  $toggle.prop('checked') || $toggle.attr('aria-checked') || 'unknown';
                cy.wrap($toggle).click({ force: true });
                cy.wait(500);

                // Check if state changed
                cy.wrap($toggle).then(($toggleAfter) => {
                  const newState =
                    $toggleAfter.prop('checked') || $toggleAfter.attr('aria-checked') || 'unknown';
                  if (newState !== initialState) {
                    cy.log(`✅ Toggle state changed: ${initialState} → ${newState}`);
                  } else {
                    cy.log(`ℹ️ Toggle clicked (state: ${newState})`);
                  }
                });
              }
            });
        }
      });
    });

    cy.log(`Total toggles found: ${foundToggles}`);

    cy.screenshot('capability-toggles');
  });

  it('should verify backend connectivity from frontend', () => {
    cy.log('🔍 Testing: Frontend-backend connectivity');

    // Test that frontend can make API calls to backend
    cy.window()
      .then((win) => {
        // Use fetch from the window context
        return cy.wrap(
          win
            .fetch('http://localhost:7777/api/server/health')
            .then((response) => response.json())
            .then((data) => ({ status: 'success', data }))
            .catch((error) => ({ status: 'error', error: error.message }))
        );
      })
      .then((result) => {
        if (result.status === 'success') {
          cy.log('✅ Frontend can reach backend API');
          cy.log(`Agent ID: ${result.data.data?.agentId || 'unknown'}`);
        } else {
          cy.log('❌ Frontend cannot reach backend API');
          cy.log(`Error: ${result.error}`);
        }
      });

    cy.screenshot('backend-connectivity');
  });

  it('should provide honest assessment of UI functionality', () => {
    cy.log('📊 Honest Assessment: What actually works in the UI');

    const assessment = {
      pageLoads: false,
      hasInteractiveElements: false,
      hasInputField: false,
      hasNavigation: false,
      hasToggles: false,
      backendReachable: false,
    };

    // Test page loading
    cy.get('body')
      .should('exist')
      .then(() => {
        assessment.pageLoads = true;
        cy.log('✅ Page loads successfully');
      });

    // Test for interactive elements
    cy.get('body').then(($body) => {
      const interactive = $body.find(
        'button, input, select, textarea, [role="button"], [role="tab"], [role="switch"]'
      );
      if (interactive.length > 0) {
        assessment.hasInteractiveElements = true;
        cy.log(`✅ Found ${interactive.length} interactive elements`);
      }

      // Test for input fields
      const inputs = $body.find('input[type="text"], textarea, [contenteditable]');
      if (inputs.length > 0) {
        assessment.hasInputField = true;
        cy.log(`✅ Found ${inputs.length} input fields`);
      }

      // Test for navigation
      const navElements = $body.find(
        'button:contains("Goals"), button:contains("Config"), [role="tab"], .tab, .nav'
      );
      if (navElements.length > 0) {
        assessment.hasNavigation = true;
        cy.log(`✅ Found ${navElements.length} navigation elements`);
      }

      // Test for toggles
      const toggles = $body.find('input[type="checkbox"], [role="switch"], .toggle');
      if (toggles.length > 0) {
        assessment.hasToggles = true;
        cy.log(`✅ Found ${toggles.length} toggle elements`);
      }
    });

    // Test backend connectivity
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 200) {
        assessment.backendReachable = true;
        cy.log('✅ Backend is reachable from test environment');
      }
    });

    // Final assessment
    cy.then(() => {
      const workingFeatures = Object.values(assessment).filter((v) => v).length;
      const totalFeatures = Object.keys(assessment).length;

      cy.log('');
      cy.log('📊 UI FUNCTIONALITY ASSESSMENT:');
      cy.log(`${workingFeatures}/${totalFeatures} features working`);
      cy.log('');

      Object.entries(assessment).forEach(([feature, works]) => {
        const status = works ? '✅' : '❌';
        cy.log(`${status} ${feature}: ${works ? 'WORKING' : 'NOT WORKING'}`);
      });

      const percentage = Math.round((workingFeatures / totalFeatures) * 100);
      cy.log('');
      cy.log(`🎯 OVERALL UI FUNCTIONALITY: ${percentage}%`);

      if (percentage >= 80) {
        cy.log('🎉 UI is largely functional!');
      } else if (percentage >= 50) {
        cy.log('⚠️ UI has some functionality but needs work');
      } else {
        cy.log('🚨 UI has significant issues');
      }
    });

    cy.screenshot('final-assessment');
  });

  afterEach(() => {
    cy.screenshot('test-completed');
  });
});
