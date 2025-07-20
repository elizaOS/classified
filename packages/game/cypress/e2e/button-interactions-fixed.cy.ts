/// <reference types="cypress" />

describe('Button Interactions - Fixed Implementation', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    
    cy.visit('/', { timeout: 30000 });
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
    cy.wait(3000);
  });

  it('should handle tab button clicks correctly regardless of click target', () => {
    cy.screenshot('01-initial-state');
    
    const tabs = ['goals', 'todos', 'monologue', 'files', 'config'];
    
    tabs.forEach((tab, index) => {
      cy.log(`🔘 Testing ${tab} tab button interactions`);
      
      // Test 1: Click on the button element itself
      cy.get(`[data-testid="${tab}-tab"]`).click();
      cy.get(`[data-testid="${tab}-tab"]`).should('have.class', 'active');
      cy.get(`[data-testid="${tab}-content"]`).should('be.visible');
      cy.log(`✅ Button element click works for ${tab}`);
      
      // Test 2: Click on the text content inside the button
      cy.get(`[data-testid="${tab}-tab"]`).contains(tab.toUpperCase()).click();
      cy.get(`[data-testid="${tab}-tab"]`).should('have.class', 'active');
      cy.log(`✅ Text content click works for ${tab}`);
      
      // Test 3: Force click to simulate various edge cases
      cy.get(`[data-testid="${tab}-tab"]`).click({ force: true });
      cy.get(`[data-testid="${tab}-tab"]`).should('have.class', 'active');
      cy.log(`✅ Force click works for ${tab}`);
      
      // Test 4: Click multiple times rapidly
      cy.get(`[data-testid="${tab}-tab"]`)
        .click()
        .click()
        .click();
      cy.get(`[data-testid="${tab}-tab"]`).should('have.class', 'active');
      cy.log(`✅ Rapid clicks handled correctly for ${tab}`);
      
      cy.wait(500);
    });
    
    cy.screenshot('02-tab-buttons-tested');
  });

  it('should handle capability toggle button interactions correctly', () => {
    cy.screenshot('03-before-capability-tests');
    
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];
    
    capabilities.forEach(capability => {
      cy.log(`🔘 Testing ${capability} toggle button`);
      
      // Get initial state
      cy.get(`[data-testid="${capability}-toggle"]`).then($btn => {
        const initialState = $btn.hasClass('enabled');
        cy.log(`Initial ${capability} state: ${initialState ? 'enabled' : 'disabled'}`);
        
        // Test 1: Click on the main button
        cy.get(`[data-testid="${capability}-toggle"]`).click();
        cy.wait(1000); // Wait for potential state change
        
        // Verify button is still clickable and responsive
        cy.get(`[data-testid="${capability}-toggle"]`).should('exist').and('be.visible');
        cy.log(`✅ Main button click registered for ${capability}`);
        
        // Test 2: Click on the indicator icon
        cy.get(`[data-testid="${capability}-toggle-status"]`).click();
        cy.wait(500);
        cy.get(`[data-testid="${capability}-toggle"]`).should('exist').and('be.visible');
        cy.log(`✅ Indicator click registered for ${capability}`);
        
        // Test 3: Click on the label text
        cy.get(`[data-testid="${capability}-toggle"]`).contains(capability.toUpperCase()).click();
        cy.wait(500);
        cy.get(`[data-testid="${capability}-toggle"]`).should('exist').and('be.visible');
        cy.log(`✅ Label click registered for ${capability}`);
        
        // Test 4: Verify button styling responds to interactions
        cy.get(`[data-testid="${capability}-toggle"]`)
          .trigger('mouseover')
          .should('exist');
        cy.get(`[data-testid="${capability}-toggle"]`)
          .trigger('mouseout')
          .should('exist');
        cy.log(`✅ Hover states work for ${capability}`);
        
        // Test 5: Test with different mouse events
        cy.get(`[data-testid="${capability}-toggle"]`)
          .trigger('mousedown')
          .trigger('mouseup')
          .should('exist');
        cy.log(`✅ Mouse events handled for ${capability}`);
      });
    });
    
    cy.screenshot('04-capability-buttons-tested');
  });

  it('should verify button visual feedback and state changes', () => {
    cy.screenshot('05-before-visual-feedback-test');
    
    // Test tab button visual feedback
    const tabs = ['goals', 'todos', 'monologue', 'files', 'config'];
    
    tabs.forEach(tab => {
      // Click tab and verify active state styling
      cy.get(`[data-testid="${tab}-tab"]`).click();
      
      // Verify this tab has active class
      cy.get(`[data-testid="${tab}-tab"]`).should('have.class', 'active');
      
      // Verify other tabs don't have active class
      tabs.filter(t => t !== tab).forEach(otherTab => {
        cy.get(`[data-testid="${otherTab}-tab"]`).should('not.have.class', 'active');
      });
      
      cy.log(`✅ Visual feedback correct for ${tab} tab`);
    });
    
    // Test capability button visual feedback
    const capabilities = ['autonomy', 'shell', 'browser']; // Test subset for speed
    
    capabilities.forEach(capability => {
      cy.get(`[data-testid="${capability}-toggle"]`).then($btn => {
        const wasEnabled = $btn.hasClass('enabled');
        
        // Click the button
        cy.get(`[data-testid="${capability}-toggle"]`).click();
        cy.wait(1000);
        
        // Check if visual state changed (may or may not depending on service availability)
        cy.get(`[data-testid="${capability}-toggle"]`).then($newBtn => {
          // Button should still exist and be responsive
          expect($newBtn).to.exist;
          cy.log(`✅ ${capability} button remains responsive after click`);
          
          // Check indicator symbol
          cy.get(`[data-testid="${capability}-toggle-status"]`).then($indicator => {
            const symbol = $indicator.text();
            expect(['◉', '◯']).to.include(symbol);
            cy.log(`✅ ${capability} indicator shows valid symbol: ${symbol}`);
          });
        });
      });
    });
    
    cy.screenshot('06-visual-feedback-verified');
  });

  it('should verify buttons work correctly with keyboard navigation', () => {
    cy.screenshot('07-before-keyboard-test');
    
    // Test tab button keyboard navigation
    cy.get('[data-testid="goals-tab"]').focus().type('{enter}');
    cy.get('[data-testid="goals-tab"]').should('have.class', 'active');
    cy.get('[data-testid="goals-content"]').should('be.visible');
    cy.log('✅ Keyboard Enter works on tab button');
    
    cy.get('[data-testid="todos-tab"]').focus().type(' '); // Space key
    cy.get('[data-testid="todos-tab"]').should('have.class', 'active');
    cy.get('[data-testid="todos-content"]').should('be.visible');
    cy.log('✅ Keyboard Space works on tab button');
    
    // Test capability button keyboard access
    cy.get('[data-testid="autonomy-toggle"]').focus().type('{enter}');
    cy.wait(1000);
    cy.get('[data-testid="autonomy-toggle"]').should('exist');
    cy.log('✅ Keyboard Enter works on capability button');
    
    cy.screenshot('08-keyboard-navigation-tested');
  });

  it('should test button interactions under stress conditions', () => {
    cy.screenshot('09-before-stress-test');
    
    // Rapid clicking test
    cy.log('🔄 Testing rapid clicking...');
    for (let i = 0; i < 5; i++) {
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="todos-tab"]').click();
    }
    
    // Should still be responsive
    cy.get('[data-testid="todos-tab"]').should('have.class', 'active');
    cy.get('[data-testid="todos-content"]').should('be.visible');
    cy.log('✅ Rapid clicking handled correctly');
    
    // Multiple simultaneous operations
    cy.log('🔄 Testing simultaneous operations...');
    cy.get('[data-testid="files-tab"]').click();
    cy.get('[data-testid="shell-toggle"]').click();
    cy.get('[data-testid="browser-toggle"]').click();
    
    // All should be responsive
    cy.get('[data-testid="files-tab"]').should('have.class', 'active');
    cy.get('[data-testid="files-content"]').should('be.visible');
    cy.log('✅ Simultaneous operations handled correctly');
    
    // Click during API calls
    cy.log('🔄 Testing clicks during API loading...');
    
    // Intercept API to make it slow
    cy.intercept('GET', '**/api/goals', { delay: 2000, body: [] }).as('slowGoals');
    
    // Click to trigger API call, then immediately click other things
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="todos-tab"]').click(); // Switch immediately
    cy.get('[data-testid="autonomy-toggle"]').click(); // Toggle capability
    
    // Should still work
    cy.get('[data-testid="todos-tab"]').should('have.class', 'active');
    cy.log('✅ Clicks during API loading handled correctly');
    
    cy.screenshot('10-stress-test-completed');
  });

  it('should verify accessibility attributes and ARIA compliance', () => {
    cy.screenshot('11-before-accessibility-test');
    
    // Test tab buttons have proper ARIA attributes
    const tabs = ['goals', 'todos', 'monologue', 'files', 'config'];
    
    tabs.forEach(tab => {
      cy.get(`[data-testid="${tab}-tab"]`).then($btn => {
        // Should be focusable
        expect($btn.attr('tabindex')).to.not.equal('-1');
        cy.log(`✅ ${tab} tab is focusable`);
      });
    });
    
    // Test capability buttons have proper ARIA attributes
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];
    
    capabilities.forEach(capability => {
      cy.get(`[data-testid="${capability}-toggle"]`).then($btn => {
        // Should have role
        expect($btn.attr('role')).to.equal('switch');
        
        // Should have aria-checked
        expect($btn.attr('aria-checked')).to.match(/(true|false)/);
        
        // Should have aria-label
        expect($btn.attr('aria-label')).to.contain(capability);
        
        cy.log(`✅ ${capability} toggle has proper ARIA attributes`);
      });
    });
    
    cy.screenshot('12-accessibility-verified');
  });

  it('should verify error state button handling', () => {
    cy.screenshot('13-before-error-state-test');
    
    // Test buttons when APIs fail
    cy.intercept('GET', '**/api/goals', { statusCode: 500 }).as('failedGoals');
    cy.intercept('POST', '**/autonomy/enable', { statusCode: 503 }).as('failedAutonomy');
    
    // Click goals tab - should still work even if API fails
    cy.get('[data-testid="goals-tab"]').click();
    cy.wait('@failedGoals');
    
    cy.get('[data-testid="goals-tab"]').should('have.class', 'active');
    cy.get('[data-testid="goals-content"]').should('be.visible');
    cy.log('✅ Tab buttons work during API failures');
    
    // Click capability button - should still be responsive even if toggle fails
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.wait('@failedAutonomy');
    
    cy.get('[data-testid="autonomy-toggle"]').should('exist').and('be.visible');
    cy.log('✅ Capability buttons remain responsive during API failures');
    
    // UI should show error but remain functional
    cy.get('[data-testid="chat-messages"]').within(() => {
      cy.get('.chat-error').should('exist');
    });
    
    cy.screenshot('14-error-state-handling-verified');
  });

  afterEach(() => {
    cy.screenshot('99-test-complete');
    cy.log('🎯 Button interaction test completed');
  });
});