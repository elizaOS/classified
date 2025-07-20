/// <reference types="cypress" />

describe('Comprehensive UI Component Testing', () => {
  beforeEach(() => {
    // Skip boot sequence for UI testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    cy.visit('/', { timeout: 15000 });
    
    // Wait for main interface to load
    cy.get('[data-testid="chat-interface"]', { timeout: 20000 }).should('be.visible');
  });

  describe('Main Navigation Tabs', () => {
    it('should navigate through all main tabs and verify content', () => {
      const tabs = [
        { testId: 'goals-tab', label: 'GOALS', contentCheck: 'goals-content' },
        { testId: 'todos-tab', label: 'TODOS', contentCheck: 'todos-content' },
        { testId: 'monologue-tab', label: 'MONOLOGUE', contentCheck: 'monologue-content' },
        { testId: 'files-tab', label: 'FILES', contentCheck: 'files-content' },
        { testId: 'config-tab', label: 'CONFIG', contentCheck: 'config-content' }
      ];

      tabs.forEach((tab, index) => {
        cy.get(`[data-testid="${tab.testId}"]`).should('be.visible').click();
        cy.get(`[data-testid="${tab.testId}"]`).should('have.class', 'active');
        cy.get(`[data-testid="${tab.contentCheck}"]`).should('be.visible');
        cy.screenshot(`ui-tab-${index + 1}-${tab.label.toLowerCase()}`);
        
        // Verify tab content is properly rendered
        cy.get(`[data-testid="${tab.contentCheck}"]`).should('not.be.empty');
      });

      // Test tab keyboard navigation
      cy.get('[data-testid="goals-tab"]').focus().type('{rightarrow}');
      cy.get('[data-testid="todos-tab"]').should('have.focus');
    });

    it('should maintain tab state during interactions', () => {
      // Start on goals tab
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');

      // Interact with chat, then verify tab state maintained
      cy.get('[data-testid="chat-input"]').type('Hello agent{enter}');
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.get('[data-testid="goals-tab"]').should('have.class', 'active');
    });
  });

  describe('Chat Interface Components', () => {
    it('should test all chat interface elements', () => {
      // Test chat input area
      cy.get('[data-testid="chat-input"]').should('be.visible');
      cy.get('[data-testid="chat-send-button"]').should('be.visible');
      cy.get('[data-testid="chat-messages"]').should('be.visible');

      // Test message input functionality
      cy.get('[data-testid="chat-input"]').type('Test message');
      cy.get('[data-testid="chat-send-button"]').should('not.be.disabled');
      cy.get('[data-testid="chat-send-button"]').click();

      // Verify message appears in chat
      cy.get('[data-testid="chat-messages"]').should('contain', 'Test message');
      cy.screenshot('ui-chat-message-sent');

      // Test voice input button if available
      cy.get('[data-testid="voice-input-button"]').then(($button) => {
        if ($button.length) {
          cy.wrap($button).should('be.visible').click();
          cy.get('[data-testid="voice-recording-indicator"]').should('be.visible');
          cy.wrap($button).click(); // Stop recording
        }
      });

      // Test chat scroll functionality
      // Send multiple messages to test scrolling
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="chat-input"]').type(`Message ${i + 1}{enter}`);
        cy.wait(100);
      }
      
      cy.get('[data-testid="chat-messages"]').scrollTo('top');
      cy.get('[data-testid="chat-messages"]').scrollTo('bottom');
    });

    it('should test chat message interactions', () => {
      // Send a message
      cy.get('[data-testid="chat-input"]').type('Test message interaction{enter}');
      
      // Wait for agent response
      cy.get('[data-testid="agent-message"]', { timeout: 10000 }).should('be.visible');

      // Test message copy functionality
      cy.get('[data-testid="message-actions"]').first().should('be.visible');
      cy.get('[data-testid="copy-message-button"]').first().click();
      cy.contains('Copied').should('be.visible');

      // Test message timestamps
      cy.get('[data-testid="message-timestamp"]').should('be.visible');
    });
  });

  describe('Control Buttons and Toggles', () => {
    it('should test autonomy control buttons', () => {
      // Test autonomy toggle
      cy.get('[data-testid="autonomy-toggle"]').should('be.visible');
      
      // Get initial state
      cy.get('[data-testid="autonomy-toggle"]').then(($toggle) => {
        const initialState = $toggle.attr('aria-checked');
        
        // Toggle autonomy
        cy.wrap($toggle).click();
        cy.get('[data-testid="autonomy-toggle"]').should('have.attr', 'aria-checked', 
          initialState === 'true' ? 'false' : 'true');
        
        // Verify status indicator updates
        if (initialState === 'false') {
          cy.get('[data-testid="autonomy-status"]').should('contain', 'Active');
        } else {
          cy.get('[data-testid="autonomy-status"]').should('contain', 'Paused');
        }
      });

      cy.screenshot('ui-autonomy-controls');
    });

    it('should test all capability control buttons', () => {
      cy.get('[data-testid="config-tab"]').click();

      const capabilities = [
        { testId: 'microphone-toggle', label: 'Microphone' },
        { testId: 'speaker-toggle', label: 'Speakers' },
        { testId: 'camera-toggle', label: 'Camera' },
        { testId: 'screen-toggle', label: 'Screen Capture' },
        { testId: 'shell-toggle', label: 'Shell Access' },
        { testId: 'browser-toggle', label: 'Browser Access' },
        { testId: 'coding-toggle', label: 'Autonomous Coding' }
      ];

      capabilities.forEach((capability, index) => {
        cy.get(`[data-testid="${capability.testId}"]`).should('be.visible');
        
        // Test toggle functionality
        cy.get(`[data-testid="${capability.testId}"]`).then(($toggle) => {
          const initialState = $toggle.attr('aria-checked');
          cy.wrap($toggle).click();
          
          // Verify state changed
          cy.get(`[data-testid="${capability.testId}"]`)
            .should('have.attr', 'aria-checked', initialState === 'true' ? 'false' : 'true');
          
          // Verify visual feedback
          cy.get(`[data-testid="${capability.testId}-status"]`)
            .should('be.visible');
        });

        if (index === 3) {
          cy.screenshot('ui-capability-controls');
        }
      });
    });

    it('should test reset and clear buttons', () => {
      // Test reset button
      cy.get('[data-testid="reset-button"]').should('be.visible').click();
      
      // Should show confirmation modal
      cy.get('[data-testid="reset-confirmation-modal"]').should('be.visible');
      cy.get('[data-testid="confirm-reset-button"]').should('be.visible');
      cy.get('[data-testid="cancel-reset-button"]').should('be.visible');
      cy.screenshot('ui-reset-confirmation-modal');
      
      // Test cancel
      cy.get('[data-testid="cancel-reset-button"]').click();
      cy.get('[data-testid="reset-confirmation-modal"]').should('not.exist');

      // Test clear chat button
      cy.get('[data-testid="clear-chat-button"]').should('be.visible').click();
      cy.get('[data-testid="chat-messages"]').should('be.empty');
    });
  });

  describe('Modal Dialogs and Overlays', () => {
    it('should test settings modal', () => {
      cy.get('[data-testid="settings-button"]').should('be.visible').click();
      
      // Verify settings modal opens
      cy.get('[data-testid="settings-modal"]').should('be.visible');
      cy.get('[data-testid="settings-modal-header"]').should('contain', 'Settings');
      cy.screenshot('ui-settings-modal');

      // Test settings tabs
      cy.get('[data-testid="general-settings-tab"]').should('be.visible').click();
      cy.get('[data-testid="general-settings-content"]').should('be.visible');
      
      cy.get('[data-testid="api-settings-tab"]').should('be.visible').click();
      cy.get('[data-testid="api-settings-content"]').should('be.visible');
      
      cy.get('[data-testid="advanced-settings-tab"]').should('be.visible').click();
      cy.get('[data-testid="advanced-settings-content"]').should('be.visible');

      // Test close modal
      cy.get('[data-testid="close-settings-button"]').click();
      cy.get('[data-testid="settings-modal"]').should('not.exist');
    });

    it('should test help modal', () => {
      cy.get('[data-testid="help-button"]').should('be.visible').click();
      
      cy.get('[data-testid="help-modal"]').should('be.visible');
      cy.get('[data-testid="help-content"]').should('be.visible');
      cy.screenshot('ui-help-modal');

      // Test help sections navigation
      cy.get('[data-testid="getting-started-section"]').should('be.visible').click();
      cy.get('[data-testid="shortcuts-section"]').should('be.visible').click();
      cy.get('[data-testid="troubleshooting-section"]').should('be.visible').click();

      // Test close with escape key
      cy.get('[data-testid="help-modal"]').type('{esc}');
      cy.get('[data-testid="help-modal"]').should('not.exist');
    });

    it('should test notification overlays', () => {
      // Trigger a notification (e.g., by enabling a capability)
      cy.get('[data-testid="config-tab"]').click();
      cy.get('[data-testid="microphone-toggle"]').click();
      
      // Should show notification
      cy.get('[data-testid="notification-overlay"]').should('be.visible');
      cy.get('[data-testid="notification-message"]').should('contain', 'Microphone');
      cy.screenshot('ui-notification-overlay');

      // Notification should auto-dismiss
      cy.get('[data-testid="notification-overlay"]', { timeout: 5000 }).should('not.exist');
    });
  });

  describe('File Management Interface', () => {
    it('should test file upload and management UI', () => {
      cy.get('[data-testid="files-tab"]').click();
      
      // Test file upload area
      cy.get('[data-testid="file-upload-area"]').should('be.visible');
      cy.get('[data-testid="file-upload-button"]').should('be.visible');
      cy.screenshot('ui-file-upload-interface');

      // Test file list display
      cy.get('[data-testid="file-list"]').should('be.visible');

      // Test file upload (using a fixture file)
      const fileName = 'test-document.txt';
      cy.fixture(fileName).then(fileContent => {
        cy.get('[data-testid="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'text/plain'
        }, { force: true });
      });

      // Verify file appears in list
      cy.get('[data-testid="file-item"]').should('contain', fileName);
      cy.get('[data-testid="file-delete-button"]').should('be.visible');
      cy.screenshot('ui-file-uploaded');

      // Test file search
      cy.get('[data-testid="file-search-input"]').type('test');
      cy.get('[data-testid="file-item"]').should('contain', fileName);
      
      // Test file deletion
      cy.get('[data-testid="file-delete-button"]').first().click();
      cy.get('[data-testid="delete-confirmation-modal"]').should('be.visible');
      cy.get('[data-testid="confirm-delete-button"]').click();
      cy.get('[data-testid="file-item"]').should('not.contain', fileName);
    });
  });

  describe('Mobile and Responsive UI', () => {
    it('should test mobile menu functionality', () => {
      cy.viewport('iphone-x');
      cy.reload();
      
      cy.get('[data-testid="chat-interface"]', { timeout: 20000 }).should('be.visible');

      // Test mobile menu toggle
      cy.get('[data-testid="mobile-menu-button"]').should('be.visible').click();
      cy.get('[data-testid="mobile-menu-overlay"]').should('be.visible');
      cy.screenshot('ui-mobile-menu-open');

      // Test mobile navigation
      cy.get('[data-testid="mobile-goals-link"]').should('be.visible').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');
      cy.get('[data-testid="mobile-menu-overlay"]').should('not.exist');

      // Reset viewport
      cy.viewport(1280, 720);
    });

    it('should test responsive layout adjustments', () => {
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
        { width: 768, height: 1024 },
        { width: 375, height: 667 }
      ];

      viewports.forEach((viewport, index) => {
        cy.viewport(viewport.width, viewport.height);
        cy.reload();
        cy.get('[data-testid="chat-interface"]', { timeout: 20000 }).should('be.visible');
        
        // Verify main elements are visible and properly sized
        cy.get('[data-testid="chat-messages"]').should('be.visible');
        cy.get('[data-testid="chat-input"]').should('be.visible');
        
        cy.screenshot(`ui-responsive-${viewport.width}x${viewport.height}`);
      });
    });
  });

  describe('Accessibility and Keyboard Navigation', () => {
    it('should test keyboard navigation through interface', () => {
      // Test tab navigation
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'chat-input');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'goals-tab');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'todos-tab');

      // Test enter key on focusable elements
      cy.get('[data-testid="todos-tab"]').focus().type('{enter}');
      cy.get('[data-testid="todos-content"]').should('be.visible');
    });

    it('should test screen reader accessibility', () => {
      // Test ARIA labels and roles
      cy.get('[data-testid="autonomy-toggle"]').should('have.attr', 'role', 'switch');
      cy.get('[data-testid="autonomy-toggle"]').should('have.attr', 'aria-label');
      
      cy.get('[data-testid="chat-input"]').should('have.attr', 'aria-label');
      cy.get('[data-testid="chat-messages"]').should('have.attr', 'role', 'log');

      // Test focus indicators
      cy.get('[data-testid="goals-tab"]').focus();
      cy.get('[data-testid="goals-tab"]').should('have.css', 'outline-width');
    });
  });

  afterEach(() => {
    cy.screenshot('ui-test-complete');
  });
});