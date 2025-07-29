# ElizaOS Platform Developer Guide

Welcome to the ElizaOS Platform! This comprehensive guide will help you understand, contribute to, and extend the platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Development Setup](#development-setup)
4. [Core Concepts](#core-concepts)
5. [Building Features](#building-features)
6. [Testing](#testing)
7. [Security](#security)
8. [Performance](#performance)
9. [Deployment](#deployment)
10. [Contributing](#contributing)

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 14+
- Redis (optional, for caching)
- Git

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/elizaos/platform.git
cd platform

# Install dependencies
bun install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up database
bun run db:setup

# Start development server
bun run dev
```

Visit `http://localhost:3333` to see the platform in action.

## Architecture Overview

The ElizaOS Platform follows a modern, scalable architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Layer     │    │   Core Services │
│   (Next.js)     │────│   (REST/WS)     │────│   (Business)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Cache Layer   │    │   External APIs │
│   (PostgreSQL)  │────│   (Redis)       │────│   (WorkOS, etc) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with comprehensive middleware
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: WorkOS integration with JWT sessions
- **Caching**: Redis with multi-layer fallback
- **Security**: Advanced security headers, rate limiting, audit logging
- **Monitoring**: Comprehensive performance and security monitoring

## Development Setup

### Environment Configuration

Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/elizaos_platform"

# Authentication
JWT_SECRET="your-jwt-secret-here"
WORKOS_API_KEY="your-workos-api-key"
WORKOS_CLIENT_ID="your-workos-client-id"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# External Services
OPENAI_API_KEY="your-openai-key"
ANTHROPIC_API_KEY="your-anthropic-key"
```

### Database Setup

```bash
# Run migrations
bun run db:migrate

# Seed development data
bun run db:seed

# Reset database (careful!)
bun run db:reset
```

### Development Commands

```bash
# Start development server
bun run dev

# Run tests
bun run test
bun run test:e2e

# Type checking
bun run type-check

# Linting
bun run lint
bun run lint:fix

# Build for production
bun run build
```

## Core Concepts

### Authentication & Authorization

The platform uses a layered authentication system:

1. **WorkOS Integration**: SSO and organization management
2. **JWT Sessions**: Stateless session management
3. **Role-based Access**: Owner, Admin, Member roles
4. **API Key Authentication**: For programmatic access

```typescript
// Example: Checking authentication in API routes
import { sessionService } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await sessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin access
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with request...
}
```

### Database Patterns

We use consistent patterns across the platform:

```typescript
// Repository pattern for data access
export class UserRepository {
  async getCurrent(): Promise<User | null> {
    const context = getDatabaseContext();
    if (!context.userId) return null;

    return await this.sql.query('SELECT * FROM users WHERE id = $1', [
      context.userId,
    ]);
  }
}

// Database context for multi-tenancy
await setDatabaseContext({
  organizationId: session.organizationId,
  userId: session.userId,
});
```

### Caching Strategy

Multi-layer caching for optimal performance:

```typescript
import { cacheManager } from '@/lib/cache/cache-manager';

// Cache with automatic fallback
const data = await cacheManager.get(
  'user-data',
  async () => {
    // Expensive database query
    return await fetchUserData();
  },
  { ttl: 300, tags: ['users'] },
);

// Invalidate related cache
await cacheManager.invalidateByTag('users');
```

### Security Middleware

Every API route should use security middleware:

```typescript
import { withSecurityHeaders } from '@/lib/security/headers';
import { createRateLimitMiddleware } from '@/lib/security/rate-limiter';

// Apply security headers and rate limiting
export const GET = withSecurityHeaders(
  createRateLimitMiddleware(rateLimitConfigs.api)(async function handler(
    request: NextRequest,
  ) {
    // Your route logic here
  }),
);
```

## Building Features

### API Route Structure

Follow this pattern for all API routes:

```typescript
// app/api/your-feature/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/lib/auth/session';
import { withSecurityHeaders } from '@/lib/security/headers';
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger';

async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Authorization (if needed)
    if (!session.isAdmin && request.url.includes('/admin/')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 3. Input validation
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // 4. Business logic
    const data = await yourBusinessLogic(session.organizationId, { limit });

    // 5. Audit logging (for sensitive operations)
    await auditLogger.logEvent({
      eventType: AuditEventType.DATA_EXPORTED,
      severity: AuditSeverity.LOW,
      userId: session.userId,
      organizationId: session.organizationId,
      details: { operation: 'fetch_data', limit },
      metadata: {
        ipAddress: request.ip,
        userAgent: request.headers.get('user-agent'),
        source: 'api',
        timestamp: new Date(),
      },
    });

    // 6. Response
    return NextResponse.json({
      success: true,
      data,
      pagination: { limit, total: data.length },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}

// Always export with security headers
export { withSecurityHeaders(GET) as GET };
```

### Frontend Component Patterns

Use consistent patterns for components:

```typescript
// components/feature/YourComponent.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface YourComponentProps {
  id?: string;
  onSuccess?: () => void;
}

export default function YourComponent({ id, onSuccess }: YourComponentProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/your-endpoint/${id}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-cy="your-component">
      <CardHeader>
        <CardTitle>Your Feature</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div>
            {/* Your component content */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Database Migrations

Create migrations for schema changes:

```sql
-- lib/database/migrations/XXX_your_migration.sql
-- Migration XXX: Description of changes

CREATE TABLE IF NOT EXISTS your_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_your_table_org ON your_table(organization_id);
CREATE INDEX idx_your_table_name ON your_table(name);

-- Row-level security (if needed)
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY your_table_org_isolation ON your_table
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON your_table TO platform_user;
```

## Testing

### Unit Tests

Write comprehensive unit tests:

```typescript
// __tests__/lib/your-service.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { YourService } from '@/lib/your-service';

describe('YourService', () => {
  let service: YourService;

  beforeEach(() => {
    service = new YourService();
  });

  it('should handle valid input correctly', async () => {
    const result = await service.processData('valid-input');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should throw error for invalid input', async () => {
    await expect(service.processData('')).rejects.toThrow('Invalid input');
  });
});
```

### E2E Tests

Write Cypress tests for user flows:

```typescript
// cypress/e2e/your-feature.cy.ts
describe('Your Feature', () => {
  beforeEach(() => {
    cy.clearAuthState();
    cy.devLogin();
  });

  it('should complete user workflow successfully', () => {
    // Navigate to feature
    cy.visit('/your-feature');
    cy.get('[data-cy="your-component"]').should('be.visible');

    // Interact with the feature
    cy.get('[data-cy="action-button"]').click();
    cy.get('[data-cy="result"]').should('contain', 'Success');
  });

  it('should handle errors gracefully', () => {
    // Mock API error
    cy.intercept('POST', '/api/your-endpoint', {
      statusCode: 500,
      body: { success: false, error: 'Server error' },
    });

    cy.visit('/your-feature');
    cy.get('[data-cy="action-button"]').click();
    cy.contains('Server error').should('be.visible');
  });
});
```

## Security

### Security Checklist

- [ ] All API routes use authentication middleware
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (proper escaping)
- [ ] CSRF protection (SameSite cookies)
- [ ] Rate limiting on all endpoints
- [ ] Security headers applied
- [ ] Sensitive operations are audited
- [ ] Proper error handling (no stack traces in production)

### Security Headers

The platform automatically applies security headers:

```typescript
// Automatically applied to all API routes
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': '...',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
```

### Audit Logging

Log all sensitive operations:

```typescript
import {
  auditLogger,
  AuditEventType,
  AuditSeverity,
} from '@/lib/security/audit-logger';

// Log user actions
await auditLogger.logEvent({
  eventType: AuditEventType.USER_CREATED,
  severity: AuditSeverity.MEDIUM,
  userId: session.userId,
  organizationId: session.organizationId,
  entityId: newUser.id,
  details: { email: newUser.email, role: newUser.role },
  metadata: {
    ipAddress: request.ip,
    userAgent: request.headers.get('user-agent'),
    source: 'api',
    timestamp: new Date(),
  },
});
```

## Performance

### Optimization Guidelines

1. **Database**: Use indexes, limit queries, pagination
2. **Caching**: Cache expensive operations, use appropriate TTL
3. **Frontend**: Code splitting, lazy loading, image optimization
4. **API**: Rate limiting, response compression, efficient serialization

### Performance Monitoring

The platform includes comprehensive performance monitoring:

```typescript
import { performanceMonitor } from '@/lib/performance/monitoring';

// Profile function execution
const optimizedFunction = performanceMonitor.profile(
  expensiveFunction,
  'data-processing',
);

// Manual timing
const timer = performanceMonitor.timer('custom-operation');
await customOperation();
timer.stop();

// Get performance metrics
const metrics = performanceMonitor.getPerformanceReport();
```

### Database Optimization

Use the database optimizer for query analysis:

```typescript
import { dbOptimizer } from '@/lib/performance/database-optimizer';

// Execute with monitoring
const result = await dbOptimizer.executeQuery(
  'SELECT * FROM users WHERE organization_id = $1',
  [organizationId],
  { cache: true, cacheTTL: 300 },
);

// Get optimization suggestions
const suggestions = await dbOptimizer.suggestIndexes();
```

## Deployment

### Environment Setup

1. **Development**: Local development with hot reloading
2. **Staging**: Production-like environment for testing
3. **Production**: Optimized build with monitoring

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS certificates configured
- [ ] Monitoring and alerting set up
- [ ] Backup strategy implemented
- [ ] Security scanning completed
- [ ] Performance testing completed

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN npm install --frozen-lockfile

# Copy source
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

## Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Make** your changes following the patterns above
4. **Test** your changes: `bun run test && bun run test:e2e`
5. **Commit** with conventional commits: `feat: add new feature`
6. **Push** and create a pull request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Extended rules for consistency
- **Prettier**: Automatic formatting
- **Conventional Commits**: Structured commit messages

### Pull Request Guidelines

- Clear description of changes
- Tests for new functionality
- Documentation updates if needed
- Breaking changes clearly marked
- Performance impact considered

### Getting Help

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Real-time community chat
- **Documentation**: Comprehensive guides and API reference

---

## Additional Resources

- [API Reference](./API_REFERENCE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Security Guide](./SECURITY.md)
- [Performance Guide](./PERFORMANCE.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

Thank you for contributing to ElizaOS Platform! 🚀
