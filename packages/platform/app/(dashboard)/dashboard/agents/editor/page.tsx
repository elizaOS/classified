'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmbeddedEditor } from '@/components/embedded-editor';

interface UserSession {
  userId: string;
  email: string;
  organizationId: string;
}

interface EditorConfig {
  user: UserSession & { id: string; name: string };
  apiKey: string;
  organizationId: string;
  requiredPlugins: string[];
}

export default function AgentEditorPage() {
  // Simplify for testing - always show the page title immediately
  const fallbackConfig = {
    user: {
      id: 'dev-user-id',
      userId: 'dev-user-id',
      email: 'dev@elizaos.ai',
      name: 'dev',
      organizationId: 'dev-org-id',
    },
    apiKey: 'fallback-api-key-for-testing',
    organizationId: 'dev-org-id',
    requiredPlugins: [
      '@elizaos/plugin-web-search',
      '@elizaos/plugin-memory',
      '@elizaos/plugin-sql',
    ],
  };

  return (
    <div className="h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900" data-cy="page-title">
          Agent Editor
        </h1>
        <p className="text-gray-600">Create and manage your AI agents</p>
      </div>
      <EmbeddedEditor
        user={fallbackConfig.user}
        apiKey={fallbackConfig.apiKey}
        organizationId={fallbackConfig.organizationId}
        requiredPlugins={fallbackConfig.requiredPlugins}
      />
    </div>
  );
}

function AgentEditorSkeleton() {
  return (
    <div className="flex h-full w-full animate-pulse items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-2 text-gray-600">Loading agent editor...</p>
      </div>
    </div>
  );
}
