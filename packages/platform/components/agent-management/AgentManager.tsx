'use client';

import { useEffect, useState } from 'react';
import { createServerEmbedUrl } from '../../lib/auth/shared-jwt';
import { authService } from '../../lib/auth/session';

interface AgentManagerProps {
  className?: string;
  serverBaseUrl?: string;
}

export function AgentManager({
  className = 'w-full h-full border-0',
  serverBaseUrl = 'http://localhost:3000',
}: AgentManagerProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function setupEmbedUrl() {
      try {
        setLoading(true);
        setError(null);

        // Get current user from auth service
        const user = await authService.getCurrentUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        // Create enhanced JWT payload for server communication
        const payload = {
          sub: user.id,
          email: user.email,
          name:
            user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.email,
          organizationId: user.organizationId,
          role: user.role,
          tenantId: user.organizationId, // Use organizationId as tenantId
        };

        // Generate embed URL with JWT token
        const url = await createServerEmbedUrl(
          `${serverBaseUrl}/admin`,
          payload,
        );
        setEmbedUrl(url);
      } catch (err) {
        console.error('Failed to setup agent manager embed URL:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to setup agent manager',
        );
      } finally {
        setLoading(false);
      }
    }

    setupEmbedUrl();
  }, [serverBaseUrl]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading agent management...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50">
        <div className="mb-2 text-red-600">Failed to load agent management</div>
        <div className="text-sm text-red-500">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        <div className="text-gray-600">
          Unable to load agent management interface
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <iframe
        src={embedUrl}
        className={className}
        title="Agent Management Interface"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        loading="lazy"
        onError={() => setError('Failed to load agent management interface')}
      />
    </div>
  );
}

export default AgentManager;
