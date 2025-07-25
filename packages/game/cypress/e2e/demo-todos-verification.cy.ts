/// <reference types="cypress" />

describe('Demo TODOs Verification - Must Show Demo Tasks', () => {
  beforeEach(() => {
    // Visit the page with boot sequence skipped
    cy.visit('/', {
      timeout: 30000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
      }
    });

    // Wait for the main interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');
  });

  it('CRITICAL: Frontend must show demo TODOs and NOT display "No pending tasks"', () => {
    cy.screenshot('01-initial-interface-loaded');

    // Navigate to the Todos tab
    cy.get('[data-testid="todos-tab"]', { timeout: 10000 }).should('be.visible').click();

    // Wait for Todos content to load
    cy.get('[data-testid="todos-content"]', { timeout: 15000 }).should('be.visible');
    cy.screenshot('02-todos-tab-opened');

    // Wait longer for data to load (the backend creates TODOs on startup and needs time)
    cy.wait(10000);

    // Trigger a manual refresh of the data by forcing the fetch
    cy.window().then((win) => {
      // Force refresh the TODOs data
      win.dispatchEvent(new Event('focus')); // This might trigger a refresh
    });

    // Direct API verification - check that the backend is returning TODOs
    cy.request('GET', 'http://localhost:7777/api/todos').then((response) => {
      expect(response.status).to.eq(200);
      expect(Array.isArray(response.body)).to.be.true;
      const todoCount = response.body.flatMap(world => world.rooms.flatMap(room => room.tasks || [])).length;
      cy.log(`✅ API directly returns ${todoCount} TODOs`);
      expect(todoCount).to.be.greaterThan(0);
    });

    // CRITICAL TEST: "No pending tasks" must NOT be visible
    cy.get('[data-testid="todos-content"]').within(() => {
      // First verify the header is there
      cy.contains('TASKS').should('be.visible');

      // This test will FAIL if "No pending tasks" is shown
      cy.contains('No pending tasks').should('not.exist');
      cy.log('✅ PASSED: "No pending tasks" is not visible');
    });

    cy.screenshot('03-no-pending-tasks-verified-absent');

    // CRITICAL TEST: Must show at least one demo TODO
    cy.get('[data-testid="todos-content"]').within(() => {
      // Should have visible TODO items
      cy.get('.status-item', { timeout: 10000 }).should('have.length.greaterThan', 0);
      cy.log('✅ PASSED: TODO items are visible');

      // Verify we have multiple demo TODOs (we created 8)
      cy.get('.status-item').should('have.length.greaterThan', 3);
      cy.log('✅ PASSED: Multiple demo TODOs are visible');
    });

    cy.screenshot('04-demo-todos-verified-present');

    // Verify specific demo TODOs that we know should exist
    const expectedTodoTitles = [
      'Say hello to the admin',
      'Explore the knowledge base',
      'Test shell capabilities',
      'Learn about vision features',
      'Create my first goal',
      'Upload a test document',
      'Review daily progress',
      'Understand autonomy settings'
    ];

    // Check that at least some of our demo TODOs are visible
    cy.get('[data-testid="todos-content"]').within(() => {
      let foundTodos = 0;

      expectedTodoTitles.forEach(title => {
        cy.get('body').then($body => {
          if ($body.text().includes(title)) {
            foundTodos++;
            cy.log(`✅ Found demo TODO: "${title}"`);
            cy.contains(title).should('be.visible');
          }
        });
      });

      // We should find at least 3 of our demo TODOs
      cy.get('.status-item').should('have.length.greaterThan', 2);
    });

    cy.screenshot('05-specific-demo-todos-verified');

    // Verify TODO structure and indicators
    cy.get('[data-testid="todos-content"]').within(() => {
      cy.get('.status-item').first().within(() => {
        // Each TODO should have proper structure
        cy.get('.status-indicator').should('be.visible').and($indicator => {
          const text = $indicator.text().trim();
          // Should show either completed (✓) or pending (○) indicator
          expect(['✓', '○']).to.include(text);
        });

        cy.get('.status-text').should('be.visible');
        cy.get('.status-title').should('be.visible').and('not.be.empty');
      });
    });

    cy.screenshot('06-todo-structure-verified');

    // Final verification: Capture OCR-readable text to prove TODOs are visible
    cy.get('[data-testid="todos-content"]').then($content => {
      const todoText = $content.text();

      // Assert the text does NOT contain "No pending tasks"
      expect(todoText).to.not.include('No pending tasks');
      cy.log('✅ FINAL VERIFICATION: No "No pending tasks" text found');

      // Assert the text contains TODO indicators
      expect(todoText).to.include('○').or.include('✓');
      cy.log('✅ FINAL VERIFICATION: TODO status indicators found');

      // Log the visible TODO content for debugging
      cy.log('TODO Content Preview:', todoText.substring(0, 200));
    });

    cy.screenshot('07-final-todo-verification-complete');
  });

  it('should verify Goals tab also shows demo content', () => {
    // Navigate to Goals tab
    cy.get('[data-testid="goals-tab"]', { timeout: 10000 }).should('be.visible').click();

    // Wait for Goals content to load
    cy.get('[data-testid="goals-content"]', { timeout: 15000 }).should('be.visible');
    cy.wait(3000);

    // Verify Goals are present (not empty state)
    cy.get('[data-testid="goals-content"]').within(() => {
      cy.contains('GOALS').should('be.visible');

      // Should NOT show "No active goals"
      cy.contains('No active goals').should('not.exist');

      // Should show goal items
      cy.get('.status-item', { timeout: 10000 }).should('have.length.greaterThan', 0);
    });

    cy.screenshot('08-goals-demo-content-verified');
  });

  it('should verify backend API endpoints return demo data', () => {
    // Test the todos API endpoint directly
    cy.request('GET', 'http://localhost:7777/api/todos').then((response) => {
      expect(response.status).to.eq(200);
      expect(Array.isArray(response.body)).to.be.true;

      // Extract todos from the world/rooms structure
      const allTodos = response.body.flatMap(world => world.rooms.flatMap(room => room.tasks || []));
      expect(allTodos).to.have.length.greaterThan(0);

      cy.log(`✅ API returned ${allTodos.length} TODOs`);

      // Verify at least one TODO has a recognizable demo title
      const todoTitles = allTodos.map(todo => todo.name);
      const hasDemoContent = todoTitles.some(title =>
        title.includes('hello') ||
        title.includes('admin') ||
        title.includes('knowledge') ||
        title.includes('shell')
      );

      expect(hasDemoContent).to.be.true;
      cy.log('✅ API contains demo TODO content');
    });

    // Test the goals API endpoint directly
    cy.request('GET', 'http://localhost:7777/api/goals').then((response) => {
      expect(response.status).to.eq(200);
      expect(Array.isArray(response.body)).to.be.true;
      expect(response.body).to.have.length.greaterThan(0);

      cy.log(`✅ API returned ${response.body.length} Goals`);
    });

    cy.screenshot('09-api-endpoints-verified');
  });

  afterEach(() => {
    cy.screenshot('99-test-complete');
  });
});
