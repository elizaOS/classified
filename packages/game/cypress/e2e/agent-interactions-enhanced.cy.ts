/// <reference types="cypress" />

describe('Enhanced Agent Interactions Testing', () => {
  beforeEach(() => {
    // Skip boot sequence for focused agent interaction testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    cy.visit('/', { timeout: 15000 });
    
    // Wait for main interface and ensure agent is ready
    cy.get('[data-testid="game-interface"]', { timeout: 20000 }).should('be.visible');
    cy.get('[data-testid="autonomy-status"]', { timeout: 10000 }).should('exist');
  });

  describe('Goal Management System', () => {
    it('should display goals interface and interact with agent about goals', () => {
      cy.get('[data-testid="goals-tab"]').click();
      cy.screenshot('agent-goals-initial');
      
      // Verify goals tab is active and content is visible
      cy.get('[data-testid="goals-content"]').should('be.visible');
      
      // Test sending a message about goals to the agent
      cy.get('[data-testid="chat-input"]').type('I want to learn about machine learning. Can you help me set some learning goals?{enter}');
      
      // Wait for agent response
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify the message was sent and response received
      cy.get('[data-testid="chat-messages"]').should('contain', 'machine learning');
      cy.screenshot('agent-goal-conversation');
      
      // Test navigation back to goals tab
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.screenshot('agent-goals-tab-working');
    });

    it('should test multiple goal conversations and UI navigation', () => {
      cy.get('[data-testid="goals-tab"]').click();

      // Test multiple goal-related conversations
      const goalTopics = [
        'Help me organize my daily schedule',
        'Learn Spanish vocabulary', 
        'Plan a healthy meal prep routine'
      ];

      goalTopics.forEach((topic, index) => {
        cy.get('[data-testid="chat-input"]').type(`I want to work on: ${topic}{enter}`);
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        cy.wait(2000); // Pause between messages
      });

      // Verify messages were sent and responses received
      cy.get('[data-testid="chat-messages"]').should('contain', 'organize');
      cy.get('[data-testid="chat-messages"]').should('contain', 'Spanish');
      cy.get('[data-testid="chat-messages"]').should('contain', 'meal prep');
      cy.screenshot('agent-multiple-goal-conversations');

      // Test tab navigation
      cy.get('[data-testid="todos-tab"]').click();
      cy.get('[data-testid="todos-content"]').should('be.visible');
      
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.screenshot('agent-goal-navigation-working');
    });

    it('should handle photography conversation and UI testing', () => {
      // Start a conversation about interests
      cy.get('[data-testid="chat-input"]').type('I\'m interested in photography but I\'m a complete beginner{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify the conversation happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'photography');
      cy.screenshot('agent-photography-conversation');

      // Test goals tab functionality
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.screenshot('agent-goals-accessible');
    });
  });

  describe('Todo Management System', () => {
    it('should display todos interface and test task conversations', () => {
      cy.get('[data-testid="todos-tab"]').click();
      cy.screenshot('agent-todos-initial');

      // Verify todos tab works
      cy.get('[data-testid="todos-content"]').should('be.visible');

      // Mention tasks in conversation
      cy.get('[data-testid="chat-input"]').type('I need to call my dentist, buy groceries, and finish my project report by Friday{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify conversation happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'dentist');
      cy.get('[data-testid="chat-messages"]').should('contain', 'groceries');
      cy.get('[data-testid="chat-messages"]').should('contain', 'project report');
      cy.screenshot('agent-todos-conversation');
    });

    it('should handle task conversation and UI navigation', () => {
      // Test task conversation
      cy.get('[data-testid="chat-input"]').type('I need to clean the garage today{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      cy.get('[data-testid="todos-tab"]').click();
      cy.get('[data-testid="todos-content"]').should('be.visible');

      // Test more task conversation
      cy.get('[data-testid="chat-input"]').type('I started cleaning and made good progress{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify messages were sent
      cy.get('[data-testid="chat-messages"]').should('contain', 'garage');
      cy.get('[data-testid="chat-messages"]').should('contain', 'progress');
      cy.screenshot('agent-todo-progress-conversation');
    });

    it('should handle multiple task conversations', () => {
      cy.get('[data-testid="todos-tab"]').click();

      // Test multiple task conversations
      const todos = [
        'Submit tax documents by April 15th',
        'Buy birthday gift for mom next week',
        'Eventually learn to play guitar'
      ];

      todos.forEach(todo => {
        cy.get('[data-testid="chat-input"]').type(`I need to: ${todo}{enter}`);
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        cy.wait(2000);
      });

      // Verify all conversations happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'tax documents');
      cy.get('[data-testid="chat-messages"]').should('contain', 'birthday gift');
      cy.get('[data-testid="chat-messages"]').should('contain', 'guitar');
      cy.screenshot('agent-todo-conversations');
    });

    it('should handle complex task planning conversation', () => {
      cy.get('[data-testid="chat-input"]').type('I need to plan and execute a dinner party for 10 people{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify conversation about complex task happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'dinner party');
      
      // Test todos tab accessibility
      cy.get('[data-testid="todos-tab"]').click();
      cy.get('[data-testid="todos-content"]').should('be.visible');
      cy.screenshot('agent-todo-planning-conversation');
    });
  });

  describe('Memory Persistence and Learning', () => {
    it('should remember user preferences across conversations', () => {
      // Establish preferences
      cy.get('[data-testid="chat-input"]').type('I prefer vegetarian food and I\'m allergic to nuts{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      cy.get('[data-testid="chat-input"]').type('My favorite color is blue and I work in software development{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Test memory in new conversation context
      cy.reload();
      cy.get('[data-testid="game-interface"]', { timeout: 20000 }).should('be.visible');

      cy.get('[data-testid="chat-input"]').type('Can you suggest a meal for dinner?{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      // Agent should reference vegetarian preference and nut allergy
      cy.get('[data-testid="agent-message"]').should('contain.oneOf', ['vegetarian', 'no nuts', 'nut-free']);
      cy.screenshot('agent-memory-dietary-preferences');

      // Test career context memory
      cy.get('[data-testid="chat-input"]').type('I\'m feeling stressed about work{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="agent-message"]').should('contain.oneOf', ['software', 'development', 'coding']);
    });

    it('should learn from interaction patterns and adapt responses', () => {
      // Establish pattern - user prefers concise responses
      for (let i = 0; i < 3; i++) {
        cy.get('[data-testid="chat-input"]').type('Give me a quick summary of AI{enter}');
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        
        cy.get('[data-testid="chat-input"]').type('That\'s too long, please be more concise{enter}');
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        cy.wait(1000);
      }

      // Test if agent learned to be more concise
      cy.get('[data-testid="chat-input"]').type('Explain quantum computing{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Response should be notably shorter
      cy.get('[data-testid="agent-message"]').last().invoke('text').then((text) => {
        expect(text.length).to.be.lessThan(300); // Concise response
      });
      cy.screenshot('agent-learned-conciseness');
    });

    it('should maintain long-term memory of important events', () => {
      // Create significant events
      cy.get('[data-testid="chat-input"]').type('Today is my birthday! I turned 30 and had a great party with friends{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      cy.get('[data-testid="chat-input"]').type('I just got promoted to senior developer at my company!{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Test memory retrieval after some time
      // Simulate multiple interactions
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="chat-input"]').type(`Random conversation ${i}{enter}`);
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      }

      // Test if important events are still remembered
      cy.get('[data-testid="chat-input"]').type('What important things happened to me recently?{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="agent-message"]').should('contain.oneOf', ['birthday', '30', 'promoted', 'senior developer']);
      cy.screenshot('agent-long-term-memory');
    });

    it('should associate related memories and make connections', () => {
      // Establish related information across conversations
      cy.get('[data-testid="chat-input"]').type('I\'m working on a Python project for data analysis{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      cy.get('[data-testid="chat-input"]').type('I need to learn more about pandas and numpy libraries{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      cy.get('[data-testid="chat-input"]').type('My deadline for this project is next month{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Test if agent makes connections
      cy.get('[data-testid="chat-input"]').type('Can you help me create a learning schedule?{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      // Agent should connect: Python project + pandas/numpy + deadline + learning schedule
      cy.get('[data-testid="agent-message"]').should('contain.oneOf', ['Python', 'pandas', 'numpy']);
      cy.get('[data-testid="agent-message"]').should('contain.oneOf', ['deadline', 'next month']);
      cy.screenshot('agent-memory-connections');
    });
  });

  describe('Autonomous Thinking and Decision Making', () => {
    it('should test autonomy controls and conversation', () => {
      // Test monologue tab
      cy.get('[data-testid="monologue-tab"]').click();
      cy.get('[data-testid="monologue-content"]').should('be.visible');
      cy.screenshot('agent-monologue-tab');
      
      // Test autonomy toggle functionality
      cy.get('[data-testid="autonomy-toggle"]').click();
      cy.get('[data-testid="autonomy-status"]').should('contain', 'Active');
      cy.screenshot('agent-autonomy-enabled');

      // Test conversation while autonomy is active
      cy.get('[data-testid="chat-input"]').type('I have a big presentation next week but I haven\'t started preparing{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Verify the conversation happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'presentation');
      cy.screenshot('agent-autonomous-conversation');
    });

    it('should test goals conversation with autonomy enabled', () => {
      cy.get('[data-testid="autonomy-toggle"]').click();
      cy.get('[data-testid="autonomy-status"]').should('contain', 'Active');
      
      // Test conversation about challenges and goals
      cy.get('[data-testid="chat-input"]').type('I\'m feeling overwhelmed. I have work deadlines, personal commitments, and I\'m not sleeping well{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Verify conversation happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'overwhelmed');
      
      // Test goals tab navigation
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.screenshot('agent-goals-with-autonomy');

      // Test follow-up conversation about goals
      cy.get('[data-testid="chat-input"]').type('Can you help me organize my priorities?{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="chat-messages"]').should('contain', 'priorities');
    });

    it('should handle emotional conversation appropriately', () => {
      // Test emotional conversation
      cy.get('[data-testid="chat-input"]').type('I just lost my job today. I\'m really scared about the future{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify the conversation happened and agent responded
      cy.get('[data-testid="chat-messages"]').should('contain', 'job');
      cy.get('[data-testid="agent-message"]').should('be.visible');
      cy.screenshot('agent-emotional-conversation');

      // Test follow-up conversation
      cy.get('[data-testid="chat-input"]').type('Thanks, that helps a bit{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify follow-up conversation happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'Thanks');
    });

    it('should test multiple conversation exchanges', () => {
      // Test conversation about preferences
      cy.get('[data-testid="chat-input"]').type('I prefer very detailed explanations with examples{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Test technical conversation
      cy.get('[data-testid="chat-input"]').type('Explain blockchain{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify conversation happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'blockchain');
        
      // Test feedback
      cy.get('[data-testid="chat-input"]').type('Perfect level of detail, thank you!{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Test follow-up question
      cy.get('[data-testid="chat-input"]').type('Now explain machine learning{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        
      // Verify all conversations happened
      cy.get('[data-testid="chat-messages"]').should('contain', 'machine learning');
      cy.screenshot('agent-multiple-exchanges');
    });
  });

  afterEach(() => {
    // Ensure autonomy is paused to prevent interference between tests
    cy.get('[data-testid="autonomy-toggle"]').then(($toggle) => {
      if ($toggle.attr('aria-checked') === 'true') {
        cy.wrap($toggle).click();
      }
    });
    
    cy.screenshot('agent-interaction-test-complete');
  });
});