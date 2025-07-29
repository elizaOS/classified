import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { readFileSync } from 'fs';
import { join } from 'path';

async function handleGET(request: NextRequest) {
  try {
    const yamlPath = join(process.cwd(), 'lib', 'openapi-spec.yaml');
    const yamlContent = readFileSync(yamlPath, 'utf-8');

    return new NextResponse(yamlContent, {
      headers: {
        'Content-Type': 'application/yaml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to load OpenAPI spec:', error);

    // Provide a minimal OpenAPI spec as fallback
    const fallbackSpec = `
openapi: 3.0.3
info:
  title: ElizaOS Platform API
  description: |
    The ElizaOS Platform API provides programmatic access to manage AI agents, organizations, API keys, and billing.

    ## Authentication

    The API supports Bearer Token authentication:
    \`\`\`
    Authorization: Bearer <access_token>
    \`\`\`

    ## Rate Limiting

    API requests are rate limited per organization. Standard limits:
    - 1000 requests per hour for free tier
    - 10000 requests per hour for pro tier
    
  version: 1.0.0
  contact:
    name: ElizaOS Platform Support
    url: https://elizaos.ai/support
    email: support@elizaos.ai
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.elizaos.ai
    description: Production server
  - url: http://localhost:3333
    description: Development server

paths:
  /api/auth/identity:
    get:
      summary: Get current user identity
      description: Returns the authenticated user's profile and organization information
      security:
        - bearerAuth: []
      responses:
        '200':
          description: User identity retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
                      organization:
                        $ref: '#/components/schemas/Organization'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/agents:
    get:
      summary: List agents
      description: Get a list of agents for the authenticated user
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Agents retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      agents:
                        type: array
                        items:
                          $ref: '#/components/schemas/Agent'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        firstName:
          type: string
        lastName:
          type: string
        organizationId:
          type: string
          format: uuid
        role:
          type: string
          enum: [owner, admin, member]

    Organization:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        slug:
          type: string
        subscriptionTier:
          type: string
          enum: [free, pro, enterprise]
        creditBalance:
          type: string

    Agent:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        status:
          type: string
          enum: [active, inactive, draft]

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Unauthorized
`;

    return new NextResponse(fallbackSpec, {
      headers: {
        'Content-Type': 'application/yaml',
        'Cache-Control': 'public, max-age=300',
        'X-Fallback': 'true',
      },
    });
  }
}

export const { GET } = wrapHandlers({ handleGET });
