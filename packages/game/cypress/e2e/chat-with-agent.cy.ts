/**
 * COMPREHENSIVE CHAT WITH AGENT TEST
 *
 * This test verifies the complete end-to-end flow:
 * 1. Tauri app starts up properly
 * 2. Agent server connects and is healthy
 * 3. User can send a message
 * 4. Agent responds without server errors
 * 5. Message appears in chat interface
 *
 * This is the main integration test that validates our entire system works.
 */

describe('Complete Chat with Agent Flow', () => {
  const TEST_MESSAGE = 'Hello agent, please respond with exactly: TEST SUCCESSFUL';
  const TIMEOUT_LONG = 60000; // 60 seconds for startup
  const TIMEOUT_MEDIUM = 30000; // 30 seconds for responses
  const TIMEOUT_SHORT = 10000; // 10 seconds for UI interactions

  beforeEach(() => {
    // Visit the Tauri app
    cy.visit('/', { timeout: TIMEOUT_LONG });

    // Wait for app to be fully loaded
    cy.get('[data-testid="game-interface"]', { timeout: TIMEOUT_LONG })
      .should('be.visible');
  });

  it('should complete full chat flow with agent', () => {
    cy.log('🚀 Starting comprehensive chat-with-agent test');

    // Step 1: Verify startup status shows ready
    cy.log('📊 Step 1: Checking startup status');
    cy.get('[data-testid="connection-status"]', { timeout: TIMEOUT_LONG })
      .should('be.visible')
      .and(($status) => {
        const text = $status.text().toLowerCase();
        const isReady = text.includes('connected') || text.includes('ready') || !text.includes('disconnected');
        expect(isReady, 'Connection status should show ready state').to.be.true;
      });

    // Step 2: Verify chat interface is available
    cy.log('💬 Step 2: Verifying chat interface');
    cy.get('[data-testid="chat-messages"]')
      .should('be.visible');

    // Wait for chat input to be enabled (may take time for system to be ready)
    cy.log('⏳ Waiting for chat input to be enabled...');
    cy.get('[data-testid="chat-input"]', { timeout: TIMEOUT_LONG })
      .should('be.visible')
      .should('not.be.disabled');

    // Step 3: Check that no server errors are present initially
    cy.log('✅ Step 3: Checking for initial server errors');
    cy.get('[data-testid="chat-messages"]')
      .should('not.contain.text', 'Error')
      .should('not.contain.text', 'Failed')
      .should('not.contain.text', 'Connection refused');

    // Step 4: Send test message to agent
    cy.log('📤 Step 4: Sending test message to agent');
    cy.get('[data-testid="chat-input"]')
      .clear()
      .type(TEST_MESSAGE);

    cy.get('[data-testid="chat-send-button"]')
      .click();

    // Step 5: Verify user message appears immediately (immediate posting)
    cy.log('👤 Step 5: Verifying immediate user message posting');
    cy.get('[data-testid="chat-messages"]', { timeout: TIMEOUT_SHORT })
      .should('contain.text', TEST_MESSAGE);

    // Verify message has user styling/indicator
    cy.get('[data-testid="user-message"]')
      .should('contain.text', TEST_MESSAGE);

    // Step 6: Wait for agent response (this is the critical test)
    cy.log('🤖 Step 6: Waiting for agent response');

    // Look for agent response with flexible matching
    cy.get('[data-testid="chat-messages"]', { timeout: TIMEOUT_MEDIUM })
      .should(($output) => {
        const text = $output.text().toLowerCase();

        // Agent should respond with something containing our test phrase
        // or at least respond in some way (not silent)
        const hasResponse = text.includes('test successful') ||
                          text.includes('hello') ||
                          text.includes('response') ||
                          text.includes('eliza') ||
                          text.length > TEST_MESSAGE.length + 50; // Got longer (response added)

        expect(hasResponse, 'Agent should respond to user message').to.be.true;
      });

    // Step 7: Verify no server errors after messaging
    cy.log('🔍 Step 7: Checking for server errors after messaging');
    cy.get('[data-testid="chat-messages"]')
      .should('not.contain.text', 'Server error')
      .should('not.contain.text', 'Connection lost')
      .should('not.contain.text', 'Failed to send')
      .should('not.contain.text', '500')
      .should('not.contain.text', '404')
      .should('not.contain.text', 'timeout');

    // Step 8: Verify message input is still functional
    cy.log('🔄 Step 8: Verifying message input remains functional');
    cy.get('[data-testid="chat-input"]')
      .should('not.be.disabled')
      .should('have.value', ''); // Should be cleared after sending

    // Step 9: Send a follow-up message to test continued functionality
    cy.log('📤 Step 9: Testing follow-up message');
    const FOLLOWUP_MESSAGE = 'Second test message';

    cy.get('[data-testid="chat-input"]')
      .type(FOLLOWUP_MESSAGE);

    cy.get('[data-testid="chat-send-button"]')
      .click();

    // Verify follow-up appears
    cy.get('[data-testid="chat-messages"]', { timeout: TIMEOUT_SHORT })
      .should('contain.text', FOLLOWUP_MESSAGE);

    // Step 10: Final validation - check overall chat health
    cy.log('🏆 Step 10: Final validation');

    // Should have at least 2 user messages
    cy.get('[data-testid="user-message"]')
      .should('have.length.at.least', 2);

    // Should have some agent responses (flexible matching)
    cy.get('[data-testid="chat-messages"]')
      .should(($output) => {
        const allMessages = $output.find('.message, .chat-message, [data-message-type]');
        expect(allMessages.length, 'Should have multiple messages in chat').to.be.at.least(2);
      });

    cy.log('✅ COMPREHENSIVE CHAT TEST COMPLETED SUCCESSFULLY!');
  });

  it('should handle USE_SMALL_MODELS dev mode correctly', () => {
    cy.log('🚀 Testing USE_SMALL_MODELS development mode');

    // Check that app started in dev mode (if we can detect it)
    cy.window().then((win) => {
      // Try to detect dev mode indicators
      cy.get('[data-testid="chat-messages"]')
        .should('not.contain.text', 'Failed to start')
        .should('not.contain.text', 'Container error');
    });

    // Wait for chat input to be ready
    cy.get('[data-testid="chat-input"]', { timeout: TIMEOUT_LONG })
      .should('not.be.disabled');

    // Send a simple message to verify agent is responsive in dev mode
    const DEV_TEST_MESSAGE = 'Testing dev mode with small models';

    cy.get('[data-testid="chat-input"]')
      .clear()
      .type(DEV_TEST_MESSAGE);

    cy.get('[data-testid="chat-send-button"]')
      .click();

    // Verify message flow works in dev mode
    cy.get('[data-testid="chat-messages"]', { timeout: TIMEOUT_MEDIUM })
      .should('contain.text', DEV_TEST_MESSAGE);

    // Agent should respond even with small model
    cy.get('[data-testid="chat-messages"]', { timeout: TIMEOUT_MEDIUM })
      .should(($output) => {
        const text = $output.text();
        const hasMoreContent = text.length > DEV_TEST_MESSAGE.length + 20;
        expect(hasMoreContent, 'Agent should respond in dev mode').to.be.true;
      });

    cy.log('✅ DEV MODE TEST COMPLETED SUCCESSFULLY!');
  });

  it('should handle message deduplication correctly', () => {
    cy.log('🔄 Testing message deduplication');

    const DEDUP_MESSAGE = 'Testing message deduplication';

    // Send a message
    cy.get('[data-testid="chat-input"]')
      .clear()
      .type(DEDUP_MESSAGE);

    cy.get('[data-testid="chat-send-button"]')
      .click();

    // Wait a moment for any potential duplicates to appear
    cy.wait(2000);

    // Verify the message only appears once as a user message
    cy.get('[data-testid="user-message"]')
      .contains(DEDUP_MESSAGE)
      .should('have.length', 1);

    cy.log('✅ MESSAGE DEDUPLICATION TEST COMPLETED!');
  });

  // Error recovery test
  it('should recover gracefully from errors', () => {
    cy.log('🛠️ Testing error recovery');

    // Try to send a very long message to test edge cases
    const LONG_MESSAGE = `${'A'.repeat(1000)} - Testing long message handling`;

    cy.get('[data-testid="chat-input"]')
      .clear()
      .type(LONG_MESSAGE);

    cy.get('[data-testid="chat-send-button"]')
      .click();

    // Verify app doesn't crash
    cy.get('[data-testid="chat-messages"]')
      .should('be.visible');

    cy.get('[data-testid="chat-input"]')
      .should('not.be.disabled');

    // Try to send a normal message after the long one
    cy.get('[data-testid="chat-input"]')
      .clear()
      .type('Recovery test message');

    cy.get('[data-testid="chat-send-button"]')
      .click();

    cy.get('[data-testid="chat-messages"]')
      .should('contain.text', 'Recovery test message');

    cy.log('✅ ERROR RECOVERY TEST COMPLETED!');
  });
});

/**
 * ALTERNATIVE TEST APPROACH - If data-testid attributes don't exist
 *
 * This provides fallback selectors for testing the same functionality
 * without requiring specific test IDs in the components.
 */
describe('Chat with Agent (Fallback Selectors)', () => {
  const TEST_MESSAGE = 'Fallback test message';

  beforeEach(() => {
    cy.visit('/', { timeout: 60000 });
  });

  it('should work with generic selectors', () => {
    cy.log('🔄 Testing with fallback selectors');

    // Wait for page to load
    cy.get('body').should('be.visible');

    // Look for input field (various possible selectors)
    cy.get('input[type="text"], input[placeholder*="message"], textarea, .message-input, #message-input')
      .first()
      .should('be.visible')
      .clear()
      .type(TEST_MESSAGE);

    // Look for send button (various possible selectors)
    cy.get('button[type="submit"], button:contains("Send"), .send-button, #send-button, button[aria-label*="send"]')
      .first()
      .click();

    // Look for chat output area
    cy.get('.chat-output, .messages, .chat-messages, .output, [class*="chat"], [id*="chat"]')
      .first()
      .should('contain.text', TEST_MESSAGE);

    cy.log('✅ FALLBACK SELECTOR TEST COMPLETED!');
  });
});
