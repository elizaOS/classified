/**
 * API Compatibility Layer for Client GUI Integration
 * Maps client API calls to platform v1 endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

// API endpoint mappings from client to platform
const API_MAPPINGS: Record<string, string> = {
  // Agent management
  agents: 'agents',
  'agents/create': 'agents',
  'agents/start': 'agents/start',
  'agents/stop': 'agents/stop',

  // Organization configuration
  'organizations/config': 'organizations/config',
  'config/required-plugins': 'organizations/config',

  // Messaging
  'messaging/send': 'messaging/send',
  'messaging/history': 'messaging/history',

  // Server health
  'server/ping': 'health',
  ping: 'health',

  // Inference
  'inference/openai': 'inference/openai',
  'inference/anthropic': 'inference/anthropic',
};

async function getAuthFromRequest(request: NextRequest): Promise<{
  userId: string;
  organizationId: string;
} | null> {
  // Return null during build time to prevent database access
  if (isBuildTime()) {
    return null;
  }

  // Dynamic imports to avoid database connection during build
  const { sessionService } = await import('@/lib/auth/session');
  const { apiKeyService } = await import('@/lib/api-keys');

  // Try session authentication first (for embedded client)
  const session = await sessionService.getSessionFromCookies();
  if (session) {
    return {
      userId: session.userId,
      organizationId: session.organizationId,
    };
  }

  // Try API key authentication
  const apiKey = request.headers.get('X-API-KEY');
  if (apiKey) {
    const verification = await apiKeyService.verifyApiKey(apiKey);
    if (
      verification.isValid &&
      verification.apiKey &&
      verification.organizationId
    ) {
      return {
        userId: verification.apiKey.id, // Use API key ID as user identifier
        organizationId: verification.organizationId,
      };
    }
  }

  return null;
}

function mapClientToPlatformApi(clientPath: string): string | null {
  // Direct mapping
  if (API_MAPPINGS[clientPath]) {
    return API_MAPPINGS[clientPath];
  }

  // Pattern matching for dynamic routes
  for (const [pattern, platformPath] of Object.entries(API_MAPPINGS)) {
    if (clientPath.startsWith(pattern)) {
      const remainder = clientPath.substring(pattern.length);
      return `${platformPath}${remainder}`;
    }
  }

  return null;
}

// Helper function to detect build time
function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.BUILD_MODE === 'export' ||
    process.env.NEXT_EXPORT === 'true' ||
    (typeof window === 'undefined' &&
      process.env.NODE_ENV === 'production' &&
      !process.env.DATABASE_URL)
  );
}

async function handleClientApiCall(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  // During build time, return a stub response to prevent database access
  if (isBuildTime()) {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  const path = pathSegments.join('/');

  // Handle runtime/ping directly without authentication
  if (path === 'runtime/ping') {
    return NextResponse.json(
      {
        pong: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 200 },
    );
  }

  // Map client API to platform API
  const platformPath = mapClientToPlatformApi(path);
  if (!platformPath) {
    return NextResponse.json(
      { error: `API endpoint not found: /${path}` },
      { status: 404 },
    );
  }

  // Authenticate request
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Forward to platform API with authentication context
    const url = new URL(`/api/v1/${platformPath}`, request.url);

    // Copy search params
    const searchParams = new URL(request.url).searchParams;
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const headers = new Headers(request.headers);

    // Add authentication context
    headers.set('X-User-Id', auth.userId);
    headers.set('X-Organization-Id', auth.organizationId);
    headers.set('X-Internal-Request', 'true');

    // Forward request
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.body,
    });

    // Return response with CORS headers for client
    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-API-KEY',
      },
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// HTTP method handlers
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ catchall: string[] }> },
) {
  const params = await props.params;
  return handleClientApiCall(request, params.catchall);
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ catchall: string[] }> },
) {
  const params = await props.params;
  return handleClientApiCall(request, params.catchall);
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ catchall: string[] }> },
) {
  const params = await props.params;
  return handleClientApiCall(request, params.catchall);
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ catchall: string[] }> },
) {
  const params = await props.params;
  return handleClientApiCall(request, params.catchall);
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-KEY',
    },
  });
}
