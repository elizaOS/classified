'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/useAuth';

interface UserData {
  messages: Array<{
    id: string;
    content: any;
    role: string;
    agentId: string;
    createdAt: string;
  }>;
  memories: Array<{
    id: string;
    content: any;
    type: string;
    importance: number;
    agentId: string;
    createdAt: string;
  }>;
  agents: Array<{
    id: string;
    name: string;
    description: string;
    totalInteractions: number;
    createdAt: string;
  }>;
}

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
}

export default function UserDataPanel() {
  const { user, session } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  const fetchUserData = useCallback(async () => {
    try {
      // Fetch user's agents
      const agentsResponse = await fetch('/api/v1/agents', {
        credentials: 'include',
      });
      const agentsData = await agentsResponse.json();

      if (!agentsData.success) {
        throw new Error('Failed to fetch agents');
      }

      const agents = agentsData.data.agents;
      setUserData((prev) => ({ ...prev, agents }) as UserData);

      // If we have agents, fetch data for the first one
      if (agents.length > 0 && !selectedAgent) {
        setSelectedAgent(agents[0].id);
        await fetchAgentData(agents[0].id);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  const fetchAgentData = async (agentId: string) => {
    try {
      setLoading(true);

      // Fetch messages for this agent and user
      const messagesResponse = await fetch(
        `/api/v1/messages?agentId=${agentId}&limit=10`,
        { credentials: 'include' },
      );
      const messagesData = await messagesResponse.json();

      // Fetch memories for this agent and user
      const memoriesResponse = await fetch(
        `/api/v1/memories?agentId=${agentId}&limit=10`,
        { credentials: 'include' },
      );
      const memoriesData = await memoriesResponse.json();

      setUserData((prev) => ({
        ...prev,
        messages: messagesData.success ? messagesData.data.messages : [],
        memories: memoriesData.success ? memoriesData.data.memories : [],
        agents: prev?.agents || [],
      }));
    } catch (error) {
      console.error('Error fetching agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/v1/api-keys', {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success) {
        setApiKeys(data.data.apiKeys);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  useEffect(() => {
    if (user && session) {
      fetchUserData();
      fetchApiKeys();
    }
  }, [user, session, fetchUserData]);

  const handleAgentChange = async (agentId: string) => {
    setSelectedAgent(agentId);
    await fetchAgentData(agentId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !userData) {
    return (
      <div className="rounded-lg bg-red-50 p-6">
        <p className="text-red-600">
          Unable to load user data. Please try logging in again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Info Header */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Your ElizaOS Dashboard
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-blue-50 p-4">
            <h3 className="font-medium text-blue-900">User ID</h3>
            <p className="font-mono text-sm text-blue-700">{user.id}</p>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <h3 className="font-medium text-green-900">Organization</h3>
            <p className="text-sm text-green-700">{user.organization?.name}</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-4">
            <h3 className="font-medium text-purple-900">Role</h3>
            <p className="text-sm capitalize text-purple-700">{user.role}</p>
          </div>
        </div>
      </div>

      {/* Agent Selection */}
      {userData.agents.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Select Agent
          </h3>
          <select
            value={selectedAgent}
            onChange={(e) => handleAgentChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an agent...</option>
            {userData.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} - {agent.totalInteractions} interactions
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Data Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Messages Panel */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Messages
              {selectedAgent && (
                <span className="ml-2 text-sm text-gray-500">
                  (Agent:{' '}
                  {userData.agents.find((a) => a.id === selectedAgent)?.name})
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600">
              Messages scoped to User ID:{' '}
              <code className="rounded bg-gray-100 px-1">{user.id}</code>
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto p-4">
            {userData.messages.length > 0 ? (
              <div className="space-y-3">
                {userData.messages.map((message) => (
                  <div
                    key={message.id}
                    className="border-l-4 border-blue-500 py-2 pl-4"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          message.role === 'user'
                            ? 'bg-blue-100 text-blue-800'
                            : message.role === 'agent'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {message.role}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {message.content?.text || 'No text content'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Message ID: {message.id}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-gray-500">
                No messages found for this user and agent combination.
              </p>
            )}
          </div>
        </div>

        {/* Memories Panel */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Agent Memories
              {selectedAgent && (
                <span className="ml-2 text-sm text-gray-500">
                  (Agent:{' '}
                  {userData.agents.find((a) => a.id === selectedAgent)?.name})
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600">
              Memories scoped to User ID:{' '}
              <code className="rounded bg-gray-100 px-1">{user.id}</code>+ Agent
              ID:{' '}
              <code className="rounded bg-gray-100 px-1">{selectedAgent}</code>
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto p-4">
            {userData.memories.length > 0 ? (
              <div className="space-y-3">
                {userData.memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="border-l-4 border-purple-500 py-2 pl-4"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800">
                        {memory.type}
                      </span>
                      <div className="text-right">
                        <span className="text-xs font-medium text-yellow-600">
                          Importance: {memory.importance}/10
                        </span>
                        <br />
                        <span className="text-xs text-gray-500">
                          {new Date(memory.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">
                      {memory.content?.text || 'No text content'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Memory ID: {memory.id}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-gray-500">
                No memories found for this user and agent combination.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* API Keys Panel */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Your API Keys
        </h3>
        <p className="mb-4 text-sm text-gray-600">
          API keys for accessing your data programmatically. All API calls are
          automatically scoped to your user ID.
        </p>
        {apiKeys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Key Prefix
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {key.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500">
                      {key.keyPrefix}•••
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {key.usageCount} calls
                      {key.lastUsedAt && (
                        <div className="text-xs text-gray-400">
                          Last used:{' '}
                          {new Date(key.lastUsedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          key.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {key.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="mb-4 text-gray-500">No API keys found.</p>
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={() => (window.location.href = '/api-keys')}
            >
              Create Your First API Key
            </button>
          </div>
        )}
      </div>

      {/* Isolation Info Panel */}
      <div className="rounded-lg bg-blue-50 p-6">
        <h3 className="mb-3 text-lg font-semibold text-blue-900">
          🔒 Data Isolation
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Organization Level:</strong> All your data is isolated
            within your organization ({user.organization?.name})
          </p>
          <p>
            <strong>User Level:</strong> Your messages, conversations, and
            personal data are isolated to your user ID ({user.id})
          </p>
          <p>
            <strong>Agent Level:</strong> Memories and agent-specific data are
            further isolated by agent ID
          </p>
          <p>
            <strong>API Access:</strong> All API endpoints automatically enforce
            these isolation rules
          </p>
        </div>
      </div>
    </div>
  );
}
