describe('Character Chat - Complete Test Suite', () => {
  beforeEach(() => {
    // Set up authenticated user state
    cy.window().then((win) => {
      win.localStorage.setItem('auth-token', 'mock-token');
    });

    // Mock authenticated user check
    cy.intercept('GET', '**/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-id',
          email: 'test@elizaos.ai',
          name: 'Test User',
        },
      },
    }).as('authCheck');

    // Mock character data
    cy.intercept('GET', '**/characters', {
      statusCode: 200,
      body: {
        characters: [
          {
            id: 'char-1',
            name: 'Support Assistant',
            description: 'Helpful customer support agent',
            status: 'active',
            avatar: '/avatars/support.png',
            lastActive: '2024-01-01T00:00:00Z',
          },
          {
            id: 'char-2',
            name: 'Code Helper',
            description: 'Programming assistant',
            status: 'active',
            avatar: '/avatars/code.png',
            lastActive: '2024-01-01T01:00:00Z',
          },
        ],
      },
    }).as('charactersList');

    // Mock individual character data
    cy.intercept('GET', '**/characters/char-1', {
      statusCode: 200,
      body: {
        id: 'char-1',
        name: 'Support Assistant',
        description: 'Helpful customer support agent',
        status: 'active',
        avatar: '/avatars/support.png',
        settings: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
        },
        systemPrompt: 'You are a helpful customer support assistant.',
      },
    }).as('characterDetails');

    // Mock conversation data
    cy.intercept('GET', '**/characters/char-1/conversations', {
      statusCode: 200,
      body: {
        conversations: [
          {
            id: 'conv-1',
            title: 'How to reset password',
            lastMessage: 'Thank you for your help!',
            updatedAt: '2024-01-01T00:00:00Z',
            messageCount: 5,
          },
          {
            id: 'conv-2',
            title: 'Billing question',
            lastMessage: 'I need help with my bill',
            updatedAt: '2024-01-01T01:00:00Z',
            messageCount: 3,
          },
        ],
      },
    }).as('conversations');

    // Mock messages for a conversation
    cy.intercept('GET', '**/characters/char-1/conversations/conv-1/messages', {
      statusCode: 200,
      body: {
        messages: [
          {
            id: 'msg-1',
            text: 'Hello, I need help resetting my password',
            sender: 'user',
            timestamp: '2024-01-01T00:00:00Z',
          },
          {
            id: 'msg-2',
            text: "I'd be happy to help you reset your password. What email address is associated with your account?",
            sender: 'assistant',
            timestamp: '2024-01-01T00:01:00Z',
          },
          {
            id: 'msg-3',
            text: "It's user@example.com",
            sender: 'user',
            timestamp: '2024-01-01T00:02:00Z',
          },
        ],
      },
    }).as('conversationMessages');
  });

  describe('Characters List Page', () => {
    beforeEach(() => {
      cy.visit('/characters');
      cy.wait(['@authCheck', '@charactersList']);
    });

    it('should display characters list correctly', () => {
      cy.url().should('include', '/characters');

      // Check page title
      cy.contains('Characters').should('be.visible');

      // Check characters are displayed
      cy.contains('Support Assistant').should('be.visible');
      cy.contains('Code Helper').should('be.visible');

      // Check character details
      cy.contains('Helpful customer support agent').should('be.visible');
      cy.contains('Programming assistant').should('be.visible');

      // Check status indicators
      cy.get('[data-character-id="char-1"]').within(() => {
        cy.get('[data-cy="status-indicator"]')
          .should('have.class', 'bg-green-500')
          .or('contain.text', 'Active');
      });
    });

    it('should handle character avatars', () => {
      // Check avatars are displayed
      cy.get('[data-character-id="char-1"]').within(() => {
        cy.get('img[alt*="Support Assistant"]')
          .should('be.visible')
          .and('have.attr', 'src')
          .and('include', 'support.png');
      });

      cy.get('[data-character-id="char-2"]').within(() => {
        cy.get('img[alt*="Code Helper"]')
          .should('be.visible')
          .and('have.attr', 'src')
          .and('include', 'code.png');
      });
    });

    it('should handle character chat navigation', () => {
      // Click on a character to start chat
      cy.get('[data-character-id="char-1"]').click();
      cy.url().should('include', '/characters/chat/char-1');
    });

    it('should handle character search and filtering', () => {
      // Test search functionality
      cy.get('input[placeholder*="Search characters"]').type('Support');
      cy.contains('Support Assistant').should('be.visible');
      cy.contains('Code Helper').should('not.exist');

      // Clear search
      cy.get('input[placeholder*="Search characters"]').clear();
      cy.contains('Code Helper').should('be.visible');
    });

    it('should handle create character button', () => {
      cy.get('button')
        .contains('Create Character')
        .should('be.visible')
        .click();
      cy.url().should('include', '/characters/create');
    });
  });

  describe('Character Chat Interface', () => {
    beforeEach(() => {
      cy.visit('/characters/chat/char-1');
      cy.wait(['@authCheck', '@characterDetails', '@conversations']);
    });

    it('should display chat interface correctly', () => {
      cy.url().should('include', '/characters/chat/char-1');

      // Check character info
      cy.contains('Support Assistant').should('be.visible');
      cy.contains('Helpful customer support agent').should('be.visible');

      // Check chat input
      cy.get('textarea[placeholder*="Type your message"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');

      // Check conversations sidebar
      cy.contains('Conversations').should('be.visible');
      cy.contains('How to reset password').should('be.visible');
      cy.contains('Billing question').should('be.visible');
    });

    it('should handle conversation selection', () => {
      // Click on a conversation
      cy.get('[data-conversation-id="conv-1"]').click();
      cy.wait('@conversationMessages');

      // Should display conversation messages
      cy.contains('Hello, I need help resetting my password').should(
        'be.visible',
      );
      cy.contains("I'd be happy to help you reset your password").should(
        'be.visible',
      );
      cy.contains("It's user@example.com").should('be.visible');
    });

    it('should handle sending new messages', () => {
      // Start new conversation
      cy.get('button').contains('New Conversation').click();

      // Type and send message
      const testMessage = 'Hello, can you help me with my account?';
      cy.get('textarea[placeholder*="Type your message"]').type(testMessage);

      // Mock message sending API
      cy.intercept('POST', '**/characters/char-1/conversations/*/messages', {
        statusCode: 201,
        body: {
          id: 'msg-new',
          text: testMessage,
          sender: 'user',
          timestamp: new Date().toISOString(),
        },
      }).as('sendMessage');

      // Mock assistant response
      cy.intercept('GET', '**/characters/char-1/conversations/*/messages', {
        statusCode: 200,
        body: {
          messages: [
            {
              id: 'msg-new',
              text: testMessage,
              sender: 'user',
              timestamp: new Date().toISOString(),
            },
            {
              id: 'msg-response',
              text: "Hello! I'd be happy to help you with your account. What specific issue are you experiencing?",
              sender: 'assistant',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      }).as('updatedMessages');

      cy.get('button[type="submit"]').click();
      cy.wait('@sendMessage');

      // Should display the sent message
      cy.contains(testMessage).should('be.visible');

      // Should show typing indicator
      cy.get('[data-cy="typing-indicator"]').should('be.visible');
      cy.contains('Support Assistant is typing...').should('be.visible');

      // Wait for response
      cy.wait('@updatedMessages');
      cy.contains("Hello! I'd be happy to help you").should('be.visible');
    });

    it('should handle message formatting and markdown', () => {
      // Mock conversation with formatted messages
      cy.intercept(
        'GET',
        '**/characters/char-1/conversations/conv-formatted/messages',
        {
          statusCode: 200,
          body: {
            messages: [
              {
                id: 'msg-formatted',
                text: 'Here\'s some **bold text** and *italic text*:\n\n```javascript\nconsole.log("Hello world");\n```\n\n- Item 1\n- Item 2',
                sender: 'assistant',
                timestamp: new Date().toISOString(),
              },
            ],
          },
        },
      ).as('formattedMessages');

      cy.visit('/characters/chat/char-1?conversation=conv-formatted');
      cy.wait('@formattedMessages');

      // Should render markdown
      cy.get('strong').contains('bold text').should('be.visible');
      cy.get('em').contains('italic text').should('be.visible');
      cy.get('code').contains('console.log').should('be.visible');
      cy.get('ul li').should('have.length', 2);
    });

    it('should handle file attachments', () => {
      // Test file upload
      cy.get('[data-cy="file-upload"]').should('be.visible');

      // Mock file upload
      const fileName = 'test-document.pdf';
      cy.fixture('test-file.pdf', 'base64').then((fileContent) => {
        cy.get('input[type="file"]').attachFile({
          fileContent,
          fileName,
          mimeType: 'application/pdf',
          encoding: 'base64',
        });
      });

      // Mock file upload API
      cy.intercept('POST', '**/storage/upload', {
        statusCode: 200,
        body: {
          id: 'file-123',
          filename: fileName,
          url: '/files/file-123.pdf',
        },
      }).as('uploadFile');

      cy.wait('@uploadFile');

      // Should show file attachment in message
      cy.contains(fileName).should('be.visible');
      cy.get('[data-cy="file-attachment"]').should('be.visible');
    });

    it('should handle voice messages', () => {
      // Check voice recording button
      cy.get('[data-cy="voice-record"]').should('be.visible');

      // Mock voice recording (can't actually test microphone in Cypress)
      cy.get('[data-cy="voice-record"]').click();

      // Should show recording interface
      cy.get('[data-cy="recording-interface"]').should('be.visible');
      cy.contains('Recording...').should('be.visible');

      // Mock stop recording
      cy.get('[data-cy="stop-recording"]').click();

      // Mock transcription API
      cy.intercept('POST', '**/transcribe', {
        statusCode: 200,
        body: {
          text: 'This is a transcribed voice message',
        },
      }).as('transcribeVoice');

      cy.wait('@transcribeVoice');

      // Should populate message input with transcription
      cy.get('textarea[placeholder*="Type your message"]').should(
        'have.value',
        'This is a transcribed voice message',
      );
    });
  });

  describe('Character Management', () => {
    beforeEach(() => {
      cy.visit('/characters/create');
      cy.wait('@authCheck');
    });

    it('should display character creation form', () => {
      cy.url().should('include', '/characters/create');

      // Check form fields
      cy.get('input[name="name"]').should('be.visible');
      cy.get('textarea[name="description"]').should('be.visible');
      cy.get('textarea[name="systemPrompt"]').should('be.visible');
      cy.get('select[name="model"]').should('be.visible');
      cy.get('input[name="temperature"]').should('be.visible');

      // Check create button
      cy.get('button[type="submit"]')
        .contains('Create Character')
        .should('be.visible');
    });

    it('should validate character creation form', () => {
      // Submit empty form
      cy.get('button[type="submit"]').click();

      // Should show validation errors
      cy.contains('Name is required')
        .should('be.visible')
        .or(cy.get('input[name="name"]:invalid').should('exist'));

      cy.contains('Description is required')
        .should('be.visible')
        .or(cy.get('textarea[name="description"]:invalid').should('exist'));
    });

    it('should handle character creation', () => {
      // Fill out form
      cy.get('input[name="name"]').type('Test Character');
      cy.get('textarea[name="description"]').type(
        'A test character for Cypress testing',
      );
      cy.get('textarea[name="systemPrompt"]').type(
        'You are a helpful test assistant.',
      );
      cy.get('select[name="model"]').select('gpt-4');
      cy.get('input[name="temperature"]').clear().type('0.8');

      // Upload avatar
      cy.get('input[type="file"][accept="image/*"]').attachFile('avatar.png');

      // Mock creation API
      cy.intercept('POST', '**/characters', {
        statusCode: 201,
        body: {
          id: 'char-new',
          name: 'Test Character',
          status: 'active',
        },
      }).as('createCharacter');

      cy.get('button[type="submit"]').click();
      cy.wait('@createCharacter');

      // Should redirect to character chat
      cy.url().should('include', '/characters/chat/char-new');
      cy.contains('Character created successfully').should('be.visible');
    });

    it('should handle character editing', () => {
      // Navigate to edit existing character
      cy.visit('/characters/char-1/edit');
      cy.wait(['@authCheck', '@characterDetails']);

      // Should populate form with existing data
      cy.get('input[name="name"]').should('have.value', 'Support Assistant');
      cy.get('textarea[name="description"]').should(
        'contain.value',
        'Helpful customer support agent',
      );

      // Make changes
      cy.get('input[name="name"]').clear().type('Updated Support Assistant');
      cy.get('input[name="temperature"]').clear().type('0.9');

      // Mock update API
      cy.intercept('PUT', '**/characters/char-1', {
        statusCode: 200,
        body: { success: true },
      }).as('updateCharacter');

      cy.get('button[type="submit"]').click();
      cy.wait('@updateCharacter');

      cy.contains('Character updated successfully').should('be.visible');
    });
  });

  describe('Conversation Management', () => {
    beforeEach(() => {
      cy.visit('/characters/chat/char-1');
      cy.wait(['@authCheck', '@characterDetails', '@conversations']);
    });

    it('should handle conversation renaming', () => {
      // Right-click on conversation
      cy.get('[data-conversation-id="conv-1"]').rightclick();

      // Select rename option
      cy.get('[data-cy="context-menu"]').within(() => {
        cy.contains('Rename').click();
      });

      // Edit title
      cy.get('input[value="How to reset password"]')
        .clear()
        .type('Password Reset Help');

      // Mock rename API
      cy.intercept('PUT', '**/characters/char-1/conversations/conv-1', {
        statusCode: 200,
        body: { success: true },
      }).as('renameConversation');

      cy.get('button').contains('Save').click();
      cy.wait('@renameConversation');

      cy.contains('Password Reset Help').should('be.visible');
    });

    it('should handle conversation deletion', () => {
      // Right-click on conversation
      cy.get('[data-conversation-id="conv-2"]').rightclick();

      // Select delete option
      cy.get('[data-cy="context-menu"]').within(() => {
        cy.contains('Delete').click();
      });

      // Confirm deletion
      cy.get('[data-cy="confirm-delete"]').click();

      // Mock delete API
      cy.intercept('DELETE', '**/characters/char-1/conversations/conv-2', {
        statusCode: 200,
        body: { success: true },
      }).as('deleteConversation');

      cy.wait('@deleteConversation');

      // Conversation should be removed
      cy.contains('Billing question').should('not.exist');
    });

    it('should handle conversation export', () => {
      // Right-click on conversation
      cy.get('[data-conversation-id="conv-1"]').rightclick();

      // Select export option
      cy.get('[data-cy="context-menu"]').within(() => {
        cy.contains('Export').click();
      });

      // Choose export format
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.get('select[name="format"]').select('json');
        cy.get('button').contains('Export').click();
      });

      // Mock export API
      cy.intercept('GET', '**/characters/char-1/conversations/conv-1/export*', {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
          'content-disposition':
            'attachment; filename=conversation-conv-1.json',
        },
        body: { conversation: 'exported data' },
      }).as('exportConversation');

      cy.wait('@exportConversation');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle character offline status', () => {
      // Mock offline character
      cy.intercept('GET', '**/characters/char-1', {
        statusCode: 200,
        body: {
          id: 'char-1',
          name: 'Support Assistant',
          status: 'offline',
        },
      }).as('offlineCharacter');

      cy.visit('/characters/chat/char-1');
      cy.wait(['@authCheck', '@offlineCharacter']);

      // Should show offline status
      cy.contains('Offline').should('be.visible');
      cy.get('textarea[placeholder*="Type your message"]').should(
        'be.disabled',
      );
      cy.contains('This character is currently offline').should('be.visible');
    });

    it('should handle message sending failures', () => {
      cy.visit('/characters/chat/char-1');
      cy.wait(['@authCheck', '@characterDetails']);

      cy.get('textarea[placeholder*="Type your message"]').type('Test message');

      // Mock send failure
      cy.intercept('POST', '**/characters/char-1/conversations/*/messages', {
        statusCode: 500,
        body: { error: 'Failed to send message' },
      }).as('sendFailure');

      cy.get('button[type="submit"]').click();
      cy.wait('@sendFailure');

      // Should show error and retry option
      cy.contains('Failed to send message').should('be.visible');
      cy.get('button').contains('Retry').should('be.visible');
    });

    it('should handle long conversations with pagination', () => {
      // Mock large conversation
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        text: `Message ${i}`,
        sender: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
      }));

      cy.intercept(
        'GET',
        '**/characters/char-1/conversations/conv-long/messages*',
        {
          statusCode: 200,
          body: {
            messages: messages.slice(0, 50),
            hasMore: true,
            nextCursor: 'cursor-50',
          },
        },
      ).as('paginatedMessages');

      cy.visit('/characters/chat/char-1?conversation=conv-long');
      cy.wait('@paginatedMessages');

      // Should show load more button
      cy.get('button').contains('Load More').should('be.visible');

      // Mock loading more messages
      cy.intercept(
        'GET',
        '**/characters/char-1/conversations/conv-long/messages?cursor=cursor-50',
        {
          statusCode: 200,
          body: {
            messages: messages.slice(50, 100),
            hasMore: false,
          },
        },
      ).as('moreMessages');

      cy.get('button').contains('Load More').click();
      cy.wait('@moreMessages');

      // Should load additional messages
      cy.contains('Message 75').should('be.visible');
    });
  });

  describe('Responsive Design and Accessibility', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.visit('/characters/chat/char-1');
      cy.wait(['@authCheck', '@characterDetails', '@conversations']);

      // Should show mobile layout
      cy.get('[data-cy="mobile-chat-header"]').should('be.visible');
      cy.get('textarea[placeholder*="Type your message"]').should('be.visible');

      // Conversations sidebar should be collapsible
      cy.get('[data-cy="toggle-conversations"]').click();
      cy.get('[data-cy="conversations-sidebar"]').should('be.visible');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/characters/chat/char-1');
      cy.wait(['@authCheck', '@characterDetails', '@conversations']);

      // Should be able to navigate conversations with keyboard
      cy.get('[data-conversation-id="conv-1"]').focus();
      cy.focused().should('contain', 'How to reset password');

      // Should be able to focus message input
      cy.get('textarea[placeholder*="Type your message"]')
        .focus()
        .should('be.focused');
    });

    it('should have proper ARIA labels and screen reader support', () => {
      cy.visit('/characters/chat/char-1');
      cy.wait(['@authCheck', '@characterDetails', '@conversations']);

      // Chat interface should have proper labeling
      cy.get('[role="main"]').should('exist');
      cy.get('[aria-label*="conversation"]').should('exist');

      // Messages should have proper structure
      cy.get('[data-conversation-id="conv-1"]').click();
      cy.wait('@conversationMessages');

      cy.get('[role="log"]').should('exist'); // Message history
      cy.get('[aria-label*="message from"]').should('exist');
    });
  });
});
