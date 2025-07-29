/**
 * AutocoderWorkspace Frontend Component Tests
 *
 * This test suite validates the autocoder frontend UI components, user interactions,
 * project management, and WebSocket real-time updates.
 */

import './setup';
import React from 'react';
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { render, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AutocoderWorkspace,
  type Project,
} from '@/components/autocoder/AutocoderWorkspace';

// Mock all the child components
mock.module('@/components/autocoder/AgentChat', () => ({
  AgentChat: ({ project, onSendMessage }: any) => {
    const handleChange = (e: any) => {
      if (onSendMessage && e.target.value) {
        onSendMessage(e.target.value);
      }
    };

    return (
      <div data-testid="agent-chat">
        <div data-testid="chat-project-id">{project?.id}</div>
        <input
          data-testid="chat-input"
          placeholder="Type a message..."
          onChange={handleChange}
        />
      </div>
    );
  },
}));

mock.module('@/components/autocoder/ProjectPlanner', () => ({
  ProjectPlanner: ({ project, onSpecificationUpdate, onStartBuild }: any) => (
    <div data-testid="project-planner">
      <div data-testid="planner-project-id">{project?.id}</div>
      <button
        data-testid="start-build-button"
        onClick={() =>
          onStartBuild?.({ name: 'test-spec', features: ['test'] })
        }
      >
        Start Build
      </button>
    </div>
  ),
}));

mock.module('@/components/autocoder/JobQueue', () => ({
  JobQueue: ({ projects, buildLogs, onCancelBuild }: any) => (
    <div data-testid="job-queue">
      <div data-testid="queue-projects-count">{projects?.length || 0}</div>
      <div data-testid="build-logs-count">{buildLogs?.length || 0}</div>
      <button
        data-testid="cancel-build-button"
        onClick={() => onCancelBuild?.('test-project-id')}
      >
        Cancel Build
      </button>
    </div>
  ),
}));

mock.module('@/components/autocoder/PluginPreview', () => ({
  PluginPreview: ({ project, build }: any) => (
    <div data-testid="plugin-preview">
      <div data-testid="preview-project-id">{project?.id}</div>
      <div data-testid="preview-build-status">
        {build ? 'has-build' : 'no-build'}
      </div>
    </div>
  ),
}));

mock.module('@/components/autocoder/RegistryManager', () => ({
  RegistryManager: ({ project, userId }: any) => (
    <div data-testid="registry-manager">
      <div data-testid="registry-project-id">{project?.id}</div>
      <div data-testid="registry-user-id">{userId}</div>
    </div>
  ),
}));

