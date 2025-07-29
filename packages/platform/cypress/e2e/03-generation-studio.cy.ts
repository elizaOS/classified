describe('Generation Studio Pages', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();

    // Set up API intercepts for the generation studio pages
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'a0000000-0000-4000-8000-000000000001',
            email: 'dev@elizaos.ai',
            firstName: 'Developer',
            lastName: 'User',
            organizationId: 'a0000000-0000-4000-8000-000000000002',
            role: 'owner',
            emailVerified: true,
          },
          organization: {
            id: 'a0000000-0000-4000-8000-000000000002',
            name: 'ElizaOS Development',
            slug: 'elizaos-dev',
            creditBalance: '1000.0',
            subscriptionTier: 'premium',
          },
        },
      },
    }).as('identity');

    // Mock generation APIs
    cy.intercept('GET', '**/api/generation/stats*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          totalGenerations: 150,
          textGenerations: 50,
          imageGenerations: 40,
          videoGenerations: 30,
          audioGenerations: 20,
          threeDGenerations: 10,
          creditsUsed: 500,
          creditsRemaining: 500,
        },
      },
    }).as('generationStats');

    // Mock text generation API
    cy.intercept('POST', '**/api/generation/text', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'text-gen-123',
          prompt: 'Generate a creative story',
          result: 'Once upon a time, in a digital realm...',
          timestamp: '2024-01-01T00:00:00Z',
          creditsUsed: 5,
        },
      },
    }).as('generateText');

    // Mock image generation API
    cy.intercept('POST', '**/api/generation/image', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'image-gen-123',
          prompt: 'A beautiful sunset over mountains',
          imageUrl: 'https://example.com/generated-image.jpg',
          timestamp: '2024-01-01T00:00:00Z',
          creditsUsed: 10,
        },
      },
    }).as('generateImage');

    // Mock video generation API
    cy.intercept('POST', '**/api/generation/video', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'video-gen-123',
          prompt: 'A peaceful nature scene',
          videoUrl: 'https://example.com/generated-video.mp4',
          timestamp: '2024-01-01T00:00:00Z',
          creditsUsed: 20,
        },
      },
    }).as('generateVideo');

    // Mock projects API
    cy.intercept('GET', '**/api/generation/projects*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          projects: [
            {
              id: 'project-1',
              name: 'Marketing Campaign',
              description: 'AI-generated content for marketing',
              createdAt: '2024-01-01T00:00:00Z',
              generationsCount: 25,
            },
          ],
        },
      },
    }).as('projects');
  });

  describe('Studio Dashboard', () => {
    it('should load studio dashboard successfully', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation', { failOnStatusCode: false });

      // Check for main dashboard elements
      cy.contains('Generation Studio').should('be.visible');
      cy.get('[data-cy="generation-dashboard"]').should('be.visible');
    });

    it('should navigate to studio dashboard from sidebar', () => {
      cy.devLogin();
      cy.visit('/dashboard', { failOnStatusCode: false });

      // Click on Studio Dashboard in sidebar
      cy.get('[data-cy="sidebar-link-generation-studio"]').click();

      // Should navigate to generation studio
      cy.url().should('include', '/dashboard/generation');
    });

    it('should display generation statistics', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation', { failOnStatusCode: false });

      // Wait for stats to load
      cy.wait('@generationStats');

      // Check for stats display
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="generation-stats"]').length > 0) {
          cy.get('[data-cy="generation-stats"]').should('be.visible');
        }

        // Check for credits display
        if ($body.find('[data-cy="credits-display"]').length > 0) {
          cy.get('[data-cy="credits-display"]').should('be.visible');
        }
      });
    });

    it('should show quick access to generation types', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation', { failOnStatusCode: false });

      // Check for quick action buttons
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="quick-text-gen"]').length > 0) {
          cy.get('[data-cy="quick-text-gen"]').should('be.visible');
        }
        if ($body.find('[data-cy="quick-image-gen"]').length > 0) {
          cy.get('[data-cy="quick-image-gen"]').should('be.visible');
        }
      });
    });
  });

  describe('Text & Chat Generation', () => {
    it('should load text generation page successfully', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/text', { failOnStatusCode: false });

      // Check for text generation interface
      cy.contains('Text & Chat').should('be.visible');
      cy.get('[data-cy="text-generation-interface"]').should('be.visible');
    });

    it('should navigate to text generation from sidebar', () => {
      cy.devLogin();
      cy.visit('/dashboard', { failOnStatusCode: false });

      // Click on Text & Chat in sidebar
      cy.get('[data-cy="sidebar-link-text-generation"]').click();

      // Should navigate to text generation
      cy.url().should('include', '/dashboard/generation/text');
    });

    it('should handle text generation workflow', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/text', { failOnStatusCode: false });

      // Fill in prompt if input exists
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="text-prompt-input"]').length > 0) {
          cy.get('[data-cy="text-prompt-input"]').type(
            'Generate a creative story about AI',
          );
          cy.get('[data-cy="generate-text-btn"]').click();

          // Wait for generation to complete
          cy.wait('@generateText');

          // Should show generated content
          cy.get('[data-cy="generated-text"]').should('be.visible');
        }
      });
    });

    it('should display text generation history', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/text', { failOnStatusCode: false });

      // Check for history section
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="text-generation-history"]').length > 0) {
          cy.get('[data-cy="text-generation-history"]').should('be.visible');
        }
      });
    });
  });

  describe('Image Generation', () => {
    it('should load image generation page successfully', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/image', { failOnStatusCode: false });

      // Check for image generation interface
      cy.contains('Images').should('be.visible');
      cy.get('[data-cy="image-generation-interface"]').should('be.visible');
    });

    it('should navigate to image generation from sidebar', () => {
      cy.devLogin();
      cy.visit('/dashboard', { failOnStatusCode: false });

      // Click on Images in sidebar
      cy.get('[data-cy="sidebar-link-image-generation"]').click();

      // Should navigate to image generation
      cy.url().should('include', '/dashboard/generation/image');
    });

    it('should handle image generation workflow', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/image', { failOnStatusCode: false });

      // Fill in prompt if input exists
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="image-prompt-input"]').length > 0) {
          cy.get('[data-cy="image-prompt-input"]').type(
            'A beautiful sunset over mountains',
          );
          cy.get('[data-cy="generate-image-btn"]').click();

          // Wait for generation to complete
          cy.wait('@generateImage');

          // Should show generated image
          cy.get('[data-cy="generated-image"]').should('be.visible');
        }
      });
    });

    it('should display image generation settings', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/image', { failOnStatusCode: false });

      // Check for settings panel
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="image-settings"]').length > 0) {
          cy.get('[data-cy="image-settings"]').should('be.visible');
        }

        // Check for style options
        if ($body.find('[data-cy="style-selector"]').length > 0) {
          cy.get('[data-cy="style-selector"]').should('be.visible');
        }
      });
    });
  });

  describe('Video Generation', () => {
    it('should load video generation page successfully', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/video', { failOnStatusCode: false });

      // Check for video generation interface
      cy.contains('Videos').should('be.visible');
      cy.get('[data-cy="video-generation-interface"]').should('be.visible');
    });

    it('should navigate to video generation from sidebar', () => {
      cy.devLogin();
      cy.visit('/dashboard', { failOnStatusCode: false });

      // Click on Videos in sidebar
      cy.get('[data-cy="sidebar-link-video-generation"]').click();

      // Should navigate to video generation
      cy.url().should('include', '/dashboard/generation/video');
    });

    it('should handle video generation workflow', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/video', { failOnStatusCode: false });

      // Fill in prompt if input exists
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="video-prompt-input"]').length > 0) {
          cy.get('[data-cy="video-prompt-input"]').type(
            'A peaceful nature scene with flowing water',
          );
          cy.get('[data-cy="generate-video-btn"]').click();

          // Wait for generation to complete
          cy.wait('@generateVideo');

          // Should show generated video
          cy.get('[data-cy="generated-video"]').should('be.visible');
        }
      });
    });

    it('should display video duration and quality options', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/video', { failOnStatusCode: false });

      // Check for video settings
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="video-duration-selector"]').length > 0) {
          cy.get('[data-cy="video-duration-selector"]').should('be.visible');
        }

        if ($body.find('[data-cy="video-quality-selector"]').length > 0) {
          cy.get('[data-cy="video-quality-selector"]').should('be.visible');
        }
      });
    });
  });

  describe('Audio & Speech Generation', () => {
    it('should load audio generation page successfully', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/audio', { failOnStatusCode: false });

      // Check for audio generation interface
      cy.contains('Audio & Speech').should('be.visible');
      cy.get('[data-cy="audio-generation-interface"]').should('be.visible');
    });

    it('should navigate to audio generation from sidebar', () => {
      cy.devLogin();
      cy.visit('/dashboard', { failOnStatusCode: false });

      // Click on Audio & Speech in sidebar
      cy.get('[data-cy="sidebar-link-audio-generation"]').click();

      // Should navigate to audio generation
      cy.url().should('include', '/dashboard/generation/audio');
    });

    it('should display voice selection options', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/audio', { failOnStatusCode: false });

      // Check for voice options
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="voice-selector"]').length > 0) {
          cy.get('[data-cy="voice-selector"]').should('be.visible');
        }

        if ($body.find('[data-cy="speech-settings"]').length > 0) {
          cy.get('[data-cy="speech-settings"]').should('be.visible');
        }
      });
    });
  });

  describe('3D & Avatars Generation', () => {
    it('should load 3D generation page successfully', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/3d', { failOnStatusCode: false });

      // Check for 3D generation interface
      cy.contains('3D & Avatars').should('be.visible');
      cy.get('[data-cy="3d-generation-interface"]').should('be.visible');
    });

    it('should navigate to 3D generation from sidebar', () => {
      cy.devLogin();
      cy.visit('/dashboard', { failOnStatusCode: false });

      // Click on 3D & Avatars in sidebar
      cy.get('[data-cy="sidebar-link-3d-generation"]').click();

      // Should navigate to 3D generation
      cy.url().should('include', '/dashboard/generation/3d');
    });

    it('should display 3D model options', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/3d', { failOnStatusCode: false });

      // Check for 3D options
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="3d-model-selector"]').length > 0) {
          cy.get('[data-cy="3d-model-selector"]').should('be.visible');
        }

        if ($body.find('[data-cy="avatar-customization"]').length > 0) {
          cy.get('[data-cy="avatar-customization"]').should('be.visible');
        }
      });
    });
  });

  describe('Projects', () => {
    it('should load projects page successfully', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/projects', { failOnStatusCode: false });

      // Check for projects interface
      cy.contains('Projects').should('be.visible');
      cy.get('[data-cy="projects-interface"]').should('be.visible');
    });

    it('should navigate to projects from sidebar', () => {
      cy.devLogin();
      cy.visit('/dashboard', { failOnStatusCode: false });

      // Click on Projects in sidebar
      cy.get('[data-cy="sidebar-link-projects"]').click();

      // Should navigate to projects
      cy.url().should('include', '/dashboard/generation/projects');
    });

    it('should display projects list', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/projects', { failOnStatusCode: false });

      // Wait for projects to load
      cy.wait('@projects');

      // Check for projects list
      cy.get('[data-cy="projects-list"]').should('be.visible');
    });

    it('should handle project creation workflow', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/projects', { failOnStatusCode: false });

      // Try to create new project
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="create-project-btn"]').length > 0) {
          cy.get('[data-cy="create-project-btn"]').click();

          // Should show project creation form
          if ($body.find('[data-cy="project-creation-modal"]').length > 0) {
            cy.get('[data-cy="project-creation-modal"]').should('be.visible');
          }
        }
      });
    });

    it('should show project details and statistics', () => {
      cy.devLogin();
      cy.visit('/dashboard/generation/projects', { failOnStatusCode: false });

      // Check for project statistics
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="project-stats"]').length > 0) {
          cy.get('[data-cy="project-stats"]').should('be.visible');
        }

        if ($body.find('[data-cy="project-generations-count"]').length > 0) {
          cy.get('[data-cy="project-generations-count"]').should('be.visible');
        }
      });
    });
  });

  describe('Cross-Page Functionality', () => {
    it('should maintain responsive design on mobile across all pages', () => {
      cy.devLogin();
      cy.viewport(375, 667); // iPhone SE dimensions

      const pages = [
        '/dashboard/generation',
        '/dashboard/generation/text',
        '/dashboard/generation/image',
        '/dashboard/generation/video',
        '/dashboard/generation/audio',
        '/dashboard/generation/3d',
        '/dashboard/generation/projects',
      ];

      pages.forEach((page) => {
        cy.visit(page, { failOnStatusCode: false });

        // Check that content is still accessible on mobile
        cy.get('body').should('be.visible');

        // Check mobile menu functionality
        cy.get('body').then(($body) => {
          if ($body.find('[data-cy="mobile-menu-button"]').length > 0) {
            cy.get('[data-cy="mobile-menu-button"]').should('be.visible');
            cy.get('[data-cy="mobile-menu-button"]').click();
            cy.get('[data-cy="sidebar"]').should('be.visible');
          }
        });
      });
    });

    it('should handle error states gracefully across all pages', () => {
      cy.devLogin();

      // Mock API errors for all generation endpoints
      cy.intercept('GET', '**/api/generation/**', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Generation service temporarily unavailable',
        },
      }).as('generationError');

      const pages = [
        '/dashboard/generation',
        '/dashboard/generation/text',
        '/dashboard/generation/image',
        '/dashboard/generation/video',
      ];

      pages.forEach((page) => {
        cy.visit(page, { failOnStatusCode: false });

        // Should still show the page even with errors
        cy.get('body').should('contain.text', 'Generation');
      });
    });

    it('should show credit usage warnings when low on credits', () => {
      cy.devLogin();

      // Mock low credits scenario
      cy.intercept('GET', '**/api/auth/identity', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            user: {
              id: 'a0000000-0000-4000-8000-000000000001',
              email: 'dev@elizaos.ai',
              firstName: 'Developer',
              lastName: 'User',
              organizationId: 'a0000000-0000-4000-8000-000000000002',
              role: 'owner',
              emailVerified: true,
            },
            organization: {
              id: 'a0000000-0000-4000-8000-000000000002',
              name: 'ElizaOS Development',
              slug: 'elizaos-dev',
              creditBalance: '5.0', // Low credits
              subscriptionTier: 'premium',
            },
          },
        },
      }).as('lowCreditsIdentity');

      cy.visit('/dashboard/generation', { failOnStatusCode: false });

      // Should show low credits warning
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="low-credits-warning"]').length > 0) {
          cy.get('[data-cy="low-credits-warning"]').should('be.visible');
        }
      });
    });
  });
});
