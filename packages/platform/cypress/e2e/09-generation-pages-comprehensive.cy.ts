/**
 * Comprehensive Generation Pages Testing
 * Tests all generation workflows, file handling, and UI interactions
 */

describe('Generation Pages - Comprehensive Testing', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        id: 'generation-user',
        email: 'generation@elizaos.ai',
        first_name: 'Generation',
        last_name: 'Tester',
        role: 'owner',
        organization: {
          id: 'generation-org',
          name: 'Generation Testing Org',
          subscription_tier: 'premium',
          credit_balance: '1000.0',
        },
        permissions: {
          canCreateAgents: true,
          canEditAgents: true,
          canDeleteAgents: true,
          canManageUsers: true,
          canAccessBilling: true,
        },
      },
    }).as('getIdentity');
  });

  it('Generation Studio - Main Page Layout and Navigation', () => {
    cy.log('🎨 Testing Generation Studio Main Page');

    // Mock generation types and capabilities
    cy.intercept('GET', '**/api/generation/capabilities', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          text: { enabled: true, models: ['gpt-4', 'claude-3'] },
          image: { enabled: true, models: ['dall-e-3', 'midjourney'] },
          video: { enabled: true, models: ['runway', 'pika'] },
          audio: { enabled: false, models: [] },
        },
      },
    }).as('getCapabilities');

    cy.visit('/dashboard/generation', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getCapabilities');

    // ==========================================
    // STEP 1: Test Page Structure
    // ==========================================
    cy.log('📄 Step 1: Test Page Structure');

    cy.get('[data-cy="generation-studio-header"]')
      .should('be.visible')
      .and('contain.text', 'Generation Studio');

    cy.get('[data-cy="generation-types-grid"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Generation Type Cards
    // ==========================================
    cy.log('🃏 Step 2: Test Generation Type Cards');

    // Test text generation card
    cy.get('[data-cy="text-generation-card"]')
      .should('be.visible')
      .and('contain.text', 'Text Generation');

    // Test image generation card
    cy.get('[data-cy="image-generation-card"]')
      .should('be.visible')
      .and('contain.text', 'Image Generation');

    // Test video generation card
    cy.get('[data-cy="video-generation-card"]')
      .should('be.visible')
      .and('contain.text', 'Video Generation');

    // ==========================================
    // STEP 3: Test Navigation to Sub-pages
    // ==========================================
    cy.log('🧭 Step 3: Test Navigation to Sub-pages');

    // Test text generation navigation
    cy.get('[data-cy="text-generation-card"]').click();
    cy.url().should('include', '/dashboard/generation/text');

    cy.go('back');

    // Test image generation navigation
    cy.get('[data-cy="image-generation-card"]').click();
    cy.url().should('include', '/dashboard/generation/image');

    cy.go('back');

    // Test video generation navigation
    cy.get('[data-cy="video-generation-card"]').click();
    cy.url().should('include', '/dashboard/generation/video');

    cy.log('✅ Generation Studio Main Page Test Complete!');
  });

  it('Text Generation - Complete Workflow Test', () => {
    cy.log('📝 Testing Text Generation Workflow');

    // Mock text generation API
    cy.intercept('POST', '**/api/generation/text', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'text-gen-123',
          text: 'Generated text content here...',
          model: 'gpt-4',
          tokens: 150,
          cost: '0.03',
          timestamp: new Date().toISOString(),
        },
      },
    }).as('generateText');

    cy.intercept('GET', '**/api/generation/text/history', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          generations: [],
          totalCount: 0,
        },
      },
    }).as('getTextHistory');

    cy.visit('/dashboard/generation/text', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getTextHistory');

    // ==========================================
    // STEP 1: Test Text Generation Interface
    // ==========================================
    cy.log('✍️ Step 1: Test Text Generation Interface');

    cy.get('[data-cy="text-generation-form"]').should('be.visible');
    cy.get('[data-cy="prompt-input"]').should('be.visible');
    cy.get('[data-cy="model-select"]').should('be.visible');
    cy.get('[data-cy="generate-button"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Form Validation
    // ==========================================
    cy.log('✅ Step 2: Test Form Validation');

    // Test empty prompt validation
    cy.get('[data-cy="generate-button"]').click();
    cy.get('[data-cy="prompt-error"]')
      .should('be.visible')
      .and('contain.text', 'Prompt is required');

    // ==========================================
    // STEP 3: Test Text Generation Flow
    // ==========================================
    cy.log('🚀 Step 3: Test Text Generation Flow');

    // Fill in prompt
    cy.get('[data-cy="prompt-input"]').type('Write a short story about AI');

    // Select model
    cy.get('[data-cy="model-select"]').select('gpt-4');

    // Generate text
    cy.get('[data-cy="generate-button"]').click();

    // Should show loading state
    cy.get('[data-cy="generation-loading"]').should('be.visible');

    cy.wait('@generateText');

    // Should show results
    cy.get('[data-cy="generation-result"]')
      .should('be.visible')
      .and('contain.text', 'Generated text content here...');

    // ==========================================
    // STEP 4: Test Result Actions
    // ==========================================
    cy.log('📋 Step 4: Test Result Actions');

    // Test copy button
    cy.get('[data-cy="copy-result-button"]').should('be.visible').click();
    cy.get('[data-cy="copy-success-message"]').should('be.visible');

    // Test save button
    cy.get('[data-cy="save-result-button"]').should('be.visible').click();
    cy.get('[data-cy="save-success-message"]').should('be.visible');

    // ==========================================
    // STEP 5: Test Generation History
    // ==========================================
    cy.log('📚 Step 5: Test Generation History');

    cy.get('[data-cy="generation-history"]').should('be.visible');
    cy.get('[data-cy="history-item"]').should('have.length.greaterThan', 0);

    cy.log('✅ Text Generation Workflow Test Complete!');
  });

  it('Image Generation - Complete Workflow Test', () => {
    cy.log('🖼️ Testing Image Generation Workflow');

    // Mock image generation API
    cy.intercept('POST', '**/api/generation/image', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'image-gen-123',
          url: 'https://example.com/generated-image.jpg',
          prompt: 'A beautiful landscape',
          model: 'dall-e-3',
          size: '1024x1024',
          cost: '0.04',
          timestamp: new Date().toISOString(),
        },
      },
    }).as('generateImage');

    cy.intercept('GET', '**/api/generation/image/history', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          generations: [],
          totalCount: 0,
        },
      },
    }).as('getImageHistory');

    cy.visit('/dashboard/generation/image', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getImageHistory');

    // ==========================================
    // STEP 1: Test Image Generation Interface
    // ==========================================
    cy.log('🎨 Step 1: Test Image Generation Interface');

    cy.get('[data-cy="image-generation-form"]').should('be.visible');
    cy.get('[data-cy="image-prompt-input"]').should('be.visible');
    cy.get('[data-cy="image-model-select"]').should('be.visible');
    cy.get('[data-cy="image-size-select"]').should('be.visible');
    cy.get('[data-cy="generate-image-button"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Advanced Settings
    // ==========================================
    cy.log('⚙️ Step 2: Test Advanced Settings');

    cy.get('[data-cy="advanced-settings-toggle"]').click();
    cy.get('[data-cy="style-preset-select"]').should('be.visible');
    cy.get('[data-cy="quality-slider"]').should('be.visible');
    cy.get('[data-cy="steps-input"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Image Generation Flow
    // ==========================================
    cy.log('🚀 Step 3: Test Image Generation Flow');

    // Fill in prompt
    cy.get('[data-cy="image-prompt-input"]').type(
      'A beautiful mountain landscape at sunset',
    );

    // Select size
    cy.get('[data-cy="image-size-select"]').select('1024x1024');

    // Generate image
    cy.get('[data-cy="generate-image-button"]').click();

    // Should show loading with progress
    cy.get('[data-cy="image-generation-loading"]').should('be.visible');
    cy.get('[data-cy="generation-progress"]').should('be.visible');

    cy.wait('@generateImage');

    // Should show generated image
    cy.get('[data-cy="generated-image"]').should('be.visible');
    cy.get('[data-cy="generated-image"] img').should('have.attr', 'src');

    // ==========================================
    // STEP 4: Test Image Actions
    // ==========================================
    cy.log('📸 Step 4: Test Image Actions');

    // Test download button
    cy.get('[data-cy="download-image-button"]').should('be.visible');

    // Test share button
    cy.get('[data-cy="share-image-button"]').should('be.visible').click();
    cy.get('[data-cy="share-modal"]').should('be.visible');
    cy.get('[data-cy="share-modal-close"]').click();

    // Test variations button
    cy.get('[data-cy="generate-variations-button"]').should('be.visible');

    cy.log('✅ Image Generation Workflow Test Complete!');
  });

  it('Video Generation - Complete Workflow Test', () => {
    cy.log('🎥 Testing Video Generation Workflow');

    // Mock video generation API
    cy.intercept('POST', '**/api/generation/video', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'video-gen-123',
          status: 'processing',
          prompt: 'A flowing river through a forest',
          model: 'runway',
          duration: 5,
          cost: '0.25',
        },
      },
    }).as('generateVideo');

    cy.intercept('GET', '**/api/generation/video/status/video-gen-123', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'video-gen-123',
          status: 'completed',
          url: 'https://example.com/generated-video.mp4',
          thumbnail: 'https://example.com/thumbnail.jpg',
        },
      },
    }).as('getVideoStatus');

    cy.visit('/dashboard/generation/video', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Video Generation Interface
    // ==========================================
    cy.log('📹 Step 1: Test Video Generation Interface');

    cy.get('[data-cy="video-generation-form"]').should('be.visible');
    cy.get('[data-cy="video-prompt-input"]').should('be.visible');
    cy.get('[data-cy="video-duration-slider"]').should('be.visible');
    cy.get('[data-cy="video-model-select"]').should('be.visible');

    // ==========================================
    // STEP 2: Test File Upload for Reference
    // ==========================================
    cy.log('📁 Step 2: Test File Upload for Reference');

    cy.get('[data-cy="reference-image-upload"]').should('be.visible');

    // Test drag and drop area
    cy.get('[data-cy="upload-dropzone"]')
      .should('be.visible')
      .and('contain.text', 'Drag and drop');

    // ==========================================
    // STEP 3: Test Video Generation Flow
    // ==========================================
    cy.log('🎬 Step 3: Test Video Generation Flow');

    // Fill in prompt
    cy.get('[data-cy="video-prompt-input"]').type(
      'A peaceful river flowing through a green forest',
    );

    // Set duration
    cy.get('[data-cy="video-duration-slider"]')
      .invoke('val', 5)
      .trigger('input');

    // Generate video
    cy.get('[data-cy="generate-video-button"]').click();

    cy.wait('@generateVideo');

    // Should show processing status
    cy.get('[data-cy="video-processing-status"]')
      .should('be.visible')
      .and('contain.text', 'Processing');

    // ==========================================
    // STEP 4: Test Status Polling
    // ==========================================
    cy.log('⏱️ Step 4: Test Status Polling');

    // Should poll for status updates
    cy.wait('@getVideoStatus');

    // Should show completed video
    cy.get('[data-cy="generated-video"]').should('be.visible');
    cy.get('[data-cy="video-player"]').should('be.visible');

    // ==========================================
    // STEP 5: Test Video Controls
    // ==========================================
    cy.log('🎮 Step 5: Test Video Controls');

    // Test play button
    cy.get('[data-cy="video-play-button"]').should('be.visible');

    // Test download button
    cy.get('[data-cy="download-video-button"]').should('be.visible');

    // Test share button
    cy.get('[data-cy="share-video-button"]').should('be.visible');

    cy.log('✅ Video Generation Workflow Test Complete!');
  });

  it('Generation - Cost Tracking and Billing Test', () => {
    cy.log('💰 Testing Generation Cost Tracking');

    // Mock billing and usage data
    cy.intercept('GET', '**/api/generation/usage', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          todayUsage: { cost: '12.45', requests: 25 },
          monthlyUsage: { cost: '234.56', requests: 450 },
          remainingCredits: '765.44',
        },
      },
    }).as('getUsage');

    cy.visit('/dashboard/generation/text', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getUsage');

    // ==========================================
    // STEP 1: Test Usage Display
    // ==========================================
    cy.log('📊 Step 1: Test Usage Display');

    cy.get('[data-cy="usage-widget"]').should('be.visible');
    cy.get('[data-cy="today-cost"]').should('contain.text', '$12.45');
    cy.get('[data-cy="monthly-cost"]').should('contain.text', '$234.56');
    cy.get('[data-cy="remaining-credits"]').should('contain.text', '$765.44');

    // ==========================================
    // STEP 2: Test Cost Estimation
    // ==========================================
    cy.log('💵 Step 2: Test Cost Estimation');

    // Should show estimated cost before generation
    cy.get('[data-cy="prompt-input"]').type('Test prompt for cost estimation');
    cy.get('[data-cy="estimated-cost"]')
      .should('be.visible')
      .and('contain.text', '$');

    // ==========================================
    // STEP 3: Test Low Credit Warning
    // ==========================================
    cy.log('⚠️ Step 3: Test Low Credit Warning');

    // Mock low credits scenario
    cy.intercept('GET', '**/api/generation/usage', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          todayUsage: { cost: '12.45', requests: 25 },
          monthlyUsage: { cost: '234.56', requests: 450 },
          remainingCredits: '5.44', // Low credits
        },
      },
    }).as('getLowCredits');

    cy.reload();
    cy.wait('@getLowCredits');

    // Should show low credit warning
    cy.get('[data-cy="low-credits-warning"]')
      .should('be.visible')
      .and('contain.text', 'Low credits');

    cy.log('✅ Cost Tracking Test Complete!');
  });

  it('Generation - Error Handling and Recovery Test', () => {
    cy.log('❌ Testing Generation Error Handling');

    cy.visit('/dashboard/generation/text', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test API Error Handling
    // ==========================================
    cy.log('🚨 Step 1: Test API Error Handling');

    // Mock generation API error
    cy.intercept('POST', '**/api/generation/text', {
      statusCode: 500,
      body: {
        success: false,
        error: 'Generation service temporarily unavailable',
      },
    }).as('generateTextError');

    cy.get('[data-cy="prompt-input"]').type('Test prompt for error handling');
    cy.get('[data-cy="generate-button"]').click();

    cy.wait('@generateTextError');

    // Should show error message
    cy.get('[data-cy="generation-error"]')
      .should('be.visible')
      .and('contain.text', 'Generation service temporarily unavailable');

    // ==========================================
    // STEP 2: Test Retry Functionality
    // ==========================================
    cy.log('🔄 Step 2: Test Retry Functionality');

    cy.get('[data-cy="retry-generation-button"]').should('be.visible').click();

    // Should retry the request
    cy.wait('@generateTextError');

    // ==========================================
    // STEP 3: Test Network Error Handling
    // ==========================================
    cy.log('🌐 Step 3: Test Network Error Handling');

    // Mock network error
    cy.intercept('POST', '**/api/generation/text', {
      forceNetworkError: true,
    }).as('networkError');

    cy.get('[data-cy="retry-generation-button"]').click();
    cy.wait('@networkError');

    // Should show network error message
    cy.get('[data-cy="network-error"]')
      .should('be.visible')
      .and('contain.text', 'Network error');

    // ==========================================
    // STEP 4: Test Timeout Handling
    // ==========================================
    cy.log('⏰ Step 4: Test Timeout Handling');

    // Mock timeout error
    cy.intercept('POST', '**/api/generation/text', {
      statusCode: 408,
      body: { success: false, error: 'Request timeout' },
    }).as('timeoutError');

    cy.get('[data-cy="retry-generation-button"]').click();
    cy.wait('@timeoutError');

    // Should show timeout message
    cy.get('[data-cy="timeout-error"]')
      .should('be.visible')
      .and('contain.text', 'timeout');

    cy.log('✅ Error Handling Test Complete!');
  });

  it('Generation - Responsive Design Test', () => {
    cy.log('📱 Testing Generation Pages Responsive Design');

    cy.visit('/dashboard/generation/text', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Desktop Layout
    // ==========================================
    cy.log('🖥️ Step 1: Test Desktop Layout');

    cy.viewport(1920, 1080);

    cy.get('[data-cy="text-generation-form"]').should('be.visible');
    cy.get('[data-cy="generation-history"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Tablet Layout
    // ==========================================
    cy.log('📱 Step 2: Test Tablet Layout');

    cy.viewport(768, 1024);

    // Form should adapt to tablet
    cy.get('[data-cy="text-generation-form"]').should('be.visible');
    cy.get('[data-cy="prompt-input"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Mobile Layout
    // ==========================================
    cy.log('📱 Step 3: Test Mobile Layout');

    cy.viewport(375, 812);

    // Should work on mobile
    cy.get('[data-cy="text-generation-form"]').should('be.visible');
    cy.get('[data-cy="prompt-input"]').should('be.visible');

    // History might be collapsed or hidden on mobile
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="generation-history"]').length > 0) {
        cy.get('[data-cy="generation-history"]').should('be.visible');
      }
    });

    cy.log('✅ Responsive Design Test Complete!');
  });
});
