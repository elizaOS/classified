'use client';

/**
 * Client Application Component
 * Renders the ElizaOS client React application
 */

import { Suspense, lazy } from 'react';
// import { App as ClientApp } from '@elizaos/client';

// Loading component
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="p-8 text-center">
      <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
        Loading ElizaOS Client
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Initializing application...
      </p>
    </div>
  </div>
);

export default function ClientPage() {
  return (
    <div className="dark h-screen w-full">
      {/* CSS styles are handled by the platform - client will inherit dark theme */}
      <Suspense fallback={<LoadingSpinner />}>
        <div
          style={{
            height: '100vh',
            width: '100%',
            colorScheme: 'dark',
            backgroundColor: 'var(--background)',
            color: 'var(--foreground)',
          }}
        >
          {/* <ClientApp /> */}
          <div>Client Component Temporarily Disabled</div>
        </div>
      </Suspense>
    </div>
  );
}
