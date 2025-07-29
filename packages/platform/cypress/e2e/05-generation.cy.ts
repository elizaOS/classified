describe('AI Generation - Complete Test Suite', () => {
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
          credits: 1000,
        },
      },
    }).as('authCheck');

    // Mock generation history
    cy.intercept('GET', '**/generation', {
      statusCode: 200,
      body: {
        generations: [
          {
            id: 'gen-1',
            type: 'text',
            prompt: 'Write a blog post about AI',
            status: 'completed',
            createdAt: '2024-01-01T00:00:00Z',
            creditsUsed: 50,
          },
          {
            id: 'gen-2',
            type: 'image',
            prompt: 'A futuristic city',
            status: 'in_progress',
            createdAt: '2024-01-01T01:00:00Z',
            creditsUsed: 100,
          },
        ],
      },
    }).as('generationHistory');
  });

  describe('Generation Dashboard', () => {
    beforeEach(() => {
      cy.visit('/dashboard/generation');
      cy.wait(['@authCheck', '@generationHistory']);
    });

    it('should display generation dashboard correctly', () => {
      cy.url().should('include', '/dashboard/generation');

      // Check page title and navigation
      cy.contains('AI Generation').should('be.visible');

      // Check generation type buttons
      cy.get('button').contains('Text Generation').should('be.visible');
      cy.get('button').contains('Image Generation').should('be.visible');
      cy.get('button').contains('Video Generation').should('be.visible');

      // Check credits display
      cy.contains('1,000 credits').should('be.visible');
    });

    it('should display generation history', () => {
      // Check history section
      cy.contains('Recent Generations').should('be.visible');

      // Check individual generations
      cy.contains('Write a blog post about AI').should('be.visible');
      cy.contains('A futuristic city').should('be.visible');

      // Check status indicators
      cy.contains('completed').should('be.visible');
      cy.contains('in_progress').should('be.visible');

      // Check credits used
      cy.contains('50 credits').should('be.visible');
      cy.contains('100 credits').should('be.visible');
    });

    it('should handle generation type navigation', () => {
      // Navigate to text generation
      cy.get('button').contains('Text Generation').click();
      cy.url().should('include', '/dashboard/generation/text');

      // Navigate to image generation
      cy.visit('/dashboard/generation');
      cy.get('button').contains('Image Generation').click();
      cy.url().should('include', '/dashboard/generation/image');

      // Navigate to video generation
      cy.visit('/dashboard/generation');
      cy.get('button').contains('Video Generation').click();
      cy.url().should('include', '/dashboard/generation/video');
    });
  });

  describe('Text Generation', () => {
    beforeEach(() => {
      cy.visit('/dashboard/generation/text');
      cy.wait('@authCheck');
    });

    it('should display text generation interface', () => {
      cy.url().should('include', '/dashboard/generation/text');

      // Check form elements
      cy.get('textarea[name="prompt"]').should('be.visible');
      cy.get('select[name="model"]').should('be.visible');
      cy.get('input[name="maxTokens"]').should('be.visible');
      cy.get('input[name="temperature"]').should('be.visible');

      // Check generate button
      cy.get('button[type="submit"]').contains('Generate').should('be.visible');
    });

    it('should validate text generation form', () => {
      // Submit empty form
      cy.get('button[type="submit"]').click();

      // Should show validation error
      cy.contains('Prompt is required')
        .should('be.visible')
        .or(cy.get('textarea[name="prompt"]:invalid').should('exist'));
    });

    it('should handle text generation request', () => {
      // Fill out form
      cy.get('textarea[name="prompt"]').type(
        'Write a short story about a robot',
      );
      cy.get('select[name="model"]').select('gpt-4');
      cy.get('input[name="maxTokens"]').clear().type('500');
      cy.get('input[name="temperature"]').clear().type('0.7');

      // Mock generation API
      cy.intercept('POST', '**/generation', {
        statusCode: 201,
        body: {
          id: 'gen-new',
          status: 'in_progress',
          estimatedCredits: 75,
        },
      }).as('createGeneration');

      // Mock real-time updates
      cy.intercept('GET', '**/generation/gen-new', {
        statusCode: 200,
        body: {
          id: 'gen-new',
          status: 'completed',
          result: 'Once upon a time, there was a robot named...',
          creditsUsed: 73,
        },
      }).as('generationStatus');

      cy.get('button[type="submit"]').click();
      cy.wait('@createGeneration');

      // Should show generation in progress
      cy.contains('Generating...').should('be.visible');
      cy.contains('Estimated: 75 credits').should('be.visible');

      // Wait for completion
      cy.wait('@generationStatus');
      cy.contains('Once upon a time, there was a robot named...').should(
        'be.visible',
      );
      cy.contains('Used: 73 credits').should('be.visible');
    });

    it('should handle advanced text generation options', () => {
      // Toggle advanced options
      cy.get('button').contains('Advanced Options').click();

      // Check advanced fields are visible
      cy.get('input[name="topP"]').should('be.visible');
      cy.get('input[name="frequencyPenalty"]').should('be.visible');
      cy.get('input[name="presencePenalty"]').should('be.visible');
      cy.get('textarea[name="systemPrompt"]').should('be.visible');

      // Test advanced configuration
      cy.get('input[name="topP"]').clear().type('0.9');
      cy.get('textarea[name="systemPrompt"]').type(
        'You are a creative writer.',
      );

      // Generate with advanced options
      cy.get('textarea[name="prompt"]').type('Write a poem about space');

      cy.intercept('POST', '**/generation', {
        statusCode: 201,
        body: { id: 'gen-advanced', status: 'in_progress' },
      }).as('advancedGeneration');

      cy.get('button[type="submit"]').click();
      cy.wait('@advancedGeneration');
    });
  });

  describe('Image Generation', () => {
    beforeEach(() => {
      cy.visit('/dashboard/generation/image');
      cy.wait('@authCheck');
    });

    it('should display image generation interface', () => {
      cy.url().should('include', '/dashboard/generation/image');

      // Check form elements
      cy.get('textarea[name="prompt"]').should('be.visible');
      cy.get('select[name="model"]').should('be.visible');
      cy.get('select[name="size"]').should('be.visible');
      cy.get('select[name="quality"]').should('be.visible');
      cy.get('input[name="count"]').should('be.visible');

      // Check generate button
      cy.get('button[type="submit"]')
        .contains('Generate Images')
        .should('be.visible');
    });

    it('should handle image generation request', () => {
      // Fill out form
      cy.get('textarea[name="prompt"]').type(
        'A beautiful sunset over mountains',
      );
      cy.get('select[name="model"]').select('dall-e-3');
      cy.get('select[name="size"]').select('1024x1024');
      cy.get('select[name="quality"]').select('hd');
      cy.get('input[name="count"]').clear().type('2');

      // Mock image generation API
      cy.intercept('POST', '**/generation', {
        statusCode: 201,
        body: {
          id: 'img-gen-1',
          status: 'in_progress',
          estimatedCredits: 200,
        },
      }).as('createImageGeneration');

      // Mock completion
      cy.intercept('GET', '**/generation/img-gen-1', {
        statusCode: 200,
        body: {
          id: 'img-gen-1',
          status: 'completed',
          result: {
            images: [
              {
                url: 'https://example.com/image1.jpg',
                filename: 'sunset1.jpg',
              },
              {
                url: 'https://example.com/image2.jpg',
                filename: 'sunset2.jpg',
              },
            ],
          },
          creditsUsed: 195,
        },
      }).as('imageGenerationComplete');

      cy.get('button[type="submit"]').click();
      cy.wait('@createImageGeneration');

      // Should show progress
      cy.contains('Generating images...').should('be.visible');
      cy.contains('Estimated: 200 credits').should('be.visible');

      // Wait for completion
      cy.wait('@imageGenerationComplete');

      // Should display generated images
      cy.get('img[alt="Generated image"]').should('have.length', 2);
      cy.contains('sunset1.jpg').should('be.visible');
      cy.contains('sunset2.jpg').should('be.visible');
    });

    it('should handle image download and sharing', () => {
      // Mock completed generation
      cy.intercept('GET', '**/generation/img-gen-1', {
        statusCode: 200,
        body: {
          id: 'img-gen-1',
          status: 'completed',
          result: {
            images: [
              {
                url: 'https://example.com/image1.jpg',
                filename: 'sunset1.jpg',
              },
            ],
          },
        },
      }).as('imageData');

      cy.visit('/dashboard/generation/image?id=img-gen-1');
      cy.wait(['@authCheck', '@imageData']);

      // Test download button
      cy.get('button').contains('Download').should('be.visible').click();

      // Test share button
      cy.get('button').contains('Share').should('be.visible').click();
      cy.get('[data-cy="share-modal"]').should('be.visible');
      cy.contains('Copy Link').should('be.visible');
    });
  });

  describe('Video Generation', () => {
    beforeEach(() => {
      cy.visit('/dashboard/generation/video');
      cy.wait('@authCheck');
    });

    it('should display video generation interface', () => {
      cy.url().should('include', '/dashboard/generation/video');

      // Check form elements
      cy.get('textarea[name="prompt"]').should('be.visible');
      cy.get('select[name="duration"]').should('be.visible');
      cy.get('select[name="resolution"]').should('be.visible');
      cy.get('select[name="style"]').should('be.visible');

      // Check generate button
      cy.get('button[type="submit"]')
        .contains('Generate Video')
        .should('be.visible');
    });

    it('should handle video generation request', () => {
      // Fill out form
      cy.get('textarea[name="prompt"]').type(
        'A cat playing with a ball of yarn',
      );
      cy.get('select[name="duration"]').select('10');
      cy.get('select[name="resolution"]').select('720p');
      cy.get('select[name="style"]').select('realistic');

      // Mock video generation API
      cy.intercept('POST', '**/generation', {
        statusCode: 201,
        body: {
          id: 'video-gen-1',
          status: 'in_progress',
          estimatedCredits: 500,
          estimatedTime: '5-10 minutes',
        },
      }).as('createVideoGeneration');

      cy.get('button[type="submit"]').click();
      cy.wait('@createVideoGeneration');

      // Should show progress with time estimate
      cy.contains('Generating video...').should('be.visible');
      cy.contains('Estimated: 500 credits').should('be.visible');
      cy.contains('5-10 minutes').should('be.visible');
    });

    it('should handle video generation progress tracking', () => {
      // Mock progress updates
      cy.intercept('GET', '**/generation/video-gen-1', {
        statusCode: 200,
        body: {
          id: 'video-gen-1',
          status: 'in_progress',
          progress: 45,
          currentStep: 'Rendering frames',
        },
      }).as('videoProgress');

      cy.visit('/dashboard/generation/video?id=video-gen-1');
      cy.wait(['@authCheck', '@videoProgress']);

      // Should show progress bar and current step
      cy.get('[data-cy="progress-bar"]').should('be.visible');
      cy.contains('45%').should('be.visible');
      cy.contains('Rendering frames').should('be.visible');
    });
  });

  describe('Generation Management', () => {
    it('should handle generation cancellation', () => {
      // Mock in-progress generation
      cy.intercept('GET', '**/generation/gen-1', {
        statusCode: 200,
        body: {
          id: 'gen-1',
          status: 'in_progress',
          progress: 30,
        },
      }).as('inProgressGeneration');

      cy.visit('/dashboard/generation?id=gen-1');
      cy.wait(['@authCheck', '@inProgressGeneration']);

      // Mock cancellation API
      cy.intercept('POST', '**/generation/gen-1/cancel', {
        statusCode: 200,
        body: { success: true },
      }).as('cancelGeneration');

      cy.get('button').contains('Cancel').click();
      cy.get('[data-cy="confirm-cancel"]').click();
      cy.wait('@cancelGeneration');

      cy.contains('Generation cancelled').should('be.visible');
    });

    it('should handle generation retry for failed generations', () => {
      // Mock failed generation
      cy.intercept('GET', '**/generation/gen-failed', {
        statusCode: 200,
        body: {
          id: 'gen-failed',
          status: 'failed',
          error: 'Content policy violation',
        },
      }).as('failedGeneration');

      cy.visit('/dashboard/generation?id=gen-failed');
      cy.wait(['@authCheck', '@failedGeneration']);

      // Should show error and retry option
      cy.contains('Content policy violation').should('be.visible');
      cy.get('button').contains('Retry').should('be.visible');

      // Mock retry API
      cy.intercept('POST', '**/generation/gen-failed/retry', {
        statusCode: 201,
        body: { id: 'gen-retry', status: 'in_progress' },
      }).as('retryGeneration');

      cy.get('button').contains('Retry').click();
      cy.wait('@retryGeneration');
    });

    it('should handle bulk generation operations', () => {
      cy.visit('/dashboard/generation');
      cy.wait(['@authCheck', '@generationHistory']);

      // Select multiple generations
      cy.get('[data-cy="generation-checkbox"]').first().check();
      cy.get('[data-cy="generation-checkbox"]').last().check();

      // Bulk actions should appear
      cy.get('[data-cy="bulk-actions"]').should('be.visible');
      cy.get('button').contains('Delete Selected').should('be.visible');
      cy.get('button').contains('Export Selected').should('be.visible');

      // Test bulk delete
      cy.intercept('DELETE', '**/generation/bulk', {
        statusCode: 200,
        body: { deleted: 2 },
      }).as('bulkDelete');

      cy.get('button').contains('Delete Selected').click();
      cy.get('[data-cy="confirm-bulk-delete"]').click();
      cy.wait('@bulkDelete');

      cy.contains('2 generations deleted').should('be.visible');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle insufficient credits', () => {
      // Mock user with low credits
      cy.intercept('GET', '**/auth/identity', {
        statusCode: 200,
        body: {
          user: {
            id: 'test-user-id',
            email: 'test@elizaos.ai',
            credits: 10,
          },
        },
      }).as('lowCreditsUser');

      cy.visit('/dashboard/generation/text');
      cy.wait('@lowCreditsUser');

      // Should show low credits warning
      cy.contains('Low credits').should('be.visible');
      cy.contains('Add Credits').should('be.visible');

      // Try to generate with insufficient credits
      cy.get('textarea[name="prompt"]').type('Long generation prompt');

      cy.intercept('POST', '**/generation', {
        statusCode: 402,
        body: { error: 'Insufficient credits', required: 100, available: 10 },
      }).as('insufficientCredits');

      cy.get('button[type="submit"]').click();
      cy.wait('@insufficientCredits');

      cy.contains('Insufficient credits').should('be.visible');
      cy.contains('Add Credits').should('be.visible');
    });

    it('should handle generation failures gracefully', () => {
      cy.visit('/dashboard/generation/text');
      cy.wait('@authCheck');

      cy.get('textarea[name="prompt"]').type('Test prompt');

      // Mock generation failure
      cy.intercept('POST', '**/generation', {
        statusCode: 500,
        body: { error: 'Service temporarily unavailable' },
      }).as('generationFailure');

      cy.get('button[type="submit"]').click();
      cy.wait('@generationFailure');

      // Should show error message
      cy.contains('Service temporarily unavailable').should('be.visible');
      cy.get('button').contains('Try Again').should('be.visible');
    });

    it('should handle network disconnection during generation', () => {
      cy.visit('/dashboard/generation/text');
      cy.wait('@authCheck');

      cy.get('textarea[name="prompt"]').type('Test prompt');

      // Mock network failure
      cy.intercept('POST', '**/generation', { forceNetworkError: true }).as(
        'networkError',
      );

      cy.get('button[type="submit"]').click();
      cy.wait('@networkError');

      // Should show network error
      cy.contains('Network error')
        .should('be.visible')
        .or(cy.contains('Connection lost').should('be.visible'));
    });
  });

  describe('Responsive Design and Accessibility', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.visit('/dashboard/generation');
      cy.wait(['@authCheck', '@generationHistory']);

      // Generation types should be accessible
      cy.get('button').contains('Text Generation').should('be.visible');

      // History should be stacked vertically
      cy.contains('Write a blog post about AI').should('be.visible');
      cy.contains('A futuristic city').should('be.visible');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/dashboard/generation/text');
      cy.wait('@authCheck');

      // Should be able to tab through form
      cy.get('textarea[name="prompt"]').focus().tab();
      cy.focused().should('have.attr', 'name', 'model');

      cy.tab();
      cy.focused().should('have.attr', 'name', 'maxTokens');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/dashboard/generation/text');
      cy.wait('@authCheck');

      // Form fields should have labels
      cy.get('textarea[name="prompt"]')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'placeholder');

      // Generate button should have proper labeling
      cy.get('button[type="submit"]')
        .should('contain.text', 'Generate')
        .or('have.attr', 'aria-label');
    });
  });
});
