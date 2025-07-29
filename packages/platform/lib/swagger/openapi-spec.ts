export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'ElizaOS Platform API',
    version: '1.0.0',
    description:
      'Comprehensive API for ElizaOS hosted platform with AI inference, storage, billing, and API key management. Supports OpenAI, Anthropic, XAI, Groq, Gemini models with Cloudflare R2 storage and Stripe billing.',
    contact: {
      name: 'ElizaOS Team',
      email: 'support@elizaos.ai',
      url: 'https://elizaos.ai',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001/api/v1',
      description: 'Local development server',
    },
    {
      url: 'https://api.elizaos.ai/v1',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token',
      },
      apiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description:
          'API key for external service authentication. Format: Bearer eliza_your_api_key',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          code: { type: 'string' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          avatar: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          key: { type: 'string' },
          lastUsed: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          ownerId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Subscription: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: {
            type: 'string',
            enum: ['active', 'canceled', 'past_due', 'trialing'],
          },
          plan: {
            type: 'string',
            enum: ['basic', 'pro', 'premium', 'enterprise'],
          },
          currentPeriodEnd: { type: 'string', format: 'date-time' },
          cancelAtPeriodEnd: { type: 'boolean' },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Conflict: {
        description: 'Conflict',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check if the API is running',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        token: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        token: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api-keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List API keys',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'List of API keys',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        apiKeys: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/ApiKey' },
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            total: { type: 'integer' },
                            totalPages: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['API Keys'],
        summary: 'Create API key',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  expiresIn: {
                    type: 'string',
                    enum: ['30d', '90d', '1y', 'never'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'API key created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        apiKey: { $ref: '#/components/schemas/ApiKey' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api-keys/{id}': {
      delete: {
        tags: ['API Keys'],
        summary: 'Delete API key',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'API key deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/organizations': {
      get: {
        tags: ['Organizations'],
        summary: 'List organizations',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of organizations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        organizations: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Organization' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Organization created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        organization: {
                          $ref: '#/components/schemas/Organization',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/billing/subscription': {
      get: {
        tags: ['Billing'],
        summary: 'Get subscription details',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Subscription details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        subscription: {
                          $ref: '#/components/schemas/Subscription',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/billing/checkout': {
      post: {
        tags: ['Billing'],
        summary: 'Create checkout session',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['plan'],
                properties: {
                  plan: { type: 'string', enum: ['basic', 'pro', 'premium'] },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Checkout session created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', format: 'uri' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/billing/credits': {
      get: {
        tags: ['Billing'],
        summary: 'Get credit balance and transactions',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
            description: 'Number of transactions to return',
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
            description: 'Number of transactions to skip',
          },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by transaction type',
          },
          {
            name: 'period',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['day', 'week', 'month', 'year'],
              default: 'month',
            },
            description: 'Statistics period',
          },
        ],
        responses: {
          '200': {
            description: 'Credit information retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        balance: { type: 'number' },
                        transactions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              type: { type: 'string' },
                              amount: { type: 'number' },
                              description: { type: 'string' },
                              balanceAfter: { type: 'number' },
                              createdAt: {
                                type: 'string',
                                format: 'date-time',
                              },
                            },
                          },
                        },
                        statistics: {
                          type: 'object',
                          properties: {
                            totalUsage: { type: 'number' },
                            totalCreditsAdded: { type: 'number' },
                            totalCreditsDeducted: { type: 'number' },
                            transactionCount: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/billing/payment-intent': {
      post: {
        tags: ['Billing'],
        summary: 'Create payment intent',
        description: 'Create a Stripe payment intent to add credits',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount'],
                properties: {
                  amount: {
                    type: 'number',
                    minimum: 5,
                    maximum: 10000,
                    description: 'Amount in USD to charge',
                  },
                  currency: {
                    type: 'string',
                    default: 'usd',
                    description: 'Currency code',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment intent created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        clientSecret: { type: 'string' },
                        paymentIntentId: { type: 'string' },
                        amount: { type: 'number' },
                        currency: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/inference/openai': {
      post: {
        tags: ['AI Inference'],
        summary: 'OpenAI Chat Completion',
        description: 'Generate text using OpenAI models',
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['model', 'messages'],
                properties: {
                  model: {
                    type: 'string',
                    enum: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
                    description: 'The OpenAI model to use',
                  },
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['role', 'content'],
                      properties: {
                        role: {
                          type: 'string',
                          enum: ['system', 'user', 'assistant'],
                        },
                        content: { type: 'string' },
                      },
                    },
                  },
                  temperature: {
                    type: 'number',
                    minimum: 0,
                    maximum: 2,
                    description: 'Sampling temperature',
                  },
                  max_tokens: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 8192,
                    description: 'Maximum tokens to generate',
                  },
                  stream: {
                    type: 'boolean',
                    description: 'Whether to stream the response',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    object: { type: 'string' },
                    created: { type: 'integer' },
                    model: { type: 'string' },
                    choices: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          index: { type: 'integer' },
                          message: {
                            type: 'object',
                            properties: {
                              role: { type: 'string' },
                              content: { type: 'string' },
                            },
                          },
                          finish_reason: { type: 'string' },
                        },
                      },
                    },
                    usage: {
                      type: 'object',
                      properties: {
                        prompt_tokens: { type: 'integer' },
                        completion_tokens: { type: 'integer' },
                        total_tokens: { type: 'integer' },
                        cost: { type: 'number' },
                        billing: {
                          type: 'object',
                          properties: {
                            inputTokens: { type: 'integer' },
                            outputTokens: { type: 'integer' },
                            inputCost: { type: 'number' },
                            outputCost: { type: 'number' },
                            platformFee: { type: 'number' },
                            totalCost: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '402': {
            description: 'Insufficient credits',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/inference/anthropic': {
      post: {
        tags: ['AI Inference'],
        summary: 'Anthropic Message Generation',
        description: 'Generate text using Anthropic Claude models',
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['model', 'messages', 'max_tokens'],
                properties: {
                  model: {
                    type: 'string',
                    enum: [
                      'claude-3-5-sonnet-20241022',
                      'claude-3-5-haiku-20241022',
                      'claude-3-opus-20240229',
                      'claude-3-sonnet-20240229',
                      'claude-3-haiku-20240307',
                    ],
                    description: 'The Anthropic model to use',
                  },
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['role', 'content'],
                      properties: {
                        role: {
                          type: 'string',
                          enum: ['user', 'assistant'],
                        },
                        content: { type: 'string' },
                      },
                    },
                  },
                  max_tokens: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 8192,
                    description: 'Maximum tokens to generate',
                  },
                  temperature: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'Sampling temperature',
                  },
                  system: {
                    type: 'string',
                    description: 'System prompt',
                  },
                  stream: {
                    type: 'boolean',
                    description: 'Whether to stream the response',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    role: { type: 'string' },
                    content: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          text: { type: 'string' },
                        },
                      },
                    },
                    model: { type: 'string' },
                    stop_reason: { type: 'string' },
                    stop_sequence: { type: 'string' },
                    usage: {
                      type: 'object',
                      properties: {
                        input_tokens: { type: 'integer' },
                        output_tokens: { type: 'integer' },
                        cost: { type: 'number' },
                        billing: {
                          type: 'object',
                          properties: {
                            inputTokens: { type: 'integer' },
                            outputTokens: { type: 'integer' },
                            inputCost: { type: 'number' },
                            outputCost: { type: 'number' },
                            platformFee: { type: 'number' },
                            totalCost: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '402': {
            description: 'Insufficient credits',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/storage/upload': {
      post: {
        tags: ['Storage'],
        summary: 'Upload file to storage',
        description: 'Upload files to Cloudflare R2 storage',
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload (max 100MB)',
                  },
                  path: {
                    type: 'string',
                    description: 'Optional path prefix for the file',
                  },
                  public: {
                    type: 'boolean',
                    description: 'Whether to make the file publicly accessible',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'File uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        filename: { type: 'string' },
                        originalFilename: { type: 'string' },
                        path: { type: 'string' },
                        size: { type: 'integer' },
                        contentType: { type: 'string' },
                        publicUrl: { type: 'string', nullable: true },
                        signedUrl: { type: 'string' },
                        uploadedAt: { type: 'string', format: 'date-time' },
                        billing: {
                          type: 'object',
                          properties: {
                            uploadCharge: { type: 'number' },
                            estimatedMonthlyCost: { type: 'number' },
                            fileSize: { type: 'integer' },
                            fileSizeGB: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '413': {
            description: 'File too large',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '402': {
            description: 'Insufficient credits',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Authentication', description: 'User authentication endpoints' },
    { name: 'API Keys', description: 'API key management endpoints' },
    { name: 'Organizations', description: 'Organization management endpoints' },
    {
      name: 'Billing',
      description: 'Billing, credits, and subscription endpoints',
    },
    {
      name: 'AI Inference',
      description: 'AI model inference endpoints (OpenAI, Anthropic, etc.)',
    },
    { name: 'Storage', description: 'File storage endpoints (Cloudflare R2)' },
  ],
};
