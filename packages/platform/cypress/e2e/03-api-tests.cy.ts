describe('API Tests', () => {
  const API_URL = 'http://localhost:3333/api/v1';
  let authToken: string;
  let testApiKey: string;
  let testApiKeyId: string;

  // Helper function to make API requests
  const apiRequest = (method: string, endpoint: string, options: any = {}) => {
    return cy.request({
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(options.auth && { Authorization: `Bearer ${authToken}` }),
        ...(options.apiKey && { 'X-API-Key': options.apiKey }),
        ...options.headers,
      },
      body: options.body,
      failOnStatusCode: false,
    });
  };

  describe('Health Check', () => {
    it('should return health status', () => {
      apiRequest('GET', '/health').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('status', 'ok');
        expect(response.body).to.have.property('timestamp');
        expect(response.body).to.have.property('version');
      });
    });
  });

  describe('Authentication', () => {
    const testUser = {
      email: `test-${Date.now()}@elizaos.ai`,
      password: 'TestPassword123!',
      name: 'Test User',
    };

    it('should register a new user', () => {
      apiRequest('POST', '/auth/register', { body: testUser }).then(
        (response) => {
          expect(response.status).to.eq(201);
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.have.property('user');
          expect(response.body.data).to.have.property('token');
          expect(response.body.data.user.email).to.eq(testUser.email);
          expect(response.body.data.user.name).to.eq(testUser.name);
          authToken = response.body.data.token;
        },
      );
    });

    it('should not register duplicate email', () => {
      apiRequest('POST', '/auth/register', { body: testUser }).then(
        (response) => {
          expect(response.status).to.eq(409);
          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('already exists');
        },
      );
    });

    it('should validate registration input', () => {
      const invalidUser = { email: 'invalid-email', password: '123', name: '' };
      apiRequest('POST', '/auth/register', { body: invalidUser }).then(
        (response) => {
          expect(response.status).to.eq(400);
          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('Invalid input');
        },
      );
    });

    it('should login with valid credentials', () => {
      apiRequest('POST', '/auth/login', {
        body: { email: testUser.email, password: testUser.password },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property('user');
        expect(response.body.data).to.have.property('token');
        expect(response.body.data.user.email).to.eq(testUser.email);
      });
    });

    it('should not login with invalid credentials', () => {
      apiRequest('POST', '/auth/login', {
        body: { email: testUser.email, password: 'WrongPassword' },
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include('Invalid credentials');
      });
    });

    it('should get current user with valid token', () => {
      apiRequest('GET', '/auth/me', { auth: true }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.user.email).to.eq(testUser.email);
      });
    });

    it('should not get current user without token', () => {
      apiRequest('GET', '/auth/me').then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.success).to.be.false;
      });
    });

    it('should logout successfully', () => {
      apiRequest('POST', '/auth/logout', { auth: true }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });
  });

  describe('API Keys', () => {
    before(() => {
      // Login to get auth token for API key tests
      const loginUser = {
        email: 'test@elizaos.ai',
        password: 'TestPassword123!',
      };
      apiRequest('POST', '/auth/login', { body: loginUser }).then(
        (response) => {
          authToken = response.body.data.token;
        },
      );
    });

    it('should list API keys (initially empty)', () => {
      apiRequest('GET', '/api-keys', { auth: true }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property('apiKeys');
        expect(response.body.data).to.have.property('pagination');
        expect(response.body.data.apiKeys).to.be.an('array');
      });
    });

    it('should create a new API key', () => {
      apiRequest('POST', '/api-keys', {
        auth: true,
        body: { name: 'Test API Key', expiresIn: '30d' },
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.success).to.be.true;
        expect(response.body.data.apiKey).to.have.property('id');
        expect(response.body.data.apiKey).to.have.property('key');
        expect(response.body.data.apiKey.name).to.eq('Test API Key');
        testApiKey = response.body.data.apiKey.key;
        testApiKeyId = response.body.data.apiKey.id;
      });
    });

    it('should validate API key creation input', () => {
      apiRequest('POST', '/api-keys', {
        auth: true,
        body: { name: '' },
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.success).to.be.false;
      });
    });

    it('should list API keys with created key', () => {
      apiRequest('GET', '/api-keys', { auth: true }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.apiKeys).to.have.length.greaterThan(0);
        const key = response.body.data.apiKeys.find(
          (k: any) => k.id === testApiKeyId,
        );
        expect(key).to.exist;
        expect(key.name).to.eq('Test API Key');
        // Key should be masked
        expect(key.key).to.include('sk_live_...');
      });
    });

    it('should authenticate with API key', () => {
      apiRequest('GET', '/auth/me', { apiKey: testApiKey }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should delete API key', () => {
      apiRequest('DELETE', `/api-keys/${testApiKeyId}`, { auth: true }).then(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
        },
      );
    });

    it('should not authenticate with deleted API key', () => {
      apiRequest('GET', '/auth/me', { apiKey: testApiKey }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.success).to.be.false;
      });
    });

    it('should not delete non-existent API key', () => {
      apiRequest('DELETE', '/api-keys/non-existent-id', { auth: true }).then(
        (response) => {
          expect(response.status).to.eq(404);
          expect(response.body.success).to.be.false;
        },
      );
    });
  });

  describe('Organizations', () => {
    before(() => {
      // Ensure we have auth token
      if (!authToken) {
        const loginUser = {
          email: 'test@elizaos.ai',
          password: 'TestPassword123!',
        };
        apiRequest('POST', '/auth/login', { body: loginUser }).then(
          (response) => {
            authToken = response.body.data.token;
          },
        );
      }
    });

    it('should list organizations (initially empty)', () => {
      apiRequest('GET', '/organizations', { auth: true }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.organizations).to.be.an('array');
      });
    });

    it('should create a new organization', () => {
      apiRequest('POST', '/organizations', {
        auth: true,
        body: { name: 'Test Organization' },
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.success).to.be.true;
        expect(response.body.data.organization).to.have.property('id');
        expect(response.body.data.organization.name).to.eq('Test Organization');
        expect(response.body.data.organization.slug).to.eq('test-organization');
      });
    });

    it('should validate organization creation input', () => {
      apiRequest('POST', '/organizations', {
        auth: true,
        body: { name: '' },
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.success).to.be.false;
      });
    });

    it('should list organizations with created org', () => {
      apiRequest('GET', '/organizations', { auth: true }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.organizations).to.have.length.greaterThan(0);
        const org = response.body.data.organizations.find(
          (o: any) => o.name === 'Test Organization',
        );
        expect(org).to.exist;
      });
    });
  });

  describe('Billing', () => {
    before(() => {
      // Ensure we have auth token
      if (!authToken) {
        const loginUser = {
          email: 'test@elizaos.ai',
          password: 'TestPassword123!',
        };
        apiRequest('POST', '/auth/login', { body: loginUser }).then(
          (response) => {
            authToken = response.body.data.token;
          },
        );
      }
    });

    it('should get subscription details (free tier)', () => {
      apiRequest('GET', '/billing/subscription', { auth: true }).then(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data.subscription).to.have.property('status');
          expect(response.body.data.subscription).to.have.property('plan');
        },
      );
    });

    it('should create checkout session', () => {
      apiRequest('POST', '/billing/checkout', {
        auth: true,
        body: { plan: 'pro' },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property('url');
        expect(response.body.data.url).to.include('checkout.stripe.com');
      });
    });

    it('should validate checkout plan', () => {
      apiRequest('POST', '/billing/checkout', {
        auth: true,
        body: { plan: 'invalid-plan' },
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.success).to.be.false;
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting gracefully', () => {
      // Make multiple rapid requests
      const requests = Array(10)
        .fill(null)
        .map(() => apiRequest('GET', '/health'));

      cy.wrap(Promise.all(requests)).then((responses) => {
        // All should succeed or some should be rate limited
        (responses as any[]).forEach((response) => {
          expect([200, 429]).to.include(response.status);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', () => {
      apiRequest('GET', '/non-existent-endpoint').then((response) => {
        expect(response.status).to.eq(404);
      });
    });

    it('should handle malformed JSON', () => {
      cy.request({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });
  });
});
