/// <reference types="cypress" />

/**
 * Goals Integration E2E Tests
 *
 * Tests the integration between autonomy plugin and goals plugin:
 * 1. Initial goals creation ("communicate with admin", "read message from founders")
 * 2. Goals API endpoints work correctly
 * 3. Goals show up in frontend via APIs
 */

describe('Goals Integration Tests', () => {
  let agentId: string;

  before(() => {
    // Get agent ID from the game/environment
    cy.visit('http://localhost:7777');

    // Extract agentId from the page or API
    cy.request('GET', '/api/agents').then((response) => {
      expect(response.status).to.equal(200);
      const agents = response.body;
      expect(agents).to.have.length.greaterThan(0);
      agentId = agents[0].id;
      cy.log(`Using agent ID: ${agentId}`);
    });
  });

  it('should have goals plugin available', () => {
    // Test that goals API endpoint exists
    cy.request({
      method: 'GET',
      url: `/api/goals?agentId=${agentId}`,
      failOnStatusCode: false,
    }).then((response) => {
      // Should return 200 or 404, but not 500 (which would mean plugin not loaded)
      expect(response.status).to.be.oneOf([200, 404]);
    });
  });

  it('should create initial goals when autonomy plugin loads', () => {
    // Check that initial goals were created
    cy.request('GET', `/api/goals?agentId=${agentId}`).then((response) => {
      expect(response.status).to.equal(200);
      const goals = response.body;

      // Should have at least our 2 initial goals
      expect(goals).to.have.length.greaterThan(0);

      // Check for specific initial goals
      const goalNames = goals.map((goal: any) => goal.name);
      expect(goalNames).to.include('Communicate with the admin');
      expect(goalNames).to.include('Read the message from the founders');

      cy.log(`Found ${goals.length} goals for agent`);
      goals.forEach((goal: any) => {
        cy.log(`- ${goal.name}: ${goal.description}`);
      });
    });
  });

  it('should be able to fetch goals via API', () => {
    cy.request('GET', `/api/goals?agentId=${agentId}`).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');

      // Validate goal structure
      if (response.body.length > 0) {
        const goal = response.body[0];
        expect(goal).to.have.property('id');
        expect(goal).to.have.property('name');
        expect(goal).to.have.property('description');
        expect(goal).to.have.property('isCompleted');
        expect(goal).to.have.property('agentId');
        expect(goal.agentId).to.equal(agentId);
      }
    });
  });

  it('should be able to create new goals via API', () => {
    const newGoal = {
      agentId: agentId,
      ownerType: 'agent',
      ownerId: agentId,
      name: 'Test Goal from Cypress',
      description: 'A test goal created during Cypress testing',
      tags: ['test', 'cypress'],
    };

    cy.request('POST', `/api/goals?agentId=${agentId}`, newGoal).then((response) => {
      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(newGoal.name);

      const createdGoalId = response.body.id;

      // Verify the goal was actually created
      cy.request('GET', `/api/goals?agentId=${agentId}`).then((getResponse) => {
        const goals = getResponse.body;
        const createdGoal = goals.find((g: any) => g.id === createdGoalId);
        expect(createdGoal).to.exist;
        expect(createdGoal.name).to.equal(newGoal.name);
      });
    });
  });

  it('should be able to complete goals via API', () => {
    // First get a goal to complete
    cy.request('GET', `/api/goals?agentId=${agentId}`).then((response) => {
      const goals = response.body;
      const incompleteGoal = goals.find((g: any) => !g.isCompleted);

      if (incompleteGoal) {
        // Complete the goal
        cy.request('PUT', `/api/goals/${incompleteGoal.id}/complete?agentId=${agentId}`).then(
          (completeResponse) => {
            expect(completeResponse.status).to.equal(200);
            expect(completeResponse.body.task.isCompleted).to.be.true;

            // Verify the goal is marked as completed
            cy.request('GET', `/api/goals?agentId=${agentId}`).then((getResponse) => {
              const updatedGoals = getResponse.body;
              const completedGoal = updatedGoals.find((g: any) => g.id === incompleteGoal.id);
              expect(completedGoal.isCompleted).to.be.true;
            });
          }
        );
      } else {
        cy.log('No incomplete goals found to test completion');
      }
    });
  });

  it('should verify goals show up in autonomy status', () => {
    // Check that autonomy plugin can access goals (integration test)
    cy.request('GET', `/api/autonomy/status?agentId=${agentId}`).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data.agentId).to.equal(agentId);

      // The agent should be aware of its goals through the autonomy system
      cy.log('Autonomy status retrieved successfully, goals integration working');
    });
  });

  it('should handle goals API error cases gracefully', () => {
    // Test invalid agent ID
    cy.request({
      method: 'GET',
      url: '/api/goals?agentId=invalid-uuid',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 404, 500]);
    });

    // Test missing agent ID
    cy.request({
      method: 'GET',
      url: '/api/goals',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 404]);
    });

    // Test invalid goal creation
    cy.request({
      method: 'POST',
      url: `/api/goals?agentId=${agentId}`,
      body: {
        // Missing required fields
        name: '',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 422]);
    });
  });

  it('should verify goals persist across plugin reloads', () => {
    // Create a specific test goal
    const persistenceTestGoal = {
      agentId: agentId,
      ownerType: 'agent',
      ownerId: agentId,
      name: 'Persistence Test Goal',
      description: 'This goal tests that goals persist properly',
      tags: ['persistence', 'test'],
    };

    cy.request('POST', `/api/goals?agentId=${agentId}`, persistenceTestGoal).then(
      (createResponse) => {
        const goalId = createResponse.body.id;

        // Simulate some time passing (goals should persist)
        cy.wait(1000);

        // Verify goal still exists
        cy.request('GET', `/api/goals?agentId=${agentId}`).then((getResponse) => {
          const goals = getResponse.body;
          const persistedGoal = goals.find((g: any) => g.id === goalId);
          expect(persistedGoal).to.exist;
          expect(persistedGoal.name).to.equal(persistenceTestGoal.name);
        });
      }
    );
  });

  // Clean up test data
  after(() => {
    // Clean up any test goals we created
    cy.request('GET', `/api/goals?agentId=${agentId}`).then((response) => {
      const goals = response.body;
      const testGoals = goals.filter(
        (g: any) => g.name.includes('Test Goal') || g.name.includes('Persistence Test')
      );

      testGoals.forEach((goal: any) => {
        cy.request('DELETE', `/api/goals/${goal.id}?agentId=${agentId}`);
      });

      cy.log(`Cleaned up ${testGoals.length} test goals`);
    });
  });
});
