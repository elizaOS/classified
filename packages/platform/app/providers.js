'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// Check if PostHog credentials are valid (not placeholder values)
function hasValidPostHogCredentials() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  return (
    key &&
    host &&
    key !== 'phc_your_posthog_key' &&
    key.startsWith('phc_') &&
    key.length > 20
  );
}

// Only initialize PostHog if we have valid credentials
if (typeof window !== 'undefined' && hasValidPostHogCredentials()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'always',
  });
} else if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development'
) {
  // In development with invalid credentials, log a helpful message
  console.info('🔧 PostHog analytics disabled: using placeholder credentials');
  console.info(
    '💡 To enable analytics, set NEXT_PUBLIC_POSTHOG_KEY in .env.local',
  );
}

export function CSPostHogProvider({ children }) {
  // Only provide PostHog if it was successfully initialized
  if (hasValidPostHogCredentials()) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
  }

  // Return children without PostHog wrapper when credentials are invalid
  return <>{children}</>;
}
