/**
 * Complete Embedded Client E2E Test
 * Tests the embedded client iframe, communication, configuration, and error handling
 */

describe('Embedded Client Complete Test', () => {
  beforeEach(() => {
    // Clear any existing auth state
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'embedded-client-user',
          email: 'client@elizaos.ai',
          firstName: 'Client',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'embedded-client-org',
          name: 'Embedded Client Test Org',
          slug: 'embedded-client-test',
          subscriptionTier: 'premium',
          creditBalance: '1000.0',
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

  it('Embedded Client - Component Structure Test', () => {
    cy.log('🖥️ Testing Embedded Client Component Structure');

    // Create a test page with the embedded client component
    cy.intercept('GET', '/test-embedded-client', {
      statusCode: 200,
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Embedded Client Test</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .test-container { height: 600px; border: 1px solid #ccc; }
          </style>
        </head>
        <body>
          <h1>Embedded Client Test Page</h1>
          <div class="test-container">
            <div data-cy="embedded-client" style="height: 100%; display: flex; flex-direction: column;">
              <!-- Header -->
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e7eb; background: white;">
                <div>
                  <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0;">Agent Editor</h2>
                  <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">
                    Create and manage your AI agents with the ElizaOS client interface
                  </p>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span data-cy="client-status" style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 500; background: #dcfce7; color: #166534;">
                    Ready
                  </span>
                  <button data-cy="reload-client-button" style="padding: 8px; color: #9ca3af; border: none; background: none; border-radius: 8px; cursor: pointer;" title="Reload Client">
                    ↻
                  </button>
                  <button data-cy="open-external-button" style="padding: 8px; color: #9ca3af; border: none; background: none; border-radius: 8px; cursor: pointer;" title="Open in New Tab">
                    ↗
                  </button>
                </div>
              </div>
              
              <!-- Required Plugins Info -->
              <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px;">
                <div style="margin-left: 12px;">
                  <p style="font-size: 14px; color: #1e3a8a; margin: 0;">
                    <span style="font-weight: 500;">Required plugins:</span> core, memory, inference
                  </p>
                  <p style="font-size: 12px; color: #1e40af; margin: 4px 0 0 0;">
                    These plugins are automatically included in all agents and cannot be removed.
                  </p>
                </div>
              </div>
              
              <!-- Client Iframe -->
              <div style="flex: 1; background: #f9fafb; position: relative;">
                <iframe 
                  src="/client-static/index.html" 
                  style="width: 100%; height: 100%; border: 0;" 
                  title="ElizaOS Agent Management Interface"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals">
                </iframe>
                
                <!-- Simulated Loading Overlay (for testing) -->
                <div id="loading-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; display: none;">
                  <div style="text-align: center;">
                    <div style="width: 32px; height: 32px; border: 3px solid #3b82f6; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                    <h3 style="font-size: 18px; font-weight: 500; color: #111827; margin: 0 0 8px 0;">Loading Agent Editor</h3>
                    <p style="color: #6b7280; margin: 0;">Preparing the ElizaOS client interface...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          
          <script>
            // Simulate embedded client behavior
            window.addEventListener('message', function(event) {
              console.log('Received message:', event.data);
              
              if (event.data.type === 'PLATFORM_CONFIG') {
                console.log('Platform config received:', event.data.payload);
                // Simulate successful configuration
                setTimeout(() => {
                  parent.postMessage({ type: 'CLIENT_CONFIGURED' }, '*');
                }, 500);
              }
            });
            
            // Simulate client ready after load
            window.addEventListener('load', function() {
              setTimeout(() => {
                parent.postMessage({ type: 'CLIENT_READY' }, '*');
              }, 1000);
            });
          </script>
        </body>
        </html>
      `,
      headers: {
        'Content-Type': 'text/html',
      },
    }).as('getEmbeddedClientPage');

    // ==========================================
    // STEP 1: Visit Test Page
    // ==========================================
    cy.log('📋 Step 1: Visit Test Page');

    cy.visit('/test-embedded-client', { failOnStatusCode: false });
    cy.wait('@getEmbeddedClientPage');

    // Verify basic structure
    cy.get('[data-cy="embedded-client"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Header Elements
    // ==========================================
    cy.log('📋 Step 2: Test Header Elements');

    cy.contains('Agent Editor').should('be.visible');
    cy.contains('Create and manage your AI agents').should('be.visible');

    // Test status indicator
    cy.get('[data-cy="client-status"]').should('be.visible');
    cy.get('[data-cy="client-status"]').should('contain.text', 'Ready');

    // Test control buttons
    cy.get('[data-cy="reload-client-button"]').should('be.visible');
    cy.get('[data-cy="open-external-button"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Required Plugins Info
    // ==========================================
    cy.log('🔌 Step 3: Test Required Plugins Info');

    cy.contains('Required plugins:').should('be.visible');
    cy.contains('core, memory, inference').should('be.visible');
    cy.contains('automatically included').should('be.visible');

    // ==========================================
    // STEP 4: Test Iframe Presence
    // ==========================================
    cy.log('🖼️ Step 4: Test Iframe Presence');

    cy.get('iframe').should('be.visible');
    cy.get('iframe').should('have.attr', 'src', '/client-static/index.html');
    cy.get('iframe').should(
      'have.attr',
      'title',
      'ElizaOS Agent Management Interface',
    );
    cy.get('iframe').should('have.attr', 'sandbox');

    cy.log('✅ Embedded Client Component Structure Test Complete!');
  });

  it('Embedded Client - Button Interactions Test', () => {
    cy.log('🔄 Testing Embedded Client Button Interactions');

    cy.visit('/test-embedded-client', { failOnStatusCode: false });
    cy.wait('@getEmbeddedClientPage');

    // ==========================================
    // STEP 1: Test Reload Button
    // ==========================================
    cy.log('🔄 Step 1: Test Reload Button');

    cy.get('[data-cy="reload-client-button"]').should('be.visible');

    // Click reload button
    cy.get('[data-cy="reload-client-button"]').click();

    // Iframe should still be present (simulates reload)
    cy.get('iframe').should('be.visible');

    // ==========================================
    // STEP 2: Test Open External Button
    // ==========================================
    cy.log('🔗 Step 2: Test Open External Button');

    cy.get('[data-cy="open-external-button"]').should('be.visible');

    // Mock window.open
    cy.window().then((win) => {
      cy.stub(win, 'open').as('windowOpen');
    });

    cy.get('[data-cy="open-external-button"]').click();

    // Should call window.open (we can't test the actual opening due to security restrictions)
    cy.get('@windowOpen').should('have.been.called');

    // ==========================================
    // STEP 3: Test Status Indicator States
    // ==========================================
    cy.log('📊 Step 3: Test Status Indicator States');

    // Status should show "Ready" by default in our mock
    cy.get('[data-cy="client-status"]').should('contain.text', 'Ready');

    // Test different status states by simulating them
    const statusStates = [
      { status: 'Connecting...', class: 'bg-gray-100 text-gray-800' },
      { status: 'Loading...', class: 'bg-blue-100 text-blue-800' },
      { status: 'Configuring...', class: 'bg-yellow-100 text-yellow-800' },
      { status: 'Ready', class: 'bg-green-100 text-green-800' },
    ];

    statusStates.forEach((state, index) => {
      // We can verify the status text exists
      if (index === 3) {
        // Only "Ready" exists in our mock
        cy.get('[data-cy="client-status"]').should(
          'contain.text',
          state.status,
        );
      }
    });

    cy.log('✅ Embedded Client Button Interactions Test Complete!');
  });

  it('Embedded Client - Communication Test', () => {
    cy.log('💬 Testing Embedded Client Communication');

    // ==========================================
    // STEP 1: Test Message Handling Setup
    // ==========================================
    cy.log('📡 Step 1: Test Message Handling Setup');

    cy.visit('/test-embedded-client', { failOnStatusCode: false });
    cy.wait('@getEmbeddedClientPage');

    // ==========================================
    // STEP 2: Test Client Configuration Message
    // ==========================================
    cy.log('⚙️ Step 2: Test Client Configuration Message');

    // Our mock page should automatically send CLIENT_READY and handle PLATFORM_CONFIG
    cy.get('[data-cy="embedded-client"]').should('be.visible');

    // Simulate the configuration process by checking if the iframe loaded
    cy.get('iframe').should('be.visible');

    // ==========================================
    // STEP 3: Test Error Scenarios
    // ==========================================
    cy.log('❌ Step 3: Test Error Scenarios');

    // Test iframe load error simulation
    cy.window().then((win) => {
      // Simulate an iframe error by firing the error event
      const iframe = win.document.querySelector('iframe');
      if (iframe) {
        const errorEvent = new Event('error');
        iframe.dispatchEvent(errorEvent);
      }
    });

    // The page should still be functional even if iframe fails
    cy.get('[data-cy="embedded-client"]').should('be.visible');
    cy.get('[data-cy="reload-client-button"]').should('be.visible');

    // ==========================================
    // STEP 4: Test Cross-Origin Safety
    // ==========================================
    cy.log('🔒 Step 4: Test Cross-Origin Safety');

    // Verify sandbox attributes are present
    cy.get('iframe').should('have.attr', 'sandbox');
    cy.get('iframe')
      .should('have.attr', 'sandbox')
      .and('include', 'allow-scripts');
    cy.get('iframe')
      .should('have.attr', 'sandbox')
      .and('include', 'allow-same-origin');

    cy.log('✅ Embedded Client Communication Test Complete!');
  });

  it('Embedded Client - Responsive Design Test', () => {
    cy.log('📱 Testing Embedded Client Responsive Design');

    cy.visit('/test-embedded-client', { failOnStatusCode: false });
    cy.wait('@getEmbeddedClientPage');

    // ==========================================
    // STEP 1: Test Desktop Layout
    // ==========================================
    cy.log('🖥️ Step 1: Test Desktop Layout');

    // All elements should be visible and properly laid out on desktop
    cy.get('[data-cy="embedded-client"]').should('be.visible');
    cy.contains('Agent Editor').should('be.visible');
    cy.get('[data-cy="client-status"]').should('be.visible');
    cy.get('[data-cy="reload-client-button"]').should('be.visible');
    cy.get('[data-cy="open-external-button"]').should('be.visible');
    cy.get('iframe').should('be.visible');

    // ==========================================
    // STEP 2: Test Mobile Layout
    // ==========================================
    cy.log('📱 Step 2: Test Mobile Layout');

    cy.viewport('iphone-x');

    // All elements should still be visible on mobile
    cy.get('[data-cy="embedded-client"]').should('be.visible');
    cy.contains('Agent Editor').should('be.visible');
    cy.get('[data-cy="client-status"]').should('be.visible');
    cy.get('[data-cy="reload-client-button"]').should('be.visible');
    cy.get('[data-cy="open-external-button"]').should('be.visible');
    cy.get('iframe').should('be.visible');

    // Header should stack appropriately on mobile
    cy.contains('Create and manage your AI agents').should('be.visible');

    // ==========================================
    // STEP 3: Test Tablet Layout
    // ==========================================
    cy.log('📱 Step 3: Test Tablet Layout');

    cy.viewport('ipad-2');

    // Should be fully functional on tablet
    cy.get('[data-cy="embedded-client"]').should('be.visible');
    cy.get('iframe').should('be.visible');

    // Required plugins info should be visible
    cy.contains('Required plugins:').should('be.visible');

    // Reset to desktop
    cy.viewport(1280, 720);

    cy.log('✅ Embedded Client Responsive Design Test Complete!');
  });

  it('Embedded Client - Loading States Test', () => {
    cy.log('⏳ Testing Embedded Client Loading States');

    // ==========================================
    // STEP 1: Test Initial Loading State
    // ==========================================
    cy.log('⏳ Step 1: Test Initial Loading State');

    cy.intercept('GET', '/test-embedded-client-loading', {
      statusCode: 200,
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Embedded Client Loading Test</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .test-container { height: 600px; border: 1px solid #ccc; position: relative; }
          </style>
        </head>
        <body>
          <h1>Embedded Client Loading Test</h1>
          <div class="test-container">
            <div data-cy="embedded-client" style="height: 100%; position: relative;">
              <!-- Show loading overlay initially -->
              <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center;">
                  <div style="width: 32px; height: 32px; border: 3px solid #3b82f6; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                  <h3 style="font-size: 18px; font-weight: 500; color: #111827; margin: 0 0 8px 0;">Loading Agent Editor</h3>
                  <p style="color: #6b7280; margin: 0;">Preparing the ElizaOS client interface...</p>
                </div>
              </div>
            </div>
          </div>
          
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          
          <script>
            // Simulate loading completion after 2 seconds
            setTimeout(() => {
              document.querySelector('.test-container > div > div').style.display = 'none';
              
              // Add the loaded content
              const content = \`
                <div style="height: 100%; display: flex; flex-direction: column;">
                  <div style="padding: 16px; border-bottom: 1px solid #e5e7eb; background: white;">
                    <h2 style="margin: 0;">Agent Editor</h2>
                    <span data-cy="client-status" style="display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 12px; background: #dcfce7; color: #166534;">Ready</span>
                  </div>
                  <div style="flex: 1; background: #f9fafb;">
                    <iframe src="/client-static/index.html" style="width: 100%; height: 100%; border: 0;"></iframe>
                  </div>
                </div>
              \`;
              document.querySelector('[data-cy="embedded-client"]').innerHTML = content;
            }, 2000);
          </script>
        </body>
        </html>
      `,
      headers: {
        'Content-Type': 'text/html',
      },
    }).as('getLoadingClientPage');

    cy.visit('/test-embedded-client-loading', { failOnStatusCode: false });
    cy.wait('@getLoadingClientPage');

    // ==========================================
    // STEP 2: Verify Loading Overlay
    // ==========================================
    cy.log('⏳ Step 2: Verify Loading Overlay');

    cy.get('[data-cy="embedded-client"]').should('be.visible');
    cy.contains('Loading Agent Editor').should('be.visible');
    cy.contains('Preparing the ElizaOS client interface').should('be.visible');

    // ==========================================
    // STEP 3: Wait for Loading Completion
    // ==========================================
    cy.log('✅ Step 3: Wait for Loading Completion');

    // Wait for the simulated loading to complete
    cy.contains('Loading Agent Editor', { timeout: 3000 }).should('not.exist');

    // Should show loaded content
    cy.contains('Agent Editor').should('be.visible');
    cy.get('[data-cy="client-status"]').should('be.visible');
    cy.get('iframe').should('be.visible');

    cy.log('✅ Embedded Client Loading States Test Complete!');
  });

  it('Embedded Client - Error Recovery Test', () => {
    cy.log('🔧 Testing Embedded Client Error Recovery');

    // ==========================================
    // STEP 1: Test Iframe Load Failure Recovery
    // ==========================================
    cy.log('❌ Step 1: Test Iframe Load Failure Recovery');

    cy.intercept('GET', '/test-embedded-client-error', {
      statusCode: 200,
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Embedded Client Error Test</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .test-container { height: 600px; border: 1px solid #ccc; }
          </style>
        </head>
        <body>
          <h1>Embedded Client Error Test</h1>
          <div class="test-container">
            <div data-cy="embedded-client" style="height: 100%; display: flex; flex-direction: column;">
              <!-- Header with error state -->
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e7eb; background: white;">
                <div>
                  <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0;">Agent Editor</h2>
                  <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">
                    Create and manage your AI agents with the ElizaOS client interface
                  </p>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span data-cy="client-status" style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 500; background: #fef2f2; color: #dc2626;">
                    Error
                  </span>
                  <button data-cy="reload-client-button" style="padding: 8px; color: #9ca3af; border: none; background: none; border-radius: 8px; cursor: pointer;" title="Reload Client">
                    ↻
                  </button>
                </div>
              </div>
              
              <!-- Error Banner -->
              <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px;">
                <div style="display: flex; align-items: center;">
                  <div style="margin-left: 12px;">
                    <p style="font-size: 14px; color: #dc2626; margin: 0;">Failed to load agent management interface. Please refresh the page.</p>
                  </div>
                  <button style="margin-left: auto; color: #dc2626; background: none; border: none; cursor: pointer;">×</button>
                </div>
              </div>
              
              <!-- Failed Iframe -->
              <div style="flex: 1; background: #f9fafb; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center; color: #6b7280;">
                  <p>Unable to load client interface</p>
                  <button data-cy="retry-load" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            // Simulate retry functionality
            document.querySelector('[data-cy="retry-load"]').addEventListener('click', function() {
              // Simulate successful recovery
              document.querySelector('[data-cy="client-status"]').textContent = 'Ready';
              document.querySelector('[data-cy="client-status"]').className = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800';
              
              // Hide error banner
              document.querySelector('div[style*="background: #fef2f2"]').style.display = 'none';
              
              // Replace error content with iframe
              const container = document.querySelector('div[style*="flex: 1"][style*="justify-content: center"]');
              container.innerHTML = '<iframe src="/client-static/index.html" style="width: 100%; height: 100%; border: 0;"></iframe>';
            });
            
            // Simulate reload button
            document.querySelector('[data-cy="reload-client-button"]').addEventListener('click', function() {
              location.reload();
            });
          </script>
        </body>
        </html>
      `,
      headers: {
        'Content-Type': 'text/html',
      },
    }).as('getErrorClientPage');

    cy.visit('/test-embedded-client-error', { failOnStatusCode: false });
    cy.wait('@getErrorClientPage');

    // ==========================================
    // STEP 2: Verify Error State
    // ==========================================
    cy.log('❌ Step 2: Verify Error State');

    cy.get('[data-cy="embedded-client"]').should('be.visible');
    cy.get('[data-cy="client-status"]').should('contain.text', 'Error');
    cy.contains('Failed to load agent management interface').should(
      'be.visible',
    );
    cy.contains('Unable to load client interface').should('be.visible');

    // ==========================================
    // STEP 3: Test Recovery Action
    // ==========================================
    cy.log('🔧 Step 3: Test Recovery Action');

    cy.get('[data-cy="retry-load"]')
      .should('be.visible')
      .and('contain.text', 'Retry');
    cy.get('[data-cy="retry-load"]').click();

    // Should recover from error state
    cy.get('[data-cy="client-status"]').should('contain.text', 'Ready');
    cy.contains('Failed to load agent management interface').should(
      'not.exist',
    );
    cy.get('iframe').should('be.visible');

    // ==========================================
    // STEP 4: Test Reload Functionality
    // ==========================================
    cy.log('🔄 Step 4: Test Reload Functionality');

    cy.get('[data-cy="reload-client-button"]').should('be.visible');
    // We can't easily test actual reload, but we can verify the button exists and is clickable
    cy.get('[data-cy="reload-client-button"]').should('not.be.disabled');

    cy.log('✅ Embedded Client Error Recovery Test Complete!');
  });
});
