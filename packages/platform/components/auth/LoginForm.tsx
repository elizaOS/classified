'use client';

import { useState } from 'react';
import { useAuth } from '../../src/hooks/useAuth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface LoginFormProps {
  onSuccess?: () => void;
  showRegister?: boolean;
}

export function LoginForm({ onSuccess, showRegister = true }: LoginFormProps) {
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    organizationName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let result;

      if (isRegisterMode) {
        result = await auth.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          organizationName: formData.organizationName || undefined,
        });
      } else {
        result = await auth.login(formData.email, formData.password);
      }

      if (result.success) {
        onSuccess?.();
      } else {
        setError(
          result.error || `${isRegisterMode ? 'Registration' : 'Login'} failed`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) {
      setError(null);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">
          {isRegisterMode ? 'Create Account' : 'Sign In'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && (
            <>
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Full Name
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  required={isRegisterMode}
                  disabled={isLoading}
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label
                  htmlFor="organizationName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Organization Name (Optional)
                </label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  value={formData.organizationName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  placeholder="Enter your organization name"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              placeholder="Enter your password"
              minLength={8}
            />
            {isRegisterMode && (
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 8 characters long
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? `${isRegisterMode ? 'Creating Account' : 'Signing In'}...`
              : isRegisterMode
                ? 'Create Account'
                : 'Sign In'}
          </Button>
        </form>

        {showRegister && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError(null);
                setFormData({
                  email: '',
                  password: '',
                  name: '',
                  organizationName: '',
                });
              }}
              disabled={isLoading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isRegisterMode
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
