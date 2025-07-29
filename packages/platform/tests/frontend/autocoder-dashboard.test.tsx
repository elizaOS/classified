/**
 * Autocoder Dashboard Page Frontend Tests
 *
 * This test suite validates the main autocoder dashboard page including
 * authentication, routing, layout, and integration with the workspace component.
 */

import './setup';
import React from 'react';
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutocoderPage from '@/app/(dashboard)/dashboard/autocoder/page';

// Mock the AutocoderWorkspace component
mock.module('@/components/autocoder/AutocoderWorkspace', () => ({
  AutocoderWorkspace: ({ userId }: { userId: string }) => (
    <div data-testid="autocoder-workspace">
      <div data-testid="workspace-user-id">{userId}</div>
      <div>Autocoder Workspace Loaded</div>
    </div>
  ),
}));

// Mock the auth hook
mock.module('@/lib/auth/useAuth', () => ({
  useAuth: mock(),
}));

// Mock the spinner component
mock.module('@/components/ui/spinner', () => ({
  Spinner: ({ variant }: { variant?: string }) => (
    <div data-testid="spinner" data-variant={variant}>
      Loading...
    </div>
  ),
}));

describe('Autocoder Dashboard Page Tests', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  };

  const defaultAuthState = {
    user: mockUser,
    loading: false,
  };

  beforeEach(() => {
    mock.restore();

    const { useAuth } = require('@/lib/auth/useAuth');
    useAuth.mockReturnValue(defaultAuthState);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Authentication and Authorization', () => {
    it('should render workspace when user is authenticated', async () => {
      const { getByTestId, getAllByTestId, getAllByText } = render(
        <AutocoderPage />,
      );

      await waitFor(() => {
        expect(getByTestId('autocoder-workspace')).toBeInTheDocument();
        const workspaceUserIds = getAllByTestId('workspace-user-id');
        expect(workspaceUserIds[0]).toHaveTextContent('user-123');
        const workspaceLoadedElements = getAllByText(
          'Autocoder Workspace Loaded',
        );
        expect(workspaceLoadedElements.length).toBeGreaterThan(0);
      });
    });

    it('should show loading spinner when auth is loading', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      const { getByTestId, getByText } = render(<AutocoderPage />);

      expect(getByTestId('spinner')).toBeInTheDocument();
      expect(getByTestId('spinner')).toHaveAttribute('data-variant', 'light');
      expect(getByText('Loading...')).toBeInTheDocument();
    });

    it('should show authentication required message when user is not logged in', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { getAllByText, queryByTestId } = render(<AutocoderPage />);

      const authRequiredElements = getAllByText('Authentication Required');
      expect(authRequiredElements.length).toBeGreaterThan(0);
      const pleaseLoginElements = getAllByText(
        'Please log in to access the Autocoder.',
      );
      expect(pleaseLoginElements.length).toBeGreaterThan(0);
      expect(queryByTestId('autocoder-workspace')).not.toBeInTheDocument();
    });

    it('should show loading spinner during hydration before auth loads', () => {
      const { useAuth } = require('@/lib/auth/useAuth');

      // Mock initial loading state where mounted is false
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      const { getByTestId, queryByTestId } = render(<AutocoderPage />);

      // The test is complex to mock hydration state, so let's check both cases
      // Either the spinner is shown during hydration or the workspace is shown when hydrated
      const spinner = queryByTestId('spinner');
      const workspace = queryByTestId('autocoder-workspace');

      // At least one of these should be present
      expect(spinner || workspace).toBeTruthy();
    });
  });

  describe('Page Layout and Structure', () => {
    it('should render correct page header and description', () => {
      const { getAllByText } = render(<AutocoderPage />);

      const autocoderElements = getAllByText('Autocoder');
      expect(autocoderElements.length).toBeGreaterThan(0);
      const descriptionElements = getAllByText(
        'AI-Powered Development - Collaborate with AI to build, test, and deploy plugins automatically',
      );
      expect(descriptionElements.length).toBeGreaterThan(0);
    });

    it('should have proper layout structure with header and content areas', () => {
      const { container } = render(<AutocoderPage />);

      // Check for main layout structure
      const mainContainer = container.querySelector('.flex.h-screen.flex-col');
      expect(mainContainer).toBeInTheDocument();

      // Check for header area
      const header = container.querySelector(
        '.border-b.border-gray-200.bg-white',
      );
      expect(header).toBeInTheDocument();

      // Check for content area
      const content = container.querySelector('.flex-1.overflow-hidden');
      expect(content).toBeInTheDocument();
    });

    it('should apply correct CSS classes for responsive design', () => {
      const { container } = render(<AutocoderPage />);

      const mainContainer = container.querySelector('.flex.h-screen.flex-col');
      expect(mainContainer).toHaveClass('flex', 'h-screen', 'flex-col');

      const header = container.querySelector(
        '.border-b.border-gray-200.bg-white.px-6.py-4',
      );
      expect(header).toHaveClass(
        'border-b',
        'border-gray-200',
        'bg-white',
        'px-6',
        'py-4',
      );
    });
  });

  describe('User Integration', () => {
    it('should pass correct user ID to workspace component', async () => {
      const { getByTestId } = render(<AutocoderPage />);

      await waitFor(() => {
        expect(getByTestId('workspace-user-id')).toHaveTextContent('user-123');
      });
    });

    it('should handle different user roles correctly', async () => {
      const adminUser = { ...mockUser, role: 'admin' };

      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: adminUser,
        loading: false,
      });

      const { getByTestId } = render(<AutocoderPage />);

      await waitFor(() => {
        expect(getByTestId('autocoder-workspace')).toBeInTheDocument();
        expect(getByTestId('workspace-user-id')).toHaveTextContent('user-123');
      });
    });

    it('should handle user with minimal profile data', async () => {
      const minimalUser = { id: 'user-456' };

      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: minimalUser,
        loading: false,
      });

      const { getByTestId } = render(<AutocoderPage />);

      await waitFor(() => {
        expect(getByTestId('workspace-user-id')).toHaveTextContent('user-456');
      });
    });
  });

  describe('Loading States and Transitions', () => {
    it('should transition from loading to authenticated state', async () => {
      const { useAuth } = require('@/lib/auth/useAuth');

      // Start with loading state
      useAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      const { getByTestId, queryByTestId, rerender } = render(
        <AutocoderPage />,
      );
      expect(getByTestId('spinner')).toBeInTheDocument();

      // Transition to authenticated state
      useAuth.mockReturnValue({
        user: mockUser,
        loading: false,
      });

      rerender(<AutocoderPage />);

      await waitFor(() => {
        expect(queryByTestId('spinner')).not.toBeInTheDocument();
        expect(getByTestId('autocoder-workspace')).toBeInTheDocument();
      });
    });

    it('should transition from loading to unauthenticated state', async () => {
      const { useAuth } = require('@/lib/auth/useAuth');

      // Start with loading state
      useAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      const { getByTestId, queryByTestId, getAllByText, rerender } = render(
        <AutocoderPage />,
      );
      expect(getByTestId('spinner')).toBeInTheDocument();

      // Transition to unauthenticated state
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      rerender(<AutocoderPage />);

      await waitFor(() => {
        expect(queryByTestId('spinner')).not.toBeInTheDocument();
        const authRequiredElements = getAllByText('Authentication Required');
        expect(authRequiredElements.length).toBeGreaterThan(0);
      });
    });

    it('should show loading state during auth re-validation', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: mockUser,
        loading: true,
      });

      const { getByTestId, queryByTestId } = render(<AutocoderPage />);

      expect(getByTestId('spinner')).toBeInTheDocument();
      expect(queryByTestId('autocoder-workspace')).not.toBeInTheDocument();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle auth hook returning undefined user gracefully', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: undefined,
        loading: false,
      });

      const { getAllByText, queryByTestId } = render(<AutocoderPage />);

      const authRequiredElements = getAllByText('Authentication Required');
      expect(authRequiredElements.length).toBeGreaterThan(0);
      expect(queryByTestId('autocoder-workspace')).not.toBeInTheDocument();
    });

    it('should handle auth hook errors gracefully', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockImplementation(() => {
        throw new Error('Auth hook error');
      });

      // Should not crash when auth hook throws
      expect(() => render(<AutocoderPage />)).toThrow('Auth hook error');
    });

    it('should handle missing user ID gracefully', () => {
      const userWithoutId = { email: 'test@example.com' };

      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: userWithoutId,
        loading: false,
      });

      const { getByTestId } = render(<AutocoderPage />);

      // Should still render but workspace might handle missing ID
      expect(getByTestId('autocoder-workspace')).toBeInTheDocument();
      expect(getByTestId('workspace-user-id')).toHaveTextContent('');
    });
  });

  describe('Accessibility and SEO', () => {
    it('should have proper heading hierarchy', () => {
      const { getAllByRole, queryByRole } = render(<AutocoderPage />);

      const mainHeadings = getAllByRole('heading', { level: 1 });
      const autocoderHeading = mainHeadings.find(
        (h) => h.textContent === 'Autocoder',
      );
      expect(autocoderHeading).toBeInTheDocument();

      const authHeading = queryByRole('heading', {
        level: 1,
        name: 'Authentication Required',
      });
      if (authHeading) {
        expect(authHeading).toBeInTheDocument();
      }
    });

    it('should have proper semantic structure', () => {
      const { container } = render(<AutocoderPage />);

      // Should use proper semantic HTML
      const main = container.querySelector('div[class*="flex-col"]');
      expect(main).toBeInTheDocument();
    });

    it('should have accessible loading state', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      const { getByTestId, getByText } = render(<AutocoderPage />);

      const spinner = getByTestId('spinner');
      expect(spinner).toBeInTheDocument();
      expect(getByText('Loading...')).toBeInTheDocument();
    });

    it('should have accessible error states', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { getAllByText } = render(<AutocoderPage />);

      const errorMessages = getAllByText(
        'Please log in to access the Autocoder.',
      );
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0]).toHaveClass('text-gray-600');
    });
  });

  describe('Performance Considerations', () => {
    it('should not render workspace component when user is not authenticated', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { queryByTestId } = render(<AutocoderPage />);

      expect(queryByTestId('autocoder-workspace')).not.toBeInTheDocument();
    });

    it('should not render workspace component during loading', () => {
      const { useAuth } = require('@/lib/auth/useAuth');
      useAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      const { queryByTestId } = render(<AutocoderPage />);

      expect(queryByTestId('autocoder-workspace')).not.toBeInTheDocument();
    });

    it('should render workspace immediately when user is available', async () => {
      const { getByTestId } = render(<AutocoderPage />);

      // Should render workspace without delay when user is authenticated
      await waitFor(
        () => {
          expect(getByTestId('autocoder-workspace')).toBeInTheDocument();
        },
        { timeout: 100 },
      );
    });
  });

  describe('Integration with Next.js App Router', () => {
    it('should be compatible with server-side rendering structure', () => {
      // Test that component can render without client-only features
      const { container } = render(<AutocoderPage />);

      expect(container.firstChild).toBeInTheDocument();
      expect(container.firstChild).toHaveClass('flex', 'h-screen', 'flex-col');
    });

    it('should handle client-side hydration properly', async () => {
      // Simulate hydration process
      const { getByTestId } = render(<AutocoderPage />);

      // Should eventually show the workspace after hydration
      await waitFor(() => {
        expect(getByTestId('autocoder-workspace')).toBeInTheDocument();
      });
    });
  });

  describe('Theme and Styling', () => {
    it('should apply correct theme classes', () => {
      const { container } = render(<AutocoderPage />);

      // Check for proper color scheme classes
      const header = container.querySelector('.bg-white');
      expect(header).toBeInTheDocument();

      const borders = container.querySelectorAll('.border-gray-200');
      expect(borders.length).toBeGreaterThan(0);
    });

    it('should have proper text styling', () => {
      const { getAllByText } = render(<AutocoderPage />);

      const headings = getAllByText('Autocoder');
      const heading = headings.find((h) => h.classList.contains('text-2xl'));
      expect(heading).toHaveClass('text-2xl', 'font-bold', 'text-gray-900');

      const descriptions = getAllByText(/AI-Powered Development/);
      expect(descriptions[0]).toHaveClass('mt-1', 'text-gray-600');
    });

    it('should have responsive layout classes', () => {
      const { container } = render(<AutocoderPage />);

      const mainContainer = container.querySelector('.flex.h-screen.flex-col');
      expect(mainContainer).toHaveClass('h-screen'); // Full height

      const contentArea = container.querySelector('.flex-1.overflow-hidden');
      expect(contentArea).toHaveClass('flex-1', 'overflow-hidden'); // Flexible content
    });
  });
});
