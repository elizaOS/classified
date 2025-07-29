# API Route Security Migration Guide

This guide helps developers migrate API routes to use the new security wrapper system that automatically applies security headers and authentication.

## Quick Start

### Before (Old Pattern - "Gross")

```typescript
export async function handleGET(request: NextRequest) {
  // Handler logic
}

export async function handlePOST(request: NextRequest) {
  // Handler logic
}

export const GET = withSecurityHeaders(handleGET);
export const POST = withSecurityHeaders(handlePOST);
```

### After (New Pattern - Clean)

```typescript
import { wrapHandlers } from '@/lib/api/route-wrapper';

async function handleGET(request: NextRequest) {
  // Handler logic
}

async function handlePOST(request: NextRequest) {
  // Handler logic
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
```

## Benefits

1. **Automatic Security Headers**: All wrapped routes get comprehensive security headers
2. **Smart Authentication**: Routes automatically require auth based on path patterns
3. **Consistent Error Handling**: Authentication errors handled uniformly
4. **Request Logging**: All requests logged for audit trails
5. **Clean Syntax**: No repetitive exports

## Migration Steps

### Step 1: Import the Wrapper

```typescript
import { wrapHandlers } from '@/lib/api/route-wrapper';
```

### Step 2: Convert Exports to Regular Functions

Change from:

```typescript
export async function GET(request: NextRequest) {
  /* ... */
}
```

To:

```typescript
async function handleGET(request: NextRequest) {
  /* ... */
}
```

### Step 3: Export Using wrapHandlers

```typescript
export const { GET, POST, PUT, DELETE } = wrapHandlers({
  handleGET,
  handlePOST,
  handlePUT,
  handleDELETE,
});
```

## Route Patterns

### Standard Authenticated Route

```typescript
// Routes like /api/agents, /api/billing automatically require auth
async function handleGET(request: NextRequest) {
  // No need to check auth - wrapper handles it
  const authService = await getAuthService();
  const user = await authService.getCurrentUser();
  // user is guaranteed to exist here
}

export const { GET } = wrapHandlers({ handleGET });
```

### Public Route

```typescript
// Routes like /api/health, /api/ping are automatically public
async function handleGET(request: NextRequest) {
  return NextResponse.json({ status: 'healthy' });
}

export const { GET } = wrapHandlers({ handleGET });
```

### Admin-Only Route

```typescript
// Routes under /api/security, /api/metrics require admin by default
async function handleGET(request: NextRequest) {
  // Admin check is automatic
  const user = await authService.getCurrentUser();
  // user.role is guaranteed to be 'admin' or 'owner'
}

export const { GET } = wrapHandlers({ handleGET });
```

### Custom Configuration

```typescript
// Override default behavior if needed
export const { GET, POST } = wrapHandlers(
  { handleGET, handlePOST },
  {
    requireAuth: true, // Override auth requirement
    requireAdmin: true, // Require admin role
    security: true, // Apply security headers (default: true)
    logging: true, // Enable logging (default: true)
  },
);
```

## Route Configuration Reference

The wrapper automatically applies these configurations based on route paths:

### Public Routes (No Auth Required)

- `/api/health`
- `/api/ping`
- `/api/auth/*` (login, signup, callback, etc.)
- `/api/anonymous/*`

### Admin Routes (Requires Admin Role)

- `/api/security/*`
- `/api/performance/*`
- `/api/metrics/*`

### Authenticated Routes (Requires Login)

- `/api/agents/*`
- `/api/billing/*`
- `/api/characters/*`
- `/api/api-keys/*`
- `/api/organizations/*`

### Special Cases

- `/api/billing/webhook` - No auth but has security headers
- `/api/billing/crypto-webhook` - No auth but has security headers

## Security Headers Applied

All wrapped routes automatically get these security headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload (HTTPS only)
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=('none'), microphone=('none'), ...
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Permitted-Cross-Domain-Policies: none
```

## Common Migration Patterns

### Routes with Direct Exports

```typescript
// Before
export async function GET(request: NextRequest) {
  const session = await sessionService.getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... handler logic
}

// After
async function handleGET(request: NextRequest) {
  // Auth check removed - wrapper handles it
  const authService = await getAuthService();
  const user = await authService.getCurrentUser();
  // ... handler logic
}

export const { GET } = wrapHandlers({ handleGET });
```

### Routes with Handle Pattern

```typescript
// Before
export async function handleGET(request: NextRequest) {
  /* ... */
}
export async function handlePOST(request: NextRequest) {
  /* ... */
}

// After (minimal change needed)
async function handleGET(request: NextRequest) {
  /* ... */
}
async function handlePOST(request: NextRequest) {
  /* ... */
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
```

### Routes with Dynamic Params

```typescript
interface RouteParams {
  params: {
    id: string;
  };
}

async function handleGET(request: NextRequest, { params }: RouteParams) {
  // Access params.id
}

export const { GET } = wrapHandlers({ handleGET });
```

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

describe('My API Route', () => {
  it('should return data with security headers', async () => {
    const handler = async (request: NextRequest) => {
      return NextResponse.json({ data: 'test' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });
    const request = new NextRequest('https://localhost:3000/api/test');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
```

## Troubleshooting

### Authentication Issues

- Verify the route path matches expected patterns
- Check if custom config is needed for your route
- Ensure auth service is properly imported

### Missing Headers

- Confirm you're using `wrapHandlers` not direct exports
- Check that `security: true` in custom config (default)
- Verify the response is a NextResponse instance

### TypeScript Errors

- Ensure handler names match in the wrapHandlers object
- Import types from Next.js correctly
- Use proper param types for dynamic routes

## Migration Checklist

- [ ] Import `wrapHandlers` from `@/lib/api/route-wrapper`
- [ ] Convert exported functions to regular functions
- [ ] Prefix function names with `handle` (e.g., `handleGET`)
- [ ] Remove manual auth checks (if route requires auth by default)
- [ ] Export using `wrapHandlers` pattern
- [ ] Test the route still works correctly
- [ ] Verify security headers are applied (check browser DevTools)
- [ ] Update any route-specific tests

## Running the Migration Script

To identify routes that need migration:

```bash
cd packages/platform
bun run tsx scripts/migrate-routes-security.ts
```

This will show:

- Total routes and migration status
- Critical routes needing immediate attention
- Suggested migration commands

## Questions?

If you encounter issues or have questions about the migration:

1. Check the route configuration in `/lib/api/route-wrapper.ts`
2. Review the security headers in `/lib/security/headers.ts`
3. Look at migrated examples in the codebase
4. Ask in the development channel

Remember: The goal is to have **100% of API routes** using security headers for consistent protection across the platform.
