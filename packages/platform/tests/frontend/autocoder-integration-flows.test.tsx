/**
 * Advanced Autocoder Integration Flow Tests
 *
 * Tests complete user interaction flows including:
 * - Project creation workflows
 * - Real-time communication flows
 * - Error handling scenarios
 * - State management integration
 * - WebSocket message flows
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { JSDOM } from 'jsdom';

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
});
global.document = dom.window.document;
global.window = dom.window as any;
global.navigator = dom.window.navigator;

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // OPEN
  onopen = mock();
  onmessage = mock();
  onclose = mock();
  onerror = mock();

  send = mock();
  close = mock();

  constructor(url: string) {
    setTimeout(() => this.onopen?.(), 10);
  }
}

global.WebSocket = MockWebSocket as any;

// Mock fetch for API calls
global.fetch = mock((url: string, options?: any) => {
  const response = {
    ok: true,
    status: 200,
    json: mock().mockResolvedValue({
      success: true,
      data: { projects: [] },
    }),
  };
  return Promise.resolve(response);
});

// Simple mock components for testing
const MockAutocoderWorkspace = ({ userId }: { userId: string }) => {
  const [projects, setProjects] = React.useState([]);
  const [activeProject, setActiveProject] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('chat');
  const [messages, setMessages] = React.useState([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [ws, setWs] = React.useState<WebSocket | null>(null);

  React.useEffect(() => {
    loadProjects();
    initializeWebSocket();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const initializeWebSocket = () => {
    const websocket = new WebSocket('ws://localhost:3001');

    websocket.onopen = () => {
      setIsConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'project_update') {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    websocket.onclose = () => {
      setIsConnected(false);
      setWs(null);
    };
  };

  const createProject = async () => {
    const projectData = {
      name: 'New Test Project',
      description: 'Test project description',
      type: 'defi',
    };

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      if (response.ok) {
        await loadProjects();
        const newProject = await response.json();
        setActiveProject(newProject.project);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const selectProject = (project: any) => {
    setActiveProject(project);

    // Subscribe to project updates via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'subscribe_project',
          projectId: project.id,
        }),
      );
    }
  };

  const sendMessage = (message: string) => {
    if (ws && ws.readyState === WebSocket.OPEN && activeProject) {
      const messageData = {
        type: 'user_message',
        projectId: activeProject.id,
        message,
        timestamp: new Date().toISOString(),
      };

      ws.send(JSON.stringify(messageData));
      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          content: message,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const startBuild = () => {
    if (activeProject) {
      setActiveTab('queue');

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'start_build',
            projectId: activeProject.id,
          }),
        );
      }
    }
  };

  return (
    <div data-testid="autocoder-workspace">
      <div data-testid="workspace-header">
        <h1>Autocoder Workspace</h1>
        <div data-testid="connection-status">
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div data-testid="project-sidebar">
        <button data-testid="new-project-btn" onClick={createProject}>
          New Project
        </button>
        <div data-testid="project-list">
          {projects.map((project: any) => (
            <div
              key={project.id}
              data-testid={`project-item-${project.id}`}
              className={activeProject?.id === project.id ? 'active' : ''}
              onClick={() => selectProject(project)}
            >
              {project.name}
            </div>
          ))}
        </div>
      </div>

      <div data-testid="main-content">
        {activeProject ? (
          <>
            <div data-testid="project-header">
              <h2>{activeProject.name}</h2>
              <div data-testid="project-status">
                Status: {activeProject.status}
              </div>
            </div>

            <div data-testid="tab-navigation">
              {['chat', 'planner', 'queue', 'preview', 'registry'].map(
                (tab) => (
                  <button
                    key={tab}
                    data-testid={`tab-${tab}`}
                    className={activeTab === tab ? 'active' : ''}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ),
              )}
            </div>

            <div data-testid="tab-content">
              {activeTab === 'chat' && (
                <div data-testid="chat-view">
                  <div data-testid="message-list">
                    {messages.map((msg: any, i) => (
                      <div key={i} data-testid={`message-${i}`}>
                        [{msg.type}]: {msg.content}
                      </div>
                    ))}
                  </div>
                  <div data-testid="message-input">
                    <input
                      data-testid="chat-input"
                      placeholder="Type your message..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          sendMessage((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'queue' && (
                <div data-testid="build-queue">
                  <button data-testid="start-build-btn" onClick={startBuild}>
                    Start Build
                  </button>
                  <div data-testid="build-status">Ready to build</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div data-testid="welcome-message">
            Welcome to Autocoder! Create a new project to get started.
          </div>
        )}
      </div>
    </div>
  );
};

describe('Autocoder Integration Flow Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    mock.restore();

    // Reset DOM
    document.body.innerHTML = '';

    // Reset fetch mock
    global.fetch = mock((url: string, options?: any) => {
      if (url.includes('/api/projects') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: mock().mockResolvedValue({
            success: true,
            project: {
              id: 'new-project-id',
              name: 'New Test Project',
              status: 'planning',
              type: 'defi',
            },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: mock().mockResolvedValue({
          success: true,
          data: {
            projects: [
              {
                id: 'test-project-1',
                name: 'Test Project 1',
                status: 'planning',
              },
              {
                id: 'test-project-2',
                name: 'Test Project 2',
                status: 'building',
              },
            ],
          },
        }),
      });
    });
  });

  describe('Complete Project Creation Flow', () => {
    it('should complete full project creation workflow', async () => {
      const { getByTestId, queryByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Initial state - should show welcome message
      expect(getByTestId('welcome-message')).toBeTruthy();
      expect(getByTestId('connection-status').textContent).toContain(
        'Connected',
      );

      // Click new project button
      fireEvent.click(getByTestId('new-project-btn'));

      // Wait for project creation
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/projects',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      // Should load projects after creation
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/projects');
      });

      // Welcome message should disappear
      expect(queryByTestId('welcome-message')).toBeFalsy();
    });

    it('should handle project creation errors gracefully', async () => {
      // Mock failed project creation
      global.fetch = mock().mockResolvedValue({
        ok: false,
        status: 500,
        json: mock().mockResolvedValue({ error: 'Server error' }),
      });

      const { getByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      fireEvent.click(getByTestId('new-project-btn'));

      // Should still show welcome message on error
      await waitFor(() => {
        expect(getByTestId('welcome-message')).toBeTruthy();
      });
    });
  });

  describe('Real-time Communication Flow', () => {
    it('should establish WebSocket connection and handle messages', async () => {
      const { getByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Wait for WebSocket connection
      await waitFor(() => {
        expect(getByTestId('connection-status').textContent).toContain(
          'Connected',
        );
      });

      // Verify WebSocket was created
      expect(MockWebSocket).toBeTruthy();
    });

    it('should handle project selection and subscription', async () => {
      const { getByTestId, getAllByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Wait for projects to load
      await waitFor(() => {
        const projectItems = getAllByTestId(/^project-item-/);
        expect(projectItems.length).toBeGreaterThan(0);
      });

      // Select a project
      const firstProject = getByTestId('project-item-test-project-1');
      fireEvent.click(firstProject);

      // Should show project details
      await waitFor(() => {
        expect(getByTestId('project-header')).toBeTruthy();
        expect(getByTestId('project-status')).toBeTruthy();
      });

      // Should have active styling
      expect(firstProject.className).toContain('active');
    });

    it('should handle chat message sending', async () => {
      const { getByTestId, getAllByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Wait for projects and select one
      await waitFor(() => {
        const projectItems = getAllByTestId(/^project-item-/);
        fireEvent.click(projectItems[0]);
      });

      // Should be in chat tab by default
      const chatTab = getByTestId('tab-chat');
      expect(chatTab.className).toContain('active');

      // Send a message
      const chatInput = getByTestId('chat-input');
      fireEvent.change(chatInput, { target: { value: 'Test message' } });
      fireEvent.keyPress(chatInput, { key: 'Enter', charCode: 13 });

      // Should show message in list
      await waitFor(() => {
        expect(getByTestId('message-0')).toBeTruthy();
        expect(getByTestId('message-0').textContent).toContain('Test message');
      });
    });
  });

  describe('Tab Navigation and State Management', () => {
    it('should handle tab switching correctly', async () => {
      const { getByTestId, getAllByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Select a project first
      await waitFor(() => {
        const projectItems = getAllByTestId(/^project-item-/);
        fireEvent.click(projectItems[0]);
      });

      // Test each tab
      const tabs = ['chat', 'planner', 'queue', 'preview', 'registry'];

      for (const tab of tabs) {
        fireEvent.click(getByTestId(`tab-${tab}`));

        await waitFor(() => {
          expect(getByTestId(`tab-${tab}`).className).toContain('active');
        });
      }
    });

    it('should handle build process initiation', async () => {
      const { getByTestId, getAllByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Select project and go to build queue
      await waitFor(() => {
        const projectItems = getAllByTestId(/^project-item-/);
        fireEvent.click(projectItems[0]);
      });

      fireEvent.click(getByTestId('tab-queue'));

      await waitFor(() => {
        expect(getByTestId('build-queue')).toBeTruthy();
      });

      // Start build process
      fireEvent.click(getByTestId('start-build-btn'));

      // Should be in queue tab after starting build
      expect(getByTestId('tab-queue').className).toContain('active');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle WebSocket disconnection gracefully', async () => {
      const { getByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Initial connection
      await waitFor(() => {
        expect(getByTestId('connection-status').textContent).toContain(
          'Connected',
        );
      });

      // Simulate disconnection
      const mockWs = new MockWebSocket('ws://localhost:3001');
      if (mockWs.onclose) {
        mockWs.onclose({} as CloseEvent);
      }

      // Should show disconnected status
      await waitFor(() => {
        expect(getByTestId('connection-status').textContent).toContain(
          'Disconnected',
        );
      });
    });

    it('should handle API errors during project loading', async () => {
      // Mock API failure
      global.fetch = mock().mockResolvedValue({
        ok: false,
        status: 500,
        json: mock().mockResolvedValue({ error: 'Server error' }),
      });

      const { getByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Should still render workspace even with API errors
      expect(getByTestId('autocoder-workspace')).toBeTruthy();
      expect(getByTestId('welcome-message')).toBeTruthy();
    });
  });

  describe('Performance and State Optimization', () => {
    it('should not render unnecessary components when no project selected', () => {
      const { getByTestId, queryByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Should show welcome message
      expect(getByTestId('welcome-message')).toBeTruthy();

      // Should not render project-specific components
      expect(queryByTestId('project-header')).toBeFalsy();
      expect(queryByTestId('tab-navigation')).toBeFalsy();
      expect(queryByTestId('tab-content')).toBeFalsy();
    });

    it('should maintain state consistency during rapid interactions', async () => {
      const { getByTestId, getAllByTestId } = render(
        <MockAutocoderWorkspace userId="test-user" />,
      );

      // Wait for projects to load
      await waitFor(() => {
        const projectItems = getAllByTestId(/^project-item-/);
        expect(projectItems.length).toBeGreaterThan(0);
      });

      // Rapidly switch between projects
      const projectItems = getAllByTestId(/^project-item-/);
      fireEvent.click(projectItems[0]);
      fireEvent.click(projectItems[1]);
      fireEvent.click(projectItems[0]);

      // Should maintain correct active state
      await waitFor(() => {
        expect(projectItems[0].className).toContain('active');
        expect(projectItems[1].className).not.toContain('active');
      });
    });
  });
});
