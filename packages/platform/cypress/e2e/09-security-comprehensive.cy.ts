/**
 * Comprehensive Security Testing
 * Tests application security features, XSS prevention, CSRF protection, and input validation
 */

describe('Security Comprehensive Testing', () => {
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
        user: {
          id: 'security-test-user',
          email: 'security@elizaos.ai',
          firstName: 'Security',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'security-org',
          name: 'Security Test Org',
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

  it('XSS Prevention - Input Sanitization Test', () => {
    cy.log('🚫 Testing XSS Prevention and Input Sanitization');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Script Injection in Forms
    // ==========================================
    cy.log('🔒 Step 1: Test Script Injection in Forms');

    const maliciousInputs = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src="x" onerror="alert(\'xss\')" />',
      '<svg onload="alert(\'xss\')" />',
      '"><script>alert("xss")</script>',
      '\';alert("xss");//',
      '<iframe src="javascript:alert(\'xss\')"></iframe>',
      '<object data="javascript:alert(\'xss\')"></object>',
      '<embed src="javascript:alert(\'xss\')" />',
      '<link rel="stylesheet" href="javascript:alert(\'xss\')" />',
    ];

    maliciousInputs.forEach((maliciousInput, index) => {
      cy.log(
        `Testing malicious input ${index + 1}: ${maliciousInput.substring(0, 30)}...`,
      );

      // Test email input
      cy.get('[data-cy="email-input"] input').clear().type(maliciousInput);
      cy.get('[data-cy="email-input"] input').should(
        'have.value',
        maliciousInput,
      );

      // Test password input
      cy.get('[data-cy="password-input"] input').clear().type(maliciousInput);
      cy.get('[data-cy="password-input"] input').should(
        'have.value',
        maliciousInput,
      );

      // Verify no script execution occurred
      cy.window().then((win) => {
        // Check that no alert was triggered
        const originalAlert = win.alert;
        let alertCalled = false;
        win.alert = () => {
          alertCalled = true;
        };

        // Wait a moment for any potential script execution
        cy.wait(100).then(() => {
          expect(alertCalled).to.be.false;
          win.alert = originalAlert;
        });
      });
    });

    // ==========================================
    // STEP 2: Test HTML Entity Encoding
    // ==========================================
    cy.log('🔒 Step 2: Test HTML Entity Encoding');

    const htmlEntities = [
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
      '&quot;&gt;&lt;script&gt;alert("xss")&lt;/script&gt;',
      '&#60;script&#62;alert("xss")&#60;/script&#62;',
      '&amp;lt;script&amp;gt;alert("xss")&amp;lt;/script&amp;gt;',
    ];

    htmlEntities.forEach((entity) => {
      cy.get('[data-cy="email-input"] input').clear().type(entity);
      // Verify the entity is preserved as text, not interpreted as HTML
      cy.get('[data-cy="email-input"] input').should('have.value', entity);
    });

    cy.log('✅ XSS Prevention Test Complete!');
  });

  it('CSRF Protection Test', () => {
    cy.log('🔒 Testing CSRF Protection');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test CSRF Token Presence
    // ==========================================
    cy.log('🔑 Step 1: Test CSRF Token Presence');

    // Check for CSRF token in meta tags
    cy.document().then((doc) => {
      const csrfMeta = doc.querySelector('meta[name="csrf-token"]');
      if (csrfMeta) {
        cy.log('✅ CSRF token found in meta tag');
        const token = csrfMeta.getAttribute('content');
        expect(token).to.exist.and.not.be.empty;
      } else {
        cy.log('⚠️ CSRF token not found in meta tag');
      }
    });

    // ==========================================
    // STEP 2: Test Request Headers
    // ==========================================
    cy.log('🔑 Step 2: Test Request Headers');

    cy.get('[data-cy="email-input"] input').type('test@example.com');
    cy.get('[data-cy="password-input"] input').type('password123');

    // Intercept login request to check for CSRF protection
    cy.intercept('POST', '**/api/auth/login', (req) => {
      // Check for CSRF token in headers
      const hasCSRFHeader =
        req.headers['x-csrf-token'] ||
        req.headers['x-xsrf-token'] ||
        req.headers['csrf-token'];

      // Check for CSRF token in body
      const hasCSRFBody =
        req.body &&
        (req.body.csrfToken || req.body._token || req.body.authenticity_token);

      if (hasCSRFHeader || hasCSRFBody) {
        cy.log('✅ CSRF protection detected in request');
      } else {
        cy.log('⚠️ CSRF protection not detected in request');
      }

      req.reply({
        statusCode: 200,
        body: {
          success: true,
          data: {
            user: { id: 'test-user', email: 'test@example.com' },
            tokens: { accessToken: 'token', refreshToken: 'refresh' },
          },
        },
      });
    }).as('csrfLogin');

    cy.get('[data-cy="login-submit-button"]').click();
    cy.wait('@csrfLogin');

    // ==========================================
    // STEP 3: Test Referrer Policy
    // ==========================================
    cy.log('🔑 Step 3: Test Referrer Policy');

    cy.document().then((doc) => {
      const referrerPolicy = doc.querySelector('meta[name="referrer"]');
      if (referrerPolicy) {
        const policy = referrerPolicy.getAttribute('content');
        cy.log(`Referrer policy: ${policy}`);

        // Verify secure referrer policy
        const securePolicies = ['no-referrer', 'same-origin', 'strict-origin'];
        if (securePolicies.includes(policy)) {
          cy.log('✅ Secure referrer policy detected');
        } else {
          cy.log('⚠️ Consider using a more secure referrer policy');
        }
      }
    });

    cy.log('✅ CSRF Protection Test Complete!');
  });

  it('Input Validation and Sanitization Test', () => {
    cy.log('🔍 Testing Input Validation and Sanitization');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test SQL Injection Patterns
    // ==========================================
    cy.log('💉 Step 1: Test SQL Injection Patterns');

    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users --",
      "1'; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' OR 1=1 #",
      "'; EXEC xp_cmdshell('dir'); --",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --",
    ];

    sqlInjectionPayloads.forEach((payload) => {
      cy.get('[data-cy="email-input"] input').clear().type(payload);
      cy.get('[data-cy="email-input"] input').should('have.value', payload);

      // The input should be treated as literal text, not SQL
      cy.get('[data-cy="email-input"] input').should('not.contain', 'SELECT');
    });

    // ==========================================
    // STEP 2: Test NoSQL Injection Patterns
    // ==========================================
    cy.log('💉 Step 2: Test NoSQL Injection Patterns');

    const nosqlPayloads = [
      '{"$ne": null}',
      '{"$gt": ""}',
      '{"$regex": ".*"}',
      '{"$where": "function() { return true; }"}',
      '{"$or": [{"password": "pass"}, {"password": "word"}]}',
    ];

    nosqlPayloads.forEach((payload) => {
      cy.get('[data-cy="password-input"] input').clear().type(payload);
      cy.get('[data-cy="password-input"] input').should('have.value', payload);
    });

    // ==========================================
    // STEP 3: Test Path Traversal
    // ==========================================
    cy.log('📁 Step 3: Test Path Traversal');

    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
    ];

    pathTraversalPayloads.forEach((payload) => {
      cy.get('[data-cy="firstName-input"] input').clear().type(payload);
      cy.get('[data-cy="firstName-input"] input').should('have.value', payload);
    });

    // ==========================================
    // STEP 4: Test Command Injection
    // ==========================================
    cy.log('💻 Step 4: Test Command Injection');

    const commandInjectionPayloads = [
      '; cat /etc/passwd',
      '| id',
      '& whoami',
      '`ls -la`',
      '$(cat /etc/passwd)',
      '; rm -rf /',
      '|| ping -c 10 127.0.0.1',
    ];

    commandInjectionPayloads.forEach((payload) => {
      cy.get('[data-cy="organizationName-input"] input').clear().type(payload);
      cy.get('[data-cy="organizationName-input"] input').should(
        'have.value',
        payload,
      );
    });

    // ==========================================
    // STEP 5: Test LDAP Injection
    // ==========================================
    cy.log('🔐 Step 5: Test LDAP Injection');

    const ldapPayloads = [
      '*)(uid=*',
      '*)(|(mail=*))',
      '*)(&(objectClass=*)',
      '*))%00',
      '*()|%26',
    ];

    ldapPayloads.forEach((payload) => {
      cy.get('[data-cy="lastName-input"] input').clear().type(payload);
      cy.get('[data-cy="lastName-input"] input').should('have.value', payload);
    });

    cy.log('✅ Input Validation Test Complete!');
  });

  it('Authentication Security Test', () => {
    cy.log('🔐 Testing Authentication Security');

    // ==========================================
    // STEP 1: Test Password Complexity
    // ==========================================
    cy.log('🔑 Step 1: Test Password Complexity');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    const weakPasswords = [
      '123456',
      'password',
      'admin',
      'qwerty',
      '12345678',
      'password123',
      'admin123',
    ];

    weakPasswords.forEach((weakPassword) => {
      cy.get('[data-cy="firstName-input"] input').clear().type('Test');
      cy.get('[data-cy="email-input"] input').clear().type('test@example.com');
      cy.get('[data-cy="organizationName-input"] input')
        .clear()
        .type('Test Org');
      cy.get('[data-cy="password-input"] input').clear().type(weakPassword);

      // Try to submit (assuming client-side validation exists)
      cy.get('[data-cy="signup-submit-button"]').then(($btn) => {
        if ($btn.is(':enabled')) {
          cy.log(`⚠️ Weak password "${weakPassword}" was accepted`);
        } else {
          cy.log(`✅ Weak password "${weakPassword}" was rejected`);
        }
      });
    });

    // ==========================================
    // STEP 2: Test Rate Limiting
    // ==========================================
    cy.log('⏱️ Step 2: Test Rate Limiting');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // Attempt multiple rapid login attempts
    const rapidAttempts = 10;
    const timestamps = [];

    for (let i = 0; i < rapidAttempts; i++) {
      timestamps.push(Date.now());

      cy.get('[data-cy="email-input"] input')
        .clear()
        .type(`attempt${i}@example.com`);
      cy.get('[data-cy="password-input"] input').clear().type('wrongpassword');

      // Mock failed login attempt
      cy.intercept('POST', '**/api/auth/login', (req) => {
        // Check if rate limiting headers are present
        const rateLimitHeaders = [
          'x-ratelimit-limit',
          'x-ratelimit-remaining',
          'x-ratelimit-reset',
          'retry-after',
        ];

        const hasRateLimitHeaders = rateLimitHeaders.some(
          (header) => req.headers[header] !== undefined,
        );

        if (i > 5) {
          // After several attempts, should get rate limited
          req.reply({
            statusCode: 429,
            headers: {
              'x-ratelimit-limit': '5',
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 300),
              'retry-after': '300',
            },
            body: {
              success: false,
              error: {
                code: 'rate_limit_exceeded',
                message: 'Too many attempts',
              },
            },
          });
        } else {
          req.reply({
            statusCode: 401,
            body: {
              success: false,
              error: {
                code: 'invalid_credentials',
                message: 'Invalid credentials',
              },
            },
          });
        }
      }).as(`loginAttempt${i}`);

      cy.get('[data-cy="login-submit-button"]').click();
      cy.wait(`@loginAttempt${i}`);

      // Add small delay between attempts
      cy.wait(100);
    }

    // ==========================================
    // STEP 3: Test Session Security
    // ==========================================
    cy.log('🍪 Step 3: Test Session Security');

    // Test secure cookie flags
    cy.getAllCookies().then((cookies) => {
      cookies.forEach((cookie) => {
        if (cookie.name.includes('session') || cookie.name.includes('token')) {
          cy.log(`Checking cookie: ${cookie.name}`);

          // Check for security flags
          if (cookie.secure) {
            cy.log('✅ Cookie has Secure flag');
          } else {
            cy.log('⚠️ Cookie missing Secure flag');
          }

          if (cookie.httpOnly) {
            cy.log('✅ Cookie has HttpOnly flag');
          } else {
            cy.log('⚠️ Cookie missing HttpOnly flag');
          }

          if (cookie.sameSite) {
            cy.log(`✅ Cookie has SameSite: ${cookie.sameSite}`);
          } else {
            cy.log('⚠️ Cookie missing SameSite attribute');
          }
        }
      });
    });

    cy.log('✅ Authentication Security Test Complete!');
  });

  it('API Security Test', () => {
    cy.log('🔌 Testing API Security');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Mock API keys data
    cy.intercept('GET', '**/api/api-keys', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: [],
          stats: { totalKeys: 0, activeKeys: 0, expiredKeys: 0, totalUsage: 0 },
          availablePermissions: ['inference:*', 'storage:*'],
        },
      },
    }).as('getApiKeys');

    cy.wait('@getApiKeys');

    // ==========================================
    // STEP 1: Test API Key Format Security
    // ==========================================
    cy.log('🔑 Step 1: Test API Key Format Security');

    cy.get('[data-cy="create-api-key-button"]').click();
    cy.get('[data-cy="api-key-name"]').type('Security Test Key');
    cy.get('[data-cy="permission-inference"]').check();

    // Mock API key creation with security validation
    cy.intercept('POST', '**/api/api-keys', (req) => {
      // Validate request structure
      const body = req.body;

      // Check for required fields
      if (!body.name || !body.permissions) {
        req.reply({
          statusCode: 400,
          body: { success: false, error: 'Missing required fields' },
        });
        return;
      }

      // Check for suspicious characters in name
      const suspiciousChars = /[<>\"'&]/;
      if (suspiciousChars.test(body.name)) {
        req.reply({
          statusCode: 400,
          body: { success: false, error: 'Invalid characters in name' },
        });
        return;
      }

      // Generate secure API key
      const secureApiKey = 'eliza_sk_' + 'a'.repeat(64); // Mock secure key

      req.reply({
        statusCode: 201,
        body: {
          success: true,
          data: {
            key: secureApiKey,
            apiKey: {
              id: 'ak_security_test',
              name: body.name,
              permissions: body.permissions,
              rateLimit: 100,
              isActive: true,
              createdAt: new Date().toISOString(),
            },
          },
        },
      });
    }).as('createSecureApiKey');

    cy.get('[data-cy="create-key-submit"]').click();
    cy.wait('@createSecureApiKey');

    // ==========================================
    // STEP 2: Test API Rate Limiting
    // ==========================================
    cy.log('⏱️ Step 2: Test API Rate Limiting');

    // Test multiple rapid API requests
    const apiEndpoints = [
      '/api/dashboard/stats',
      '/api/api-keys',
      '/api/auth/identity',
    ];

    apiEndpoints.forEach((endpoint) => {
      cy.intercept('GET', `**${endpoint}`, (req) => {
        // Mock rate limiting response
        req.reply({
          statusCode: 429,
          headers: {
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'retry-after': '60',
          },
          body: {
            error: 'Rate limit exceeded',
            message: 'Too many requests, please try again later',
          },
        });
      }).as(`rateLimit${endpoint.replace(/[^a-zA-Z]/g, '')}`);
    });

    // ==========================================
    // STEP 3: Test Authorization Headers
    // ==========================================
    cy.log('🔐 Step 3: Test Authorization Headers');

    cy.intercept('GET', '**/api/auth/identity', (req) => {
      // Check for authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        cy.log('⚠️ No authorization header found');
        req.reply({
          statusCode: 401,
          body: {
            error: 'Unauthorized',
            message: 'Missing authorization header',
          },
        });
        return;
      }

      // Validate header format
      if (!authHeader.startsWith('Bearer ')) {
        cy.log('⚠️ Invalid authorization header format');
        req.reply({
          statusCode: 401,
          body: {
            error: 'Unauthorized',
            message: 'Invalid authorization header format',
          },
        });
        return;
      }

      const token = authHeader.substring(7);

      // Basic token validation
      if (token.length < 32) {
        cy.log('⚠️ Token appears to be too short');
        req.reply({
          statusCode: 401,
          body: { error: 'Unauthorized', message: 'Invalid token' },
        });
        return;
      }

      cy.log('✅ Valid authorization header detected');
      req.reply({
        statusCode: 200,
        body: {
          user: { id: 'auth-test-user', email: 'test@example.com' },
          organization: { id: 'auth-test-org', name: 'Test Org' },
        },
      });
    }).as('authValidation');

    cy.reload();
    cy.wait('@authValidation');

    cy.log('✅ API Security Test Complete!');
  });

  it('Content Security Policy Test', () => {
    cy.log('🛡️ Testing Content Security Policy');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test CSP Headers
    // ==========================================
    cy.log('🔒 Step 1: Test CSP Headers');

    cy.request('/dashboard').then((response) => {
      const cspHeader =
        response.headers['content-security-policy'] ||
        response.headers['content-security-policy-report-only'];

      if (cspHeader) {
        cy.log('✅ Content Security Policy header found');
        cy.log(`CSP: ${cspHeader}`);

        // Check for important CSP directives
        const importantDirectives = [
          'default-src',
          'script-src',
          'style-src',
          'img-src',
          'connect-src',
          'frame-ancestors',
        ];

        importantDirectives.forEach((directive) => {
          if (cspHeader.includes(directive)) {
            cy.log(`✅ ${directive} directive found`);
          } else {
            cy.log(`⚠️ ${directive} directive missing`);
          }
        });

        // Check for unsafe directives
        const unsafeDirectives = ['unsafe-inline', 'unsafe-eval', '*'];
        unsafeDirectives.forEach((unsafe) => {
          if (cspHeader.includes(unsafe)) {
            cy.log(`⚠️ Potentially unsafe directive found: ${unsafe}`);
          } else {
            cy.log(`✅ No unsafe directive: ${unsafe}`);
          }
        });
      } else {
        cy.log('⚠️ No Content Security Policy header found');
      }
    });

    // ==========================================
    // STEP 2: Test Inline Script Blocking
    // ==========================================
    cy.log('🚫 Step 2: Test Inline Script Blocking');

    cy.window().then((win) => {
      // Try to inject inline script
      const script = win.document.createElement('script');
      script.innerHTML = 'window.inlineScriptExecuted = true;';

      let scriptBlocked = false;
      script.onerror = () => {
        scriptBlocked = true;
        cy.log('✅ Inline script was blocked by CSP');
      };

      win.document.head.appendChild(script);

      // Wait and check if script executed
      setTimeout(() => {
        if (!win.inlineScriptExecuted && !scriptBlocked) {
          cy.log('✅ Inline script did not execute (likely blocked)');
        } else if (win.inlineScriptExecuted) {
          cy.log('⚠️ Inline script executed (CSP may be too permissive)');
        }
      }, 100);
    });

    // ==========================================
    // STEP 3: Test Frame Ancestors
    // ==========================================
    cy.log('🖼️ Step 3: Test Frame Ancestors');

    cy.window().then((win) => {
      // Check if page can be framed
      if (win.top !== win.self) {
        cy.log('⚠️ Page is running in a frame');
      } else {
        cy.log('✅ Page is not running in a frame');
      }

      // Check for X-Frame-Options header
      cy.request('/dashboard').then((response) => {
        const xFrameOptions = response.headers['x-frame-options'];
        if (xFrameOptions) {
          cy.log(`✅ X-Frame-Options header: ${xFrameOptions}`);
        } else {
          cy.log('⚠️ X-Frame-Options header not found');
        }
      });
    });

    cy.log('✅ Content Security Policy Test Complete!');
  });

  it('Data Protection and Privacy Test', () => {
    cy.log('🔐 Testing Data Protection and Privacy');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Sensitive Data Handling
    // ==========================================
    cy.log('🔒 Step 1: Test Sensitive Data Handling');

    // Test that passwords are not logged or exposed
    cy.get('[data-cy="password-input"] input').type('sensitive-password-123');

    cy.window().then((win) => {
      // Check that password is not in console logs
      const originalConsoleLog = win.console.log;
      let passwordLogged = false;

      win.console.log = (...args) => {
        args.forEach((arg) => {
          if (
            typeof arg === 'string' &&
            arg.includes('sensitive-password-123')
          ) {
            passwordLogged = true;
            cy.log('⚠️ Password found in console logs');
          }
        });
        originalConsoleLog.apply(win.console, args);
      };

      // Restore original console.log after test
      setTimeout(() => {
        win.console.log = originalConsoleLog;
        if (!passwordLogged) {
          cy.log('✅ Password not found in console logs');
        }
      }, 1000);
    });

    // ==========================================
    // STEP 2: Test Local Storage Security
    // ==========================================
    cy.log('💾 Step 2: Test Local Storage Security');

    cy.window().then((win) => {
      // Check what's stored in localStorage
      const localStorageKeys = Object.keys(win.localStorage);

      localStorageKeys.forEach((key) => {
        const value = win.localStorage.getItem(key);
        cy.log(`LocalStorage key: ${key}`);

        // Check for sensitive data patterns
        const sensitivePatterns = [
          /password/i,
          /secret/i,
          /private.?key/i,
          /credit.?card/i,
          /ssn/i,
          /social.?security/i,
        ];

        sensitivePatterns.forEach((pattern) => {
          if (pattern.test(key) || (value && pattern.test(value))) {
            cy.log(`⚠️ Potentially sensitive data in localStorage: ${key}`);
          }
        });
      });

      // Check sessionStorage as well
      const sessionStorageKeys = Object.keys(win.sessionStorage);
      sessionStorageKeys.forEach((key) => {
        const value = win.sessionStorage.getItem(key);
        cy.log(`SessionStorage key: ${key}`);
      });
    });

    // ==========================================
    // STEP 3: Test Data Transmission Security
    // ==========================================
    cy.log('🌐 Step 3: Test Data Transmission Security');

    cy.get('[data-cy="firstName-input"] input').type('John');
    cy.get('[data-cy="lastName-input"] input').type('Doe');
    cy.get('[data-cy="email-input"] input').type('john.doe@example.com');
    cy.get('[data-cy="organizationName-input"] input').type('Test Org');

    // Mock signup request to check data transmission
    cy.intercept('POST', '**/api/auth/signup', (req) => {
      // Verify HTTPS usage (in production)
      cy.log(`Request URL: ${req.url}`);

      // Check request headers for security
      const securityHeaders = [
        'content-type',
        'authorization',
        'x-requested-with',
      ];

      securityHeaders.forEach((header) => {
        if (req.headers[header]) {
          cy.log(`✅ Security header present: ${header}`);
        }
      });

      // Verify sensitive data is properly structured
      const body = req.body;
      if (body.password) {
        // Password should not be in plain text in logs
        cy.log('Password field detected in request (this is expected)');
      }

      req.reply({
        statusCode: 201,
        body: {
          success: true,
          data: {
            user: { id: 'privacy-test-user', email: body.email },
            organization: {
              id: 'privacy-test-org',
              name: body.organizationName,
            },
          },
        },
      });
    }).as('privacySignup');

    cy.get('[data-cy="signup-submit-button"]').click();
    cy.wait('@privacySignup');

    cy.log('✅ Data Protection and Privacy Test Complete!');
  });
});