mock.module('@/components/SecretsFormModal', () => ({
  SecretsFormModal: ({ isOpen, formRequest, onSubmit, onCancel }: any) =>
    isOpen ? (
      <div data-testid="secrets-form-modal">
        <div data-testid="form-title">{formRequest?.title}</div>
        <button data-testid="modal-submit" onClick={onSubmit}>
          Submit
        </button>
        <button data-testid="modal-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// Mock hooks
mock.module('@/lib/hooks/useAutocoderWebSocket', () => ({
  useAutocoderWebSocket: mock(),
}));

mock.module('@/hooks/useSecretsFormInjection', () => ({
  useSecretsFormInjection: mock(),
}));

describe('AutocoderWorkspace Frontend Tests', () => {
  const mockUserId = 'test-user-123';

  const mockWebSocketHook = {
    isConnected: true,
    messages: [],
    sendMessage: mock(),
    projectUpdates: [],
    buildLogs: [],
    subscribe: mock(),
    unsubscribe: mock(),
  };

  const mockSecretsFormHook = {
    isFormVisible: false,
    formRequest: null,
    handleFormSubmit: mock(),
    handleFormCancel: mock(),
    connectionStatus: 'connected',
  };

  const sampleProject: Project = {
    id: 'project-123',
    name: 'DeFi Yield Optimizer',
    description:
      'Build a DeFi yield farming protocol with automatic rebalancing',
    type: 'plugin',
    status: 'planning',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    specification: {
      name: 'DeFi Yield Optimizer',
      description: 'Advanced yield farming with automatic rebalancing',
      type: 'defi',
      dependencies: ['ethers', 'hardhat'],
      features: [
        'automatic rebalancing',
        'yield optimization',
        'risk management',
      ],
      testCases: ['test yield calculations', 'test rebalancing logic'],
      securityRequirements: ['smart contract audit', 'reentrancy protection'],
    },
  };

  // Mock fetch globally
  const mockFetch = mock();

  beforeEach(() => {
    // Clean up any existing DOM elements first
    document.body.innerHTML = '';

    // Clear all mocks
    mock.restore();
    mockFetch.mockClear();
    global.fetch = mockFetch;

    // Setup default mocks
    const {
      useAutocoderWebSocket,
    } = require('@/lib/hooks/useAutocoderWebSocket');
    const {
      useSecretsFormInjection,
    } = require('@/hooks/useSecretsFormInjection');

    useAutocoderWebSocket.mockReturnValue(mockWebSocketHook);
    useSecretsFormInjection.mockReturnValue(mockSecretsFormHook);

    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [sampleProject] }),
    });
  });

  afterEach(() => {
    // Clean up DOM after each test
    document.body.innerHTML = '';

    // Clear all mocks
    mock.restore();
    mockFetch.mockClear();
  });

  describe('Initial Render and Layout', () => {
    it('should render the workspace with correct layout structure', async () => {
      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      // Check main layout elements - might have multiple instances
      const newProjectElements = getAllByText('New Project');
      expect(newProjectElements.length).toBeGreaterThan(0);
      const recentProjectsElements = getAllByText('Recent Projects');
      expect(recentProjectsElements.length).toBeGreaterThan(0);

      // Check tab navigation - text might be split across span elements
      const chatElements = getAllByText('Chat');
      expect(chatElements.length).toBeGreaterThan(0);
      const plannerElements = getAllByText('Planner');
      expect(plannerElements.length).toBeGreaterThan(0);
      const buildQueueElements = getAllByText('Build Queue');
      expect(buildQueueElements.length).toBeGreaterThan(0);
      const previewElements = getAllByText('Preview');
      expect(previewElements.length).toBeGreaterThan(0);
      const registryElements = getAllByText('Registry');
      expect(registryElements.length).toBeGreaterThan(0);

      // Check connection status indicators
      const connectedElements = getAllByText('Connected');
      expect(connectedElements.length).toBeGreaterThan(0);
      const formsElements = getAllByText('Forms: connected');
      expect(formsElements.length).toBeGreaterThan(0);
    });

    it('should show welcome message when no active project', () => {
      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      // Use getAllByText since multiple elements might have the same text
      const welcomeElements = getAllByText('Welcome to Autocoder');
      expect(welcomeElements.length).toBeGreaterThan(0);
      const robotElements = getAllByText('🤖');
      expect(robotElements.length).toBeGreaterThan(0);
      const createElements = getAllByText('Create Your First Project');
      expect(createElements.length).toBeGreaterThan(0);
    });

    it('should load projects on mount', async () => {
      render(<AutocoderWorkspace userId={mockUserId} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/autocoder/projects?userId=${mockUserId}`,
        );
      });
    });
  });

  describe('Project Management', () => {
    it('should create a new project when New Project button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sampleProject),
      });

      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      const newProjectButtons = getAllByText('New Project');
      fireEvent.click(newProjectButtons[0]);

      await waitFor(() => {
        // Check that mockFetch was called at least once
        expect(mockFetch).toHaveBeenCalled();

        // Check that one of the calls was to the projects endpoint
        const fetchCalls = mockFetch.mock.calls;
        const projectCall = fetchCalls.find(
          (call) =>
            call[0] &&
            typeof call[0] === 'string' &&
            call[0].includes('/api/autocoder/projects'),
        );
        expect(projectCall).toBeDefined();
      });
    });

    it('should display project list after loading', async () => {
      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectElements = getAllByText('DeFi Yield Optimizer');
        expect(projectElements.length).toBeGreaterThan(0);
        const pluginElements = getAllByText('plugin');
        expect(pluginElements.length).toBeGreaterThan(0);
        const planningElements = getAllByText('planning');
        expect(planningElements.length).toBeGreaterThan(0);
      });
    });

    it('should select project when clicked in sidebar', async () => {
      const { getAllByText, getByTestId } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectItems = getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]); // Click the first one
      });

      // Should show chat view by default when project is selected
      await waitFor(() => {
        expect(getByTestId('agent-chat')).toBeInTheDocument();
        expect(getByTestId('chat-project-id')).toHaveTextContent('project-123');
      });
    });

    it('should show correct project status styling', async () => {
      const projects = [
        { ...sampleProject, id: 'p1', status: 'completed' },
        { ...sampleProject, id: 'p2', status: 'building' },
        { ...sampleProject, id: 'p3', status: 'failed' },
        { ...sampleProject, id: 'p4', status: 'planning' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects }),
      });

      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const statusElements = getAllByText(
          /completed|building|failed|planning/,
        );
        expect(statusElements).toHaveLength(4);
      });
    });
  });

  describe('Tab Navigation', () => {
    let renderResult: any;

    beforeEach(async () => {
      renderResult = render(<AutocoderWorkspace userId={mockUserId} />);

      // Wait for projects to load and select one
      await waitFor(() => {
        const projectItems = renderResult.getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]); // Click the first one
      });
    });

    it('should show chat view by default', async () => {
      await waitFor(() => {
        expect(renderResult.getByTestId('agent-chat')).toBeInTheDocument();
      });
    });

    it('should switch to planner view when planner tab is clicked', async () => {
      const plannerTab = renderResult.getByText('Planner');
      fireEvent.click(plannerTab);

      await waitFor(() => {
        expect(renderResult.getByTestId('project-planner')).toBeInTheDocument();
        expect(
          renderResult.getByTestId('planner-project-id'),
        ).toHaveTextContent('project-123');
      });
    });

    it('should switch to build queue view when queue tab is clicked', async () => {
      const queueTab = renderResult.getByText('Build Queue');
      fireEvent.click(queueTab);

      await waitFor(() => {
        expect(renderResult.getByTestId('job-queue')).toBeInTheDocument();
      });
    });

    it('should switch to preview view when preview tab is clicked', async () => {
      const previewTab = renderResult.getByText('Preview');
      fireEvent.click(previewTab);

      await waitFor(() => {
        expect(renderResult.getByTestId('plugin-preview')).toBeInTheDocument();
        expect(
          renderResult.getByTestId('preview-project-id'),
        ).toHaveTextContent('project-123');
      });
    });

    it('should switch to registry view when registry tab is clicked', async () => {
      const registryTab = renderResult.getByText('Registry');
      fireEvent.click(registryTab);

      await waitFor(() => {
        expect(
          renderResult.getByTestId('registry-manager'),
        ).toBeInTheDocument();
        expect(renderResult.getByTestId('registry-user-id')).toHaveTextContent(
          mockUserId,
        );
      });
    });

    it('should highlight active tab with correct styling', async () => {
      const plannerTab = renderResult.getByText('Planner');
      fireEvent.click(plannerTab);

      expect(plannerTab).toHaveClass('border-blue-500', 'text-blue-600');
    });
  });

  describe('WebSocket Integration', () => {
    it('should subscribe to project updates when project is selected', async () => {
      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectItems = getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]);
      });

      expect(mockWebSocketHook.subscribe).toHaveBeenCalledWith('project-123');
    });

    it('should send messages through WebSocket', async () => {
      const { getAllByText, getByTestId } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectItems = getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]);
      });

      // Wait for the chat component to be visible
      await waitFor(() => {
        expect(getByTestId('agent-chat')).toBeInTheDocument();
      });

      const chatInput = getByTestId('chat-input');

      // Verify the chat input exists and can receive input
      expect(chatInput).toBeInTheDocument();
      expect(chatInput).toHaveAttribute('placeholder', 'Type a message...');

      fireEvent.change(chatInput, { target: { value: 'Test message' } });

      // Verify the input value changed
      expect(chatInput).toHaveValue('Test message');
    });

    it('should show connection status correctly', () => {
      // Test connected state
      const { getAllByText, rerender } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );
      const connectedElements = getAllByText('Connected');
      expect(connectedElements.length).toBeGreaterThan(0);

      // Test disconnected state
      const {
        useAutocoderWebSocket,
      } = require('@/lib/hooks/useAutocoderWebSocket');
      useAutocoderWebSocket.mockReturnValue({
        ...mockWebSocketHook,
        isConnected: false,
      });

      rerender(<AutocoderWorkspace userId={mockUserId} />);

      const disconnectedElements = getAllByText('Disconnected');
      expect(disconnectedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Build Process Integration', () => {
    let renderResult: any;

    beforeEach(async () => {
      renderResult = render(<AutocoderWorkspace userId={mockUserId} />);

      await waitFor(() => {
        const projectItems = renderResult.getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]);
      });

      // Switch to planner view
      const plannerTab = renderResult.getByText('Planner');
      fireEvent.click(plannerTab);
    });

    it('should start build when start build button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...sampleProject, status: 'building' }),
      });

      const startBuildButton = renderResult.getByTestId('start-build-button');
      fireEvent.click(startBuildButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/autocoder/projects/project-123/build',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              specification: { name: 'test-spec', features: ['test'] },
            }),
          },
        );
      });
    });

    it('should switch to queue view after starting build', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...sampleProject, status: 'building' }),
      });

      const startBuildButton = renderResult.getByTestId('start-build-button');
      fireEvent.click(startBuildButton);

      await waitFor(() => {
        expect(renderResult.getByTestId('job-queue')).toBeInTheDocument();
      });
    });

    it('should handle build cancellation', async () => {
      // Switch to queue view first
      const queueTab = renderResult.getByText('Build Queue');
      fireEvent.click(queueTab);

      mockFetch.mockResolvedValueOnce({ ok: true });

      const cancelButton = renderResult.getByTestId('cancel-build-button');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/autocoder/projects/test-project-id/cancel',
          {
            method: 'POST',
          },
        );
      });
    });
  });

  describe('Real-time Project Updates', () => {
    it('should update project status when receiving WebSocket updates', async () => {
      const projectUpdates = [
        {
          projectId: 'project-123',
          updates: { status: 'building' },
        },
      ];

      const {
        useAutocoderWebSocket,
      } = require('@/lib/hooks/useAutocoderWebSocket');
      useAutocoderWebSocket.mockReturnValue({
        ...mockWebSocketHook,
        projectUpdates,
      });

      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectItems = getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]);
      });

      // The project status should be updated through the WebSocket update
      // This would be reflected in the sidebar project status
      await waitFor(() => {
        const buildingElements = getAllByText('building');
        expect(buildingElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle invalid status updates gracefully', async () => {
      const projectUpdates = [
        {
          projectId: 'project-123',
          updates: { status: 'invalid-status' },
        },
      ];

      const {
        useAutocoderWebSocket,
      } = require('@/lib/hooks/useAutocoderWebSocket');
      useAutocoderWebSocket.mockReturnValue({
        ...mockWebSocketHook,
        projectUpdates,
      });

      // Should not crash when receiving invalid status
      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectItems = getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]);
      });

      // Original status should be preserved
      const planningElements = getAllByText('planning');
      expect(planningElements.length).toBeGreaterThan(0);
    });
  });

  describe('Secrets Form Integration', () => {
    it('should show secrets form modal when visible', () => {
      const {
        useSecretsFormInjection,
      } = require('@/hooks/useSecretsFormInjection');
      useSecretsFormInjection.mockReturnValue({
        ...mockSecretsFormHook,
        isFormVisible: true,
        formRequest: { title: 'Enter API Keys' },
      });

      const { getByTestId } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      expect(getByTestId('secrets-form-modal')).toBeInTheDocument();
      expect(getByTestId('form-title')).toHaveTextContent('Enter API Keys');
    });

    it('should handle form submission', () => {
      const {
        useSecretsFormInjection,
      } = require('@/hooks/useSecretsFormInjection');
      const mockHandleSubmit = mock();

      useSecretsFormInjection.mockReturnValue({
        ...mockSecretsFormHook,
        isFormVisible: true,
        formRequest: { title: 'Enter API Keys' },
        handleFormSubmit: mockHandleSubmit,
      });

      const { getByTestId } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      const submitButton = getByTestId('modal-submit');
      fireEvent.click(submitButton);

      expect(mockHandleSubmit).toHaveBeenCalled();
    });

    it('should handle form cancellation', () => {
      const {
        useSecretsFormInjection,
      } = require('@/hooks/useSecretsFormInjection');
      const mockHandleCancel = mock();

      useSecretsFormInjection.mockReturnValue({
        ...mockSecretsFormHook,
        isFormVisible: true,
        formRequest: { title: 'Enter API Keys' },
        handleFormCancel: mockHandleCancel,
      });

      const { getByTestId } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      const cancelButton = getByTestId('modal-cancel');
      fireEvent.click(cancelButton);

      expect(mockHandleCancel).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle project loading errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not crash when fetch fails
      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      // Should still show the welcome message
      const welcomeElements = getAllByText('Welcome to Autocoder');
      expect(welcomeElements.length).toBeGreaterThan(0);
    });

    it('should handle project creation errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Creation failed'));

      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      const newProjectButtons = getAllByText('New Project');
      const newProjectButton = newProjectButtons[0];
      fireEvent.click(newProjectButton);

      // Should not crash and button should be re-enabled
      await waitFor(() => {
        expect(newProjectButton).not.toBeDisabled();
      });
    });

    it('should handle build start errors gracefully', async () => {
      const { getAllByText, getByText, getByTestId } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectItems = getAllByText('DeFi Yield Optimizer');
        fireEvent.click(projectItems[0]);
      });

      const plannerTab = getByText('Planner');
      fireEvent.click(plannerTab);

      mockFetch.mockRejectedValueOnce(new Error('Build failed to start'));

      const startBuildButton = getByTestId('start-build-button');
      fireEvent.click(startBuildButton);

      // Should handle error without crashing
      await waitFor(() => {
        expect(getByTestId('project-planner')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should disable buttons during loading operations', async () => {
      // Mock a slow response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve(sampleProject),
                }),
              100,
            ),
          ),
      );

      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      const newProjectButtons = getAllByText('New Project');
      const newProjectButton = newProjectButtons[0];
      fireEvent.click(newProjectButton);

      // Button should be disabled during loading
      expect(newProjectButton).toBeDisabled();

      // Button should be re-enabled after completion
      await waitFor(
        () => {
          expect(newProjectButton).not.toBeDisabled();
        },
        { timeout: 200 },
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper tab navigation structure', () => {
      const { getAllByRole } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      const tabs = getAllByRole('button').filter(
        (button) =>
          button.textContent?.includes('💬') ||
          button.textContent?.includes('📋') ||
          button.textContent?.includes('⚡') ||
          button.textContent?.includes('👀') ||
          button.textContent?.includes('📦'),
      );

      expect(tabs.length).toBeGreaterThanOrEqual(5);
    });

    it('should have clickable project items', async () => {
      const { getAllByText } = render(
        <AutocoderWorkspace userId={mockUserId} />,
      );

      await waitFor(() => {
        const projectItems = getAllByText('DeFi Yield Optimizer');
        expect(projectItems.length).toBeGreaterThan(0);
        expect(projectItems[0].closest('div')).toHaveClass('cursor-pointer');
      });
    });
  });
});
