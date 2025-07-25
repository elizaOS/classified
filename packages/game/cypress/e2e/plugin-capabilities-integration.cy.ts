/// <reference types="cypress" />

describe('Plugin Capabilities Integration Testing', () => {
  beforeEach(() => {
    // Skip boot sequence for capability testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
    cy.visit('/', { timeout: 15000 });

    // Wait for main interface and ensure config tab is accessible
    cy.get('[data-testid="game-interface"]', { timeout: 20000 }).should('be.visible');
    cy.get('[data-testid="config-tab"]').click();
  });

  describe('Shell Access Capability', () => {
    it('should enable shell access and validate functionality', () => {
      // Enable shell capability
      cy.get('[data-testid="shell-toggle"]').should('be.visible').click();
      cy.get('[data-testid="shell-toggle"]').should('have.attr', 'aria-checked', 'true');
      cy.screenshot('plugin-shell-enabled');

      // Verify shell status indicator
      cy.get('[data-testid="shell-status"]').should('contain', 'Active');
      cy.get('[data-testid="shell-permission-indicator"]').should('have.class', 'granted');

      // Test shell command execution through chat
      cy.get('[data-testid="chat-input"]').type('Execute shell command: ls -la{enter}');

      // Wait for agent to process and potentially execute shell command
      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');

      // Look for shell execution indicators
      cy.get('[data-testid="shell-execution-indicator"]').should('be.visible');
      cy.get('[data-testid="shell-output"]').should('exist');
      cy.screenshot('plugin-shell-command-executed');

      // Verify security warnings are shown
      cy.get('[data-testid="security-warning"]').should('contain', 'shell');
    });

    it('should disable shell access and prevent execution', () => {
      // First enable, then disable shell
      cy.get('[data-testid="shell-toggle"]').click(); // Enable
      cy.get('[data-testid="shell-toggle"]').click(); // Disable
      cy.get('[data-testid="shell-toggle"]').should('have.attr', 'aria-checked', 'false');

      // Verify shell status
      cy.get('[data-testid="shell-status"]').should('contain', 'Disabled');

      // Try shell command - should be blocked
      cy.get('[data-testid="chat-input"]').type('Execute shell command: pwd{enter}');
      cy.get('[data-testid="agent-message"]', { timeout: 10000 }).should('be.visible');

      // Should show capability disabled message
      cy.get('[data-testid="capability-disabled-message"]').should('contain', 'Shell access is disabled');
    });

    it('should show shell command confirmation dialog when enabled', () => {
      cy.get('[data-testid="shell-toggle"]').click();
      cy.get('[data-testid="shell-require-confirmation"]').click(); // Enable confirmation mode

      cy.get('[data-testid="chat-input"]').type('Run command: echo "test"{enter}');

      // Should show confirmation dialog
      cy.get('[data-testid="shell-command-confirmation"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="command-to-execute"]').should('contain', 'echo "test"');
      cy.screenshot('plugin-shell-confirmation-dialog');

      // Test approval
      cy.get('[data-testid="approve-command-button"]').click();
      cy.get('[data-testid="shell-output"]').should('contain', 'test');

      // Test rejection for next command
      cy.get('[data-testid="chat-input"]').type('Run command: rm -rf /{enter}');
      cy.get('[data-testid="shell-command-confirmation"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="reject-command-button"]').click();
      cy.get('[data-testid="command-rejected-message"]').should('be.visible');
    });
  });

  describe('Browser Access Capability', () => {
    it('should enable browser access and validate web browsing', () => {
      // Enable browser capability
      cy.get('[data-testid="browser-toggle"]').should('be.visible').click();
      cy.get('[data-testid="browser-toggle"]').should('have.attr', 'aria-checked', 'true');
      cy.screenshot('plugin-browser-enabled');

      // Test web browsing request
      cy.get('[data-testid="chat-input"]').type('Browse to https://example.com and tell me what you see{enter}');

      // Wait for agent to process browsing request
      cy.get('[data-testid="agent-message"]', { timeout: 20000 }).should('be.visible');

      // Look for browser activity indicators
      cy.get('[data-testid="browser-activity-indicator"]').should('be.visible');
      cy.get('[data-testid="browsing-status"]').should('contain', 'Fetching');
      cy.screenshot('plugin-browser-activity');

      // Verify web content was retrieved
      cy.get('[data-testid="web-content-summary"]').should('be.visible');
      cy.get('[data-testid="browser-session-info"]').should('contain', 'example.com');
    });

    it('should handle browser errors gracefully', () => {
      cy.get('[data-testid="browser-toggle"]').click();

      // Request invalid URL
      cy.get('[data-testid="chat-input"]').type('Browse to https://invalid-url-that-does-not-exist-12345.com{enter}');

      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="browser-error-message"]').should('contain', 'unable to reach');
      cy.screenshot('plugin-browser-error-handling');
    });

    it('should respect browser safety settings', () => {
      cy.get('[data-testid="browser-toggle"]').click();
      cy.get('[data-testid="browser-safety-mode"]').click(); // Enable safety mode

      // Test potentially unsafe request
      cy.get('[data-testid="chat-input"]').type('Download a file from a website{enter}');

      cy.get('[data-testid="agent-message"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="safety-block-message"]').should('contain', 'Safety mode prevented');
    });
  });

  describe('Vision/Camera Capability', () => {
    it('should enable camera access and validate vision functionality', () => {
      // Enable camera capability
      cy.get('[data-testid="camera-toggle"]').should('be.visible').click();
      cy.get('[data-testid="camera-toggle"]').should('have.attr', 'aria-checked', 'true');
      cy.screenshot('plugin-camera-enabled');

      // Should show camera permission request
      cy.get('[data-testid="camera-permission-dialog"]').should('be.visible');
      cy.get('[data-testid="grant-camera-permission"]').click();

      // Test camera functionality
      cy.get('[data-testid="chat-input"]').type('Take a photo and describe what you see{enter}');

      // Look for camera activation
      cy.get('[data-testid="camera-activity-indicator"]').should('be.visible');
      cy.get('[data-testid="camera-preview"]').should('be.visible');
      cy.screenshot('plugin-camera-preview');

      // Simulate photo capture
      cy.get('[data-testid="capture-photo-button"]').click();
      cy.get('[data-testid="photo-captured-indicator"]').should('be.visible');

      // Wait for vision analysis
      cy.get('[data-testid="vision-analysis"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="image-description"]').should('not.be.empty');
    });

    it('should handle camera access denial', () => {
      cy.get('[data-testid="camera-toggle"]').click();

      // Simulate permission denial
      cy.get('[data-testid="camera-permission-dialog"]').should('be.visible');
      cy.get('[data-testid="deny-camera-permission"]').click();

      cy.get('[data-testid="camera-permission-denied"]').should('be.visible');
      cy.get('[data-testid="camera-status"]').should('contain', 'Permission denied');
      cy.screenshot('plugin-camera-permission-denied');
    });

    it('should enable screen capture and validate functionality', () => {
      // Enable screen capture capability
      cy.get('[data-testid="screen-toggle"]').should('be.visible').click();
      cy.get('[data-testid="screen-toggle"]').should('have.attr', 'aria-checked', 'true');

      // Test screen capture request
      cy.get('[data-testid="chat-input"]').type('Take a screenshot and analyze what\'s on my screen{enter}');

      // Should show screen share permission dialog
      cy.get('[data-testid="screen-share-dialog"]').should('be.visible');
      cy.get('[data-testid="allow-screen-capture"]').click();

      // Look for screen capture activity
      cy.get('[data-testid="screen-capture-indicator"]').should('be.visible');
      cy.get('[data-testid="screenshot-preview"]').should('be.visible');
      cy.screenshot('plugin-screen-capture-active');

      // Verify analysis results
      cy.get('[data-testid="screen-analysis"]', { timeout: 15000 }).should('be.visible');
    });
  });

  describe('Audio Capabilities (Microphone & Speakers)', () => {
    it('should enable microphone and validate voice input', () => {
      // Enable microphone capability
      cy.get('[data-testid="microphone-toggle"]').should('be.visible').click();
      cy.get('[data-testid="microphone-toggle"]').should('have.attr', 'aria-checked', 'true');

      // Should show microphone permission request
      cy.get('[data-testid="microphone-permission-dialog"]').should('be.visible');
      cy.get('[data-testid="grant-microphone-permission"]').click();

      // Test voice input button
      cy.get('[data-testid="voice-input-button"]').should('be.visible').click();
      cy.get('[data-testid="recording-indicator"]').should('be.visible');
      cy.get('[data-testid="voice-waveform"]').should('be.visible');
      cy.screenshot('plugin-microphone-recording');

      // Stop recording
      cy.get('[data-testid="voice-input-button"]').click();
      cy.get('[data-testid="transcribing-indicator"]').should('be.visible');

      // Should show transcribed text
      cy.get('[data-testid="transcribed-text"]', { timeout: 10000 }).should('be.visible');
    });

    it('should enable speakers and validate text-to-speech', () => {
      // Enable speakers capability
      cy.get('[data-testid="speaker-toggle"]').should('be.visible').click();
      cy.get('[data-testid="speaker-toggle"]').should('have.attr', 'aria-checked', 'true');

      // Test TTS functionality
      cy.get('[data-testid="chat-input"]').type('Please speak this message out loud{enter}');

      // Wait for agent response
      cy.get('[data-testid="agent-message"]', { timeout: 10000 }).should('be.visible');

      // Look for TTS indicators
      cy.get('[data-testid="tts-playing-indicator"]').should('be.visible');
      cy.get('[data-testid="audio-waveform"]').should('be.visible');
      cy.screenshot('plugin-tts-active');

      // Test TTS controls
      cy.get('[data-testid="pause-tts-button"]').should('be.visible').click();
      cy.get('[data-testid="tts-paused-indicator"]').should('be.visible');

      cy.get('[data-testid="resume-tts-button"]').click();
      cy.get('[data-testid="tts-playing-indicator"]').should('be.visible');
    });

    it('should test voice conversation mode', () => {
      // Enable both microphone and speakers
      cy.get('[data-testid="microphone-toggle"]').click();
      cy.get('[data-testid="speaker-toggle"]').click();

      // Grant permissions
      cy.get('[data-testid="microphone-permission-dialog"]').should('be.visible');
      cy.get('[data-testid="grant-microphone-permission"]').click();

      // Enable conversation mode
      cy.get('[data-testid="voice-conversation-mode"]').should('be.visible').click();
      cy.get('[data-testid="conversation-mode-active"]').should('be.visible');
      cy.screenshot('plugin-voice-conversation-mode');

      // Test voice activation
      cy.get('[data-testid="voice-activation-indicator"]').should('be.visible');
      cy.get('[data-testid="listening-status"]').should('contain', 'Listening');
    });
  });

  describe('Autonomous Coding Capability', () => {
    it('should enable autonomous coding and validate code execution', () => {
      // Enable autonomous coding capability
      cy.get('[data-testid="coding-toggle"]').should('be.visible').click();
      cy.get('[data-testid="coding-toggle"]').should('have.attr', 'aria-checked', 'true');

      // Should show safety warning
      cy.get('[data-testid="coding-safety-warning"]').should('be.visible');
      cy.get('[data-testid="acknowledge-coding-risks"]').click();
      cy.screenshot('plugin-coding-enabled');

      // Test code generation request
      cy.get('[data-testid="chat-input"]').type('Write a simple function to calculate fibonacci numbers{enter}');

      // Look for code generation activity
      cy.get('[data-testid="code-generation-indicator"]').should('be.visible');
      cy.get('[data-testid="agent-message"]', { timeout: 20000 }).should('be.visible');

      // Should show generated code
      cy.get('[data-testid="generated-code-block"]').should('be.visible');
      cy.get('[data-testid="code-execution-button"]').should('be.visible');
      cy.screenshot('plugin-code-generated');

      // Test code execution
      cy.get('[data-testid="code-execution-button"]').click();
      cy.get('[data-testid="code-execution-confirmation"]').should('be.visible');
      cy.get('[data-testid="confirm-code-execution"]').click();

      cy.get('[data-testid="code-output"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="execution-result"]').should('not.be.empty');
    });

    it('should handle coding capability restrictions', () => {
      cy.get('[data-testid="coding-toggle"]').click();
      cy.get('[data-testid="acknowledge-coding-risks"]').click();

      // Enable restricted mode
      cy.get('[data-testid="coding-restricted-mode"]').click();

      // Test potentially dangerous code request
      cy.get('[data-testid="chat-input"]').type('Write code to delete all files in a directory{enter}');

      cy.get('[data-testid="agent-message"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-testid="code-safety-block"]').should('contain', 'potentially dangerous');
      cy.screenshot('plugin-coding-safety-block');
    });
  });

  describe('Capability Integration and Conflicts', () => {
    it('should handle multiple capabilities enabled simultaneously', () => {
      // Enable multiple capabilities
      const capabilities = ['shell-toggle', 'browser-toggle', 'camera-toggle', 'microphone-toggle'];

      capabilities.forEach(capability => {
        cy.get(`[data-testid="${capability}"]`).click();
      });

      // Grant necessary permissions
      cy.get('[data-testid="grant-all-permissions"]').click();
      cy.screenshot('plugin-multiple-capabilities-enabled');

      // Test complex request using multiple capabilities
      cy.get('[data-testid="chat-input"]').type('Take a screenshot, describe it, search for related information online, and create a summary file{enter}');

      // Should show multiple capability activities
      cy.get('[data-testid="screen-capture-indicator"]').should('be.visible');
      cy.get('[data-testid="browser-activity-indicator"]').should('be.visible');
      cy.get('[data-testid="shell-execution-indicator"]').should('be.visible');

      // Verify coordinated execution
      cy.get('[data-testid="multi-capability-coordination"]', { timeout: 30000 }).should('be.visible');
      cy.screenshot('plugin-multi-capability-execution');
    });

    it('should show capability resource usage and limits', () => {
      // Enable several resource-intensive capabilities
      cy.get('[data-testid="browser-toggle"]').click();
      cy.get('[data-testid="camera-toggle"]').click();
      cy.get('[data-testid="coding-toggle"]').click();
      cy.get('[data-testid="acknowledge-coding-risks"]').click();

      // Check resource usage indicators
      cy.get('[data-testid="resource-usage-panel"]').should('be.visible');
      cy.get('[data-testid="cpu-usage-meter"]').should('be.visible');
      cy.get('[data-testid="memory-usage-meter"]').should('be.visible');
      cy.get('[data-testid="api-usage-meter"]').should('be.visible');
      cy.screenshot('plugin-resource-usage-monitoring');

      // Test resource limit warnings
      cy.get('[data-testid="resource-warning"]').then(($warning) => {
        if ($warning.length) {
          cy.wrap($warning).should('be.visible');
          cy.get('[data-testid="optimize-resources-button"]').should('be.visible');
        }
      });
    });

    it('should validate capability dependency chains', () => {
      // Test capability dependencies (e.g., screen capture might require camera permission)
      cy.get('[data-testid="screen-toggle"]').click();

      // Should show dependency requirements
      cy.get('[data-testid="dependency-requirements"]').should('be.visible');
      cy.get('[data-testid="required-permissions"]').should('contain', 'display media');

      // Grant required permissions
      cy.get('[data-testid="grant-required-permissions"]').click();
      cy.get('[data-testid="screen-toggle"]').should('have.attr', 'aria-checked', 'true');
      cy.screenshot('plugin-dependency-validation');
    });
  });

  afterEach(() => {
    // Reset capabilities to clean state
    cy.get('[data-testid="reset-capabilities-button"]').then(($button) => {
      if ($button.length) {
        cy.wrap($button).click();
        cy.get('[data-testid="confirm-reset-capabilities"]').click();
      }
    });

    cy.screenshot('plugin-test-complete');
  });
});
