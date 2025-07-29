/**
 * Security Headers Tests
 * Verifies that security headers are properly applied to API routes
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { SecurityHeaders } from '@/lib/security/headers';

// Mock dependencies
mock.module('@/lib/auth/session', () => ({
  authService: {
    getCurrentUser: mock(),
  },
}));

mock.module('@/lib/logger', () => ({
  apiLogger: {
    logRequest: mock(),
  },
  logger: {
    error: mock(),
    warn: mock(),
  },
}));

describe('Security Headers', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('should apply security headers to wrapped routes', async () => {
    // Create a simple handler
    const handler = async (request: NextRequest) => {
      return NextResponse.json({ message: 'success' });
    };

    // Wrap with security headers
    const { GET } = wrapHandlers({ handleGET: handler });

    // Create test request
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    // Execute wrapped handler
    const response = await GET(request);

    // Verify response
    expect(response.status).toBe(200);

    // Check security headers
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers.get('X-ElizaOS-Security')).toBe('enabled');

    // CSP should be present
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('should apply HSTS header for HTTPS requests', async () => {
    const handler = async (request: NextRequest) => {
      return NextResponse.json({ message: 'success' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });

    // Create HTTPS request
    const request = new NextRequest('https://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await GET(request);

    // Check HSTS header
    const hsts = response.headers.get('Strict-Transport-Security');
    expect(hsts).toBeTruthy();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('should not apply HSTS header for HTTP requests', async () => {
    const handler = async (request: NextRequest) => {
      return NextResponse.json({ message: 'success' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });

    // Create HTTP request
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await GET(request);

    // HSTS should not be present for HTTP
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('should apply permissions policy', async () => {
    const handler = async (request: NextRequest) => {
      return NextResponse.json({ message: 'success' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });

    const request = new NextRequest('https://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await GET(request);

    // Check Permissions Policy
    const permissions = response.headers.get('Permissions-Policy');
    expect(permissions).toBeTruthy();
    expect(permissions).toContain("camera=('none')");
    expect(permissions).toContain("microphone=('none')");
    expect(permissions).toContain("geolocation=('none')");
  });

  it('should remove sensitive headers', async () => {
    const handler = async (request: NextRequest) => {
      return NextResponse.json({ message: 'success' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });

    const request = new NextRequest('https://localhost:3000/api/test', {
      method: 'GET',
    });

    const response = await GET(request);

    // Sensitive headers should be empty
    expect(response.headers.get('X-Powered-By')).toBe('');
    expect(response.headers.get('Server')).toBe('');
  });

  it('should validate CSP directives are properly configured', () => {
    const errors = SecurityHeaders.validateCspDirectives({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'invalid-directive': ['test'],
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Invalid CSP directive: invalid-directive');
  });

  it('should handle CSP violation reports', async () => {
    const mockReport = {
      'csp-report': {
        'document-uri': 'https://example.com',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/script.js',
      },
    };

    const request = new NextRequest('https://localhost:3000/api/csp-report', {
      method: 'POST',
      body: JSON.stringify(mockReport),
    });

    const response = await SecurityHeaders.handleCspReport(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'received' });
  });
});

describe('Route Security Configuration', () => {
  it('should require authentication for protected routes', async () => {
    const { authService } = await import('@/lib/auth/session');

    // Mock unauthorized user
    (authService.getCurrentUser as any).mockResolvedValue(null);

    const handler = async (request: NextRequest) => {
      return NextResponse.json({ data: 'sensitive' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });

    // Test protected route
    const request = new NextRequest('https://localhost:3000/api/agents', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should require admin role for admin routes', async () => {
    const { authService } = await import('@/lib/auth/session');

    // Mock non-admin user
    (authService.getCurrentUser as any).mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      role: 'member',
      organizationId: 'org-123',
    } as any);

    const handler = async (request: NextRequest) => {
      return NextResponse.json({ data: 'admin-only' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });

    // Test admin route
    const request = new NextRequest(
      'https://localhost:3000/api/security/config',
      {
        method: 'GET',
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Admin access required');
  });

  it('should allow public routes without authentication', async () => {
    const { authService } = await import('@/lib/auth/session');

    // Mock no user
    (authService.getCurrentUser as any).mockResolvedValue(null);

    const handler = async (request: NextRequest) => {
      return NextResponse.json({ status: 'healthy' });
    };

    const { GET } = wrapHandlers({ handleGET: handler });

    // Test public route
    const request = new NextRequest('https://localhost:3000/api/health', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });
});
