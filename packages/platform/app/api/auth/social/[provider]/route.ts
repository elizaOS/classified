import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { WorkOSAuthService } from '@/lib/auth/workos';

type SocialProvider = 'google' | 'github' | 'discord' | 'twitter' | 'microsoft';

// Map social providers to WorkOS connection IDs or domain hints
const PROVIDER_MAP: Record<
  SocialProvider,
  { connection?: string; domain?: string; hint?: string }
> = {
  google: { connection: 'conn_google' }, // WorkOS Google OAuth connection
  github: { connection: 'conn_github' }, // WorkOS GitHub OAuth connection
  discord: { connection: 'conn_discord' }, // WorkOS Discord OAuth connection
  twitter: { connection: 'conn_twitter' }, // WorkOS Twitter OAuth connection
  microsoft: { connection: 'conn_microsoft' }, // WorkOS Microsoft OAuth connection
};

// Helper to determine if request is from Tauri
function isTauriRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const platform = request.nextUrl.searchParams.get('platform');
  return platform === 'tauri' || userAgent.includes('Tauri');
}

// Helper to get redirect URI based on platform
function getRedirectUri(request: NextRequest): string {
  if (isTauriRequest(request)) {
    return 'elizaos://auth/callback';
  }

  const customRedirect = request.nextUrl.searchParams.get('redirect_uri');
  if (customRedirect) {
    return customRedirect;
  }

  // Default web redirect
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3333';
  return `${baseUrl}/auth/callback`;
}

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider: providerName } = await params;
    const provider = providerName as SocialProvider;
    const searchParams = request.nextUrl.searchParams;

    // Validate provider
    if (!PROVIDER_MAP[provider]) {
      return NextResponse.json(
        { error: 'Unsupported social provider' },
        { status: 400 },
      );
    }

    // Get state parameters for session migration
    const returnTo = searchParams.get('return_to') || '/dashboard';
    const sessionId = searchParams.get('session_id'); // For migration
    const platform = isTauriRequest(request) ? 'tauri' : 'web';

    // Create state parameter that includes session info
    const state = JSON.stringify({
      provider,
      returnTo,
      sessionId,
      platform,
      timestamp: Date.now(),
    });

    const workosAuth = new WorkOSAuthService();
    const providerConfig = PROVIDER_MAP[provider];
    const redirectUri = getRedirectUri(request);

    try {
      // Generate WorkOS authorization URL with provider-specific connection
      const authUrl = workosAuth.generateAuthUrl({
        connection: providerConfig.connection,
        domain: providerConfig.domain,
        state,
        screenHint: 'sign_in',
        redirectUri,
      });

      // Redirect to WorkOS authorization URL
      return NextResponse.redirect(authUrl);
    } catch (workosError) {
      console.error(`WorkOS ${provider} auth failed:`, workosError);

      // Fallback: redirect to manual login with error message
      const errorUrl = new URL('/auth/login', request.url);
      errorUrl.searchParams.set('error', `${provider}_unavailable`);
      errorUrl.searchParams.set(
        'message',
        `${provider} login is temporarily unavailable`,
      );

      return NextResponse.redirect(errorUrl.toString());
    }
  } catch (error) {
    console.error('Social auth initiation failed:', error);

    // Redirect to login with error
    const errorUrl = new URL('/auth/login', request.url);
    errorUrl.searchParams.set('error', 'auth_failed');
    errorUrl.searchParams.set('message', 'Authentication failed to start');

    return NextResponse.redirect(errorUrl.toString());
  }
}

// Handle POST for programmatic social auth (for API usage)
async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider: providerName } = await params;
    const provider = providerName as SocialProvider;
    const body = await request.json();

    // Validate provider
    if (!PROVIDER_MAP[provider]) {
      return NextResponse.json(
        { error: 'Unsupported social provider' },
        { status: 400 },
      );
    }

    const { returnTo = '/dashboard', sessionId } = body;

    // Create state for session migration
    const state = JSON.stringify({
      provider,
      returnTo,
      sessionId,
      timestamp: Date.now(),
    });

    const workosAuth = new WorkOSAuthService();
    const providerConfig = PROVIDER_MAP[provider];

    try {
      // Generate WorkOS authorization URL
      const authUrl = workosAuth.generateAuthUrl({
        connection: providerConfig.connection,
        domain: providerConfig.domain,
        state,
        screenHint: 'sign_in',
      });

      return NextResponse.json({
        success: true,
        authUrl,
        provider,
        message: `Redirect to ${provider} authentication`,
      });
    } catch (workosError) {
      console.error(`WorkOS ${provider} auth failed:`, workosError);

      return NextResponse.json(
        {
          error: 'provider_unavailable',
          message: `${provider} authentication is temporarily unavailable`,
          provider,
        },
        { status: 503 },
      );
    }
  } catch (error) {
    console.error('Social auth API failed:', error);
    return NextResponse.json(
      { error: 'auth_failed', message: 'Authentication initialization failed' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
