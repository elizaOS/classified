/// <reference types="cypress" />

describe('Enhanced Agent Interactions Testing', () => {
  beforeEach(() => {
    // Skip boot sequence for focused agent interaction testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    cy.visit('/', { timeout: 15000 });
    
    // Wait for main interface and ensure agent is ready
    cy.get('[data-testid="chat-interface"]', { timeout: 20000 }).should('be.visible');
    cy.get('[data-testid="agent-status"]').should('contain', 'Ready');
  });

  describe('Goal Management System', () => {
    it('should create, update, and complete goals through conversation', () => {
      cy.get('[data-testid="goals-tab"]').click();
      cy.screenshot('agent-goals-initial');

      // Request agent to create a goal
      cy.get('[data-testid="chat-input"]').type('I want to learn about machine learning. Can you help me create a learning goal?{enter}');
      
      // Wait for agent response and goal creation
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Check if goal was automatically created
      cy.get('[data-testid="goals-content"]').within(() => {
        cy.get('[data-testid="goal-item"]').should('exist');
        cy.get('[data-testid="goal-title"]').should('contain', 'machine learning');
        cy.get('[data-testid="goal-status"]').should('contain', 'Active');
      });
      cy.screenshot('agent-goal-created');

      // Test goal progress updates
      cy.get('[data-testid="chat-input"]').type('I just finished reading about neural networks. Can you update my progress?{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify goal progress was updated
      cy.get('[data-testid="goal-progress-bar"]').should('have.attr', 'value').and('not.equal', '0');
      cy.get('[data-testid="goal-progress-description"]').should('contain', 'neural networks');
      cy.screenshot('agent-goal-progress-updated');

      // Test goal completion
      cy.get('[data-testid="chat-input"]').type('I\'ve completed my machine learning basics study. Mark this goal as complete.{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="goal-status"]').should('contain', 'Completed');
      cy.get('[data-testid="goal-completion-celebration"]').should('be.visible');
      cy.screenshot('agent-goal-completed');
    });

    it('should manage multiple goals with priorities', () => {
      cy.get('[data-testid="goals-tab"]').click();

      // Create multiple goals
      const goals = [
        'Help me organize my daily schedule',
        'Learn Spanish vocabulary',
        'Plan a healthy meal prep routine'
      ];

      goals.forEach((goal, index) => {
        cy.get('[data-testid="chat-input"]').type(`Create a goal: ${goal}{enter}`);
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        cy.wait(1000); // Brief pause between goal creation
      });

      // Verify all goals were created
      cy.get('[data-testid="goal-item"]').should('have.length', 3);
      cy.screenshot('agent-multiple-goals-created');

      // Test goal prioritization
      cy.get('[data-testid="chat-input"]').type('Make the Spanish learning goal my top priority{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify goal was reprioritized
      cy.get('[data-testid="goal-item"]').first().within(() => {
        cy.get('[data-testid="goal-title"]').should('contain', 'Spanish');
        cy.get('[data-testid="goal-priority"]').should('contain', 'High');
      });
      cy.screenshot('agent-goal-prioritized');

      // Test goal dependency creation
      cy.get('[data-testid="chat-input"]').type('The meal prep goal should depend on finishing the schedule organization first{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="goal-dependency-indicator"]').should('be.visible');
      cy.screenshot('agent-goal-dependencies');
    });

    it('should provide intelligent goal suggestions', () => {
      // Start a conversation about interests
      cy.get('[data-testid="chat-input"]').type('I\'m interested in photography but I\'m a complete beginner{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Agent should suggest relevant goals
      cy.get('[data-testid="goal-suggestion"]').should('be.visible');
      cy.get('[data-testid="suggested-goal-title"]').should('contain', 'photography');
      cy.screenshot('agent-goal-suggestions');

      // Accept a suggested goal
      cy.get('[data-testid="accept-goal-suggestion"]').first().click();
      
      // Verify goal was created from suggestion
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goal-item"]').should('contain', 'photography');
      cy.get('[data-testid="goal-source"]').should('contain', 'AI Suggested');
    });
  });

  describe('Todo Management System', () => {
    it('should create and manage todos automatically from conversation', () => {
      cy.get('[data-testid="todos-tab"]').click();
      cy.screenshot('agent-todos-initial');

      // Mention tasks in conversation
      cy.get('[data-testid="chat-input"]').type('I need to call my dentist, buy groceries, and finish my project report by Friday{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify todos were automatically extracted and created
      cy.get('[data-testid="todo-item"]').should('have.length', 3);
      
      cy.get('[data-testid="todo-item"]').first().within(() => {
        cy.get('[data-testid="todo-title"]').should('contain', 'call dentist');
        cy.get('[data-testid="todo-status"]').should('contain', 'Pending');
      });

      cy.get('[data-testid="todo-item"]').eq(2).within(() => {
        cy.get('[data-testid="todo-title"]').should('contain', 'project report');
        cy.get('[data-testid="todo-due-date"]').should('contain', 'Friday');
      });
      cy.screenshot('agent-todos-auto-created');
    });

    it('should update todo status through natural conversation', () => {
      // Create initial todo
      cy.get('[data-testid="chat-input"]').type('Add a task: Clean the garage{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      cy.get('[data-testid="todos-tab"]').click();
      cy.get('[data-testid="todo-item"]').should('contain', 'Clean the garage');

      // Update todo status through conversation
      cy.get('[data-testid="chat-input"]').type('I started cleaning the garage but got halfway done{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Verify todo was updated to in-progress
      cy.get('[data-testid="todo-status"]').should('contain', 'In Progress');
      cy.get('[data-testid="todo-progress-bar"]').should('have.attr', 'value', '50');
      cy.screenshot('agent-todo-progress-updated');

      // Complete the todo
      cy.get('[data-testid="chat-input"]').type('Finished cleaning the garage completely!{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="todo-status"]').should('contain', 'Completed');
      cy.get('[data-testid="todo-completion-time"]').should('be.visible');
    });

    it('should manage todo priorities and deadlines intelligently', () => {
      cy.get('[data-testid="todos-tab"]').click();

      // Create todos with varying urgency
      const todos = [
        'Submit tax documents by April 15th',
        'Buy birthday gift for mom next week',
        'Eventually learn to play guitar'
      ];

      todos.forEach(todo => {
        cy.get('[data-testid="chat-input"]').type(`I need to: ${todo}{enter}`);
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        cy.wait(1000);
      });

      // Verify intelligent priority assignment
      cy.get('[data-testid="todo-item"]').first().within(() => {
        cy.get('[data-testid="todo-priority"]').should('contain', 'High'); // Tax deadline
      });

      cy.get('[data-testid="todo-item"]').eq(1).within(() => {
        cy.get('[data-testid="todo-priority"]').should('contain', 'Medium'); // Birthday gift
      });

      cy.get('[data-testid="todo-item"]').eq(2).within(() => {
        cy.get('[data-testid="todo-priority"]').should('contain', 'Low'); // Learn guitar
      });
      cy.screenshot('agent-todo-smart-priorities');

      // Test deadline reminders
      cy.get('[data-testid="chat-input"]').type('What do I need to do urgently?{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="urgent-todo-reminder"]').should('contain', 'tax documents');
    });

    it('should break down complex todos into subtasks', () => {
      cy.get('[data-testid="chat-input"]').type('I need to plan and execute a dinner party for 10 people{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Agent should offer to break down the complex task
      cy.get('[data-testid="task-breakdown-suggestion"]').should('be.visible');
      cy.get('[data-testid="accept-breakdown"]').click();

      // Verify subtasks were created
      cy.get('[data-testid="todos-tab"]').click();
      cy.get('[data-testid="parent-todo"]').should('contain', 'dinner party');
      cy.get('[data-testid="subtask-list"]').should('be.visible');
      
      cy.get('[data-testid="subtask-item"]').should('have.length.greaterThan', 3);
      cy.get('[data-testid="subtask-item"]').should('contain.oneOf', ['menu', 'guest list', 'shopping', 'prep']);
      cy.screenshot('agent-todo-breakdown');
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
      cy.get('[data-testid="chat-interface"]', { timeout: 20000 }).should('be.visible');

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
    it('should demonstrate proactive thinking and suggestions', () => {
      cy.get('[data-testid="monologue-tab"]').click();
      
      // Enable autonomy
      cy.get('[data-testid="autonomy-toggle"]').click();
      cy.get('[data-testid="autonomy-status"]').should('contain', 'Active');

      // Provide context for autonomous thinking
      cy.get('[data-testid="chat-input"]').type('I have a big presentation next week but I haven\'t started preparing{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Monitor autonomous thoughts
      cy.get('[data-testid="thought-stream"]', { timeout: 30000 }).should('be.visible');
      cy.get('[data-testid="autonomous-thought"]').should('exist');
      
      // Agent should show proactive thinking about the presentation
      cy.get('[data-testid="thought-content"]').should('contain.oneOf', ['presentation', 'prepare', 'deadline']);
      cy.screenshot('agent-autonomous-thinking');

      // Agent should make proactive suggestions
      cy.get('[data-testid="proactive-suggestion"]', { timeout: 20000 }).should('be.visible');
      cy.get('[data-testid="suggestion-content"]').should('contain.oneOf', ['outline', 'practice', 'slides']);
    });

    it('should autonomously create and manage goals based on context', () => {
      cy.get('[data-testid="autonomy-toggle"]').click();
      
      // Provide challenging scenario
      cy.get('[data-testid="chat-input"]').type('I\'m feeling overwhelmed. I have work deadlines, personal commitments, and I\'m not sleeping well{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Monitor for autonomous goal creation
      cy.get('[data-testid="autonomous-goal-creation"]', { timeout: 30000 }).should('be.visible');
      
      cy.get('[data-testid="goals-tab"]').click();
      
      // Agent should have autonomously created relevant goals
      cy.get('[data-testid="auto-created-goal"]').should('exist');
      cy.get('[data-testid="goal-reasoning"]').should('be.visible');
      cy.screenshot('agent-autonomous-goal-creation');

      // Goals should address multiple aspects of the problem
      cy.get('[data-testid="goal-item"]').should('contain.oneOf', ['sleep', 'stress', 'time management']);
    });

    it('should show contextual awareness and emotional intelligence', () => {
      // Test emotional context recognition
      cy.get('[data-testid="chat-input"]').type('I just lost my job today. I\'m really scared about the future{enter}');
      
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Agent should demonstrate emotional intelligence
      cy.get('[data-testid="emotional-tone-indicator"]').should('contain', 'supportive');
      cy.get('[data-testid="agent-message"]').should('contain.oneOf', ['sorry', 'understand', 'support', 'help']);
      cy.screenshot('agent-emotional-intelligence');

      // Follow-up should maintain appropriate tone
      cy.get('[data-testid="chat-input"]').type('Thanks, that helps a bit{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      // Should offer constructive help without being pushy
      cy.get('[data-testid="agent-message"]').should('contain.oneOf', ['steps', 'plan', 'resources']);
    });

    it('should demonstrate learning and adaptation during session', () => {
      // Establish learning scenario
      cy.get('[data-testid="chat-input"]').type('I prefer very detailed explanations with examples{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Test initial response style
      cy.get('[data-testid="chat-input"]').type('Explain blockchain{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      
      cy.get('[data-testid="agent-message"]').last().invoke('text').then((firstResponse) => {
        const firstLength = firstResponse.length;
        
        // Provide positive feedback
        cy.get('[data-testid="chat-input"]').type('Perfect level of detail, thank you!{enter}');
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

        // Test if style is maintained in next response
        cy.get('[data-testid="chat-input"]').type('Now explain machine learning{enter}');
        cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
        
        cy.get('[data-testid="agent-message"]').last().invoke('text').then((secondResponse) => {
          const secondLength = secondResponse.length;
          // Second response should be similarly detailed
          expect(Math.abs(secondLength - firstLength)).to.be.lessThan(firstLength * 0.5);
        });
      });
      cy.screenshot('agent-style-adaptation');
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