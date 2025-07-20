/// <reference types="cypress" />

describe('Goals and Todos - Comprehensive Verification', () => {
  beforeEach(() => {
    // Skip boot sequence for direct testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    
    cy.visit('/', { timeout: 30000 });
    
    // Wait for the main interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
  });

  it('should display Goals tab correctly and show initial goals', () => {
    cy.screenshot('01-initial-interface-state');
    
    // Navigate to Goals tab (should be default)
    cy.get('[data-testid="goals-tab"]', { timeout: 10000 }).should('be.visible').and('have.class', 'active');
    
    // Verify Goals content area is visible
    cy.get('[data-testid="goals-content"]', { timeout: 10000 }).should('be.visible');
    
    // Check for Goals header
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.contains('GOALS').should('be.visible');
      
      // Should show either goals or empty state
      cy.get('body').then($body => {
        if ($body.find('.status-item').length > 0) {
          cy.log('Goals found in UI');
          cy.get('.status-item').should('have.length.greaterThan', 0);
          
          // Verify goal structure
          cy.get('.status-item').first().within(() => {
            cy.get('.status-indicator').should('be.visible');
            cy.get('.status-text').should('be.visible');
            cy.get('.status-title').should('not.be.empty');
          });
        } else {
          cy.log('No goals found - checking empty state');
          cy.contains('No active goals').should('be.visible');
        }
      });
    });
    
    cy.screenshot('02-goals-tab-verified');
  });

  it('should display Todos tab correctly and show initial todos', () => {
    // Navigate to Todos tab
    cy.get('[data-testid="todos-tab"]', { timeout: 10000 }).should('be.visible').click();
    
    // Verify Todos content area is visible
    cy.get('[data-testid="todos-content"]', { timeout: 10000 }).should('be.visible');
    
    // Check for Todos header
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.contains('TASKS').should('be.visible');
      
      // Should show either todos or empty state
      cy.get('body').then($body => {
        if ($body.find('.status-item').length > 0) {
          cy.log('Todos found in UI');
          cy.get('.status-item').should('have.length.greaterThan', 0);
          
          // Verify todo structure  
          cy.get('.status-item').first().within(() => {
            cy.get('.status-indicator').should('be.visible');
            cy.get('.status-text').should('be.visible');
            cy.get('.status-title').should('not.be.empty');
          });
        } else {
          cy.log('No todos found - checking empty state');
          cy.contains('No pending tasks').should('be.visible');
        }
      });
    });
    
    cy.screenshot('03-todos-tab-verified');
  });

  it('should verify that goals persist across different rooms (global sharing)', () => {
    // Start on Goals tab
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]', { timeout: 10000 }).should('be.visible');
    
    // Record initial goals count
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.get('body').then($body => {
        const initialGoalsCount = $body.find('.status-item').length;
        cy.log(`Initial goals count: ${initialGoalsCount}`);
        
        // Store count for later comparison
        cy.wrap(initialGoalsCount).as('initialGoalsCount');
      });
    });
    
    // Navigate to a different tab and back
    cy.get('[data-testid="files-tab"]').click();
    cy.wait(2000);
    
    // Go back to Goals tab
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]', { timeout: 10000 }).should('be.visible');
    
    // Verify goals count is the same (persistence check)
    cy.get('@initialGoalsCount').then(initialCount => {
      cy.get('[data-testid="goals-content"]').within(() => {
        cy.get('body').then($body => {
          const currentGoalsCount = $body.find('.status-item').length;
          expect(currentGoalsCount).to.equal(initialCount);
          cy.log(`Goals persisted correctly: ${currentGoalsCount} goals still visible`);
        });
      });
    });
    
    cy.screenshot('04-goals-persistence-verified');
  });

  it('should verify that todos persist across different tabs (global sharing)', () => {
    // Start on Todos tab
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]', { timeout: 10000 }).should('be.visible');
    
    // Record initial todos count
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.get('body').then($body => {
        const initialTodosCount = $body.find('.status-item').length;
        cy.log(`Initial todos count: ${initialTodosCount}`);
        
        // Store count for later comparison
        cy.wrap(initialTodosCount).as('initialTodosCount');
      });
    });
    
    // Navigate to different tabs
    cy.get('[data-testid="monologue-tab"]').click();
    cy.wait(1000);
    cy.get('[data-testid="config-tab"]').click();
    cy.wait(1000);
    
    // Go back to Todos tab
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]', { timeout: 10000 }).should('be.visible');
    
    // Verify todos count is the same (persistence check)
    cy.get('@initialTodosCount').then(initialCount => {
      cy.get('[data-testid="todos-content"]').within(() => {
        cy.get('body').then($body => {
          const currentTodosCount = $body.find('.status-item').length;
          expect(currentTodosCount).to.equal(initialCount);
          cy.log(`Todos persisted correctly: ${currentTodosCount} todos still visible`);
        });
      });
    });
    
    cy.screenshot('05-todos-persistence-verified');
  });

  it('should show goal and todo indicators correctly', () => {
    // Test Goals indicators
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.get('body').then($body => {
        if ($body.find('.status-item').length > 0) {
          // Check that each goal has a status indicator (completed ✓ or pending ○)
          cy.get('.status-item').each($item => {
            cy.wrap($item).find('.status-indicator').should('be.visible')
              .and($indicator => {
                const text = $indicator.text().trim();
                expect(['✓', '○']).to.include(text);
              });
          });
        }
      });
    });
    
    // Test Todos indicators  
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.get('body').then($body => {
        if ($body.find('.status-item').length > 0) {
          // Check that each todo has a status indicator (completed ✓ or pending ○)
          cy.get('.status-item').each($item => {
            cy.wrap($item).find('.status-indicator').should('be.visible')
              .and($indicator => {
                const text = $indicator.text().trim();
                expect(['✓', '○']).to.include(text);
              });
          });
        }
      });
    });
    
    cy.screenshot('06-indicators-verified');
  });

  it('should verify data refresh happens periodically', () => {
    // Start monitoring network requests
    cy.intercept('GET', '**/api/goals').as('goalsRefresh');
    cy.intercept('GET', '**/api/todos').as('todosRefresh');
    
    // Navigate to Goals tab
    cy.get('[data-testid="goals-tab"]').click();
    cy.get('[data-testid="goals-content"]', { timeout: 10000 }).should('be.visible');
    
    // Wait for periodic refresh (should happen every 5 seconds according to GameInterface.tsx)
    cy.wait('@goalsRefresh', { timeout: 10000 });
    cy.log('✅ Goals API refresh detected');
    
    // Navigate to Todos tab
    cy.get('[data-testid="todos-tab"]').click();
    cy.get('[data-testid="todos-content"]', { timeout: 10000 }).should('be.visible');
    
    // Wait for todos refresh
    cy.wait('@todosRefresh', { timeout: 10000 });
    cy.log('✅ Todos API refresh detected');
    
    cy.screenshot('07-periodic-refresh-verified');
  });

  afterEach(() => {
    cy.screenshot('99-test-complete');
  });
});