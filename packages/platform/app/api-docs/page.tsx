'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Load the OpenAPI spec
    fetch('/api/swagger')
      .then((res) => res.json())
      .then((data) => setSpec(data))
      .catch((err) => console.error('Failed to load API spec:', err));

    // Load saved tokens from localStorage
    const savedApiKey = localStorage.getItem('api-test-key');
    const savedToken = localStorage.getItem('api-test-token');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    if (savedToken) {
      setBearerToken(savedToken);
    }
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    localStorage.setItem('api-test-key', value);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBearerToken(value);
    localStorage.setItem('api-test-token', value);
  };

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@elizaos.ai',
          password: 'TestPassword123!',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setBearerToken(data.data.token);
        localStorage.setItem('api-test-token', data.data.token);
        console.log('Login successful! Token saved.');
        // TODO: Show success toast notification
      } else {
        console.error(`Login failed: ${data.error}`);
        // TODO: Show error toast notification
      }
    } catch (error) {
      console.error(
        `Login error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      // TODO: Show error toast notification
    }
  };

  const requestInterceptor = (req: any) => {
    if (apiKey) {
      req.headers['X-API-Key'] = apiKey;
    }
    if (bearerToken && req.headers.Authorization === 'Bearer undefined') {
      req.headers.Authorization = `Bearer ${bearerToken}`;
    }
    return req;
  };

  if (!spec) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              ElizaOS API Documentation
            </h1>
            <p className="mt-2 text-gray-600">
              Interactive API documentation with testing capabilities
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Authentication Setup</h2>
          <p className="mb-4 text-sm text-gray-600">
            Configure your authentication credentials to test protected
            endpoints
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="apiKey"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                API Key (X-API-Key header)
              </label>
              <input
                id="apiKey"
                type="text"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter your API key"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="bearerToken"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Bearer Token (JWT)
              </label>
              <div className="flex gap-2">
                <input
                  id="bearerToken"
                  type="text"
                  value={bearerToken}
                  onChange={handleTokenChange}
                  placeholder="Enter your bearer token"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleLogin}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  Get Token (Test Login)
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Click "Get Token" to login with test credentials and get a JWT
                token
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-md bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Quick Start:
            </h3>
            <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600">
              <li>
                Click "Get Token" to obtain a JWT token using test credentials
              </li>
              <li>
                For API Key authentication, create one using the /api-keys
                endpoint
              </li>
              <li>Use the "Try it out" button on any endpoint to test it</li>
              <li>The authentication headers will be automatically included</li>
            </ol>
          </div>
        </div>

        <div className="rounded-lg bg-white shadow-sm">
          <SwaggerUI
            spec={spec}
            requestInterceptor={requestInterceptor}
            tryItOutEnabled={true}
            persistAuthorization={true}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
          />
        </div>
      </div>
    </div>
  );
}
