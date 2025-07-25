describe('Simple Capability Toggles Test', () => {
  beforeEach(() => {
    // Skip startup flow
    cy.window().then((win) => {
      win.localStorage.setItem('skipStartup', 'true');
    });

    // Visit the app
    cy.visit('http://localhost:5173');

    // Wait for UI to load
    cy.get('body', { timeout: 10000 }).should('be.visible');
  });

  it('should load the game interface', () => {
    // Check that main UI elements are visible
    cy.contains('ELIZA TERMINAL').should('be.visible');
    cy.screenshot('game-interface-loaded');
  });

  it('should have capability buttons visible', () => {
    // Check for capability buttons
    cy.contains('AUTO').should('be.visible');
    cy.contains('CAM').should('be.visible');
    cy.contains('SCR').should('be.visible');
    cy.contains('MIC').should('be.visible');
    cy.contains('SPK').should('be.visible');
    cy.contains('SH').should('be.visible');
    cy.contains('WWW').should('be.visible');
    cy.screenshot('capability-buttons-visible');
  });

  it('should have navigation tabs visible', () => {
    // Check for tabs
    cy.contains('GOALS').should('be.visible');
    cy.contains('TODOS').should('be.visible');
    cy.contains('MONOLOGUE').should('be.visible');
    cy.contains('FILES').should('be.visible');
    cy.contains('CONFIG').should('be.visible');
    cy.screenshot('navigation-tabs-visible');
  });

  it('should navigate between tabs', () => {
    // Click through tabs
    cy.contains('GOALS').click();
    cy.wait(500);
    cy.screenshot('goals-tab');

    cy.contains('TODOS').click();
    cy.wait(500);
    cy.screenshot('todos-tab');

    cy.contains('MONOLOGUE').click();
    cy.wait(500);
    cy.screenshot('monologue-tab');
  });

  it('should test backend API endpoints', () => {
    // Test goals endpoint
    cy.request('GET', 'http://localhost:7777/api/goals').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('goals');
      cy.log('Goals:', JSON.stringify(response.body.goals));
    });

    // Test todos endpoint
    cy.request('GET', 'http://localhost:7777/api/todos').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('todos');
      cy.log('Todos:', JSON.stringify(response.body.todos));
    });

    // Test monologue endpoint
    cy.request('GET', 'http://localhost:7777/api/monologue').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('thoughts');
      cy.log('Thoughts:', JSON.stringify(response.body.thoughts));
    });

    // Test autonomy status
    cy.request('GET', 'http://localhost:7777/api/agents/default/autonomy/status').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      cy.log('Autonomy status:', JSON.stringify(response.body.data));
    });
  });

  it('should send a message to the agent', () => {
    // Find the input field and type a message
    cy.get('input[type="text"], textarea').first().type('Hello ELIZA!{enter}');
    cy.wait(3000); // Wait for response
    cy.screenshot('message-sent');
  });
});
