'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlusIcon,
  RocketIcon,
  Pencil1Icon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  ExternalLinkIcon,
  DotsVerticalIcon as _DotsVerticalIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  ClockIcon,
  EyeOpenIcon,
  GlobeIcon,
  LockClosedIcon,
} from '@radix-ui/react-icons';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import toast from '@/lib/toast';

interface Agent {
  id: string;
  name: string;
  description?: string;
  slug: string;
  avatarUrl?: string;
  character: Record<string, any>;
  plugins: string[];
  runtimeConfig: Record<string, any>;
  deploymentStatus: string;
  deploymentUrl?: string;
  deploymentError?: string;
  lastDeployedAt?: string;
  visibility: string;
  isPublished: boolean;
  totalInteractions: number;
  totalCost: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  type?: 'agent' | 'character'; // Add type field to distinguish
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  draftAgents: number;
  totalInteractions: number;
  totalCost: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deployingAgents, setDeployingAgents] = useState<Set<string>>(
    new Set(),
  );
  const [viewFilter, setViewFilter] = useState<'all' | 'agents' | 'characters'>(
    'all',
  );

  // Load agents and stats
  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      // Fetch both agents and characters from their respective APIs
      const [agentsResponse, charactersResponse] = await Promise.all([
        fetch('/api/agents', {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        fetch('/api/characters', {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      ]);

      const agentsData = agentsResponse.ok
        ? await agentsResponse.json()
        : { success: false };
      const charactersData = charactersResponse.ok
        ? await charactersResponse.json()
        : { success: false };

      let allItems: Agent[] = [];

      // Add agents with type field
      if (agentsData.success && agentsData.data) {
        const agentsWithType = (agentsData.data.agents || []).map(
          (agent: any) => ({
            ...agent,
            type: 'agent' as const,
          }),
        );
        allItems = [...allItems, ...agentsWithType];
      }

      // Add characters as agents with type field and restricted capabilities
      if (charactersData.success && charactersData.data) {
        const charactersAsAgents = (charactersData.data.characters || []).map(
          (character: any) => ({
            id: character.id,
            name: character.name,
            description: character.description,
            slug: character.slug,
            avatarUrl: character.avatarUrl,
            character: character.characterConfig,
            plugins: [], // Characters have no plugins
            runtimeConfig: {}, // Characters have minimal runtime config
            deploymentStatus: 'frontend-only', // Special status for characters
            deploymentUrl: `/characters/chat/${character.id}`, // Link to character chat
            visibility: character.visibility,
            isPublished: character.isActive,
            totalInteractions: character.totalConversations,
            totalCost: '0.00', // Characters don't track cost the same way
            createdByUserId: character.createdBy,
            createdAt: character.createdAt,
            updatedAt: character.updatedAt,
            type: 'character' as const,
          }),
        );
        allItems = [...allItems, ...charactersAsAgents];
      }

      setAgents(allItems);

      // Combine stats from both sources
      const combinedStats = {
        totalAgents:
          (agentsData.data?.stats?.totalAgents || 0) +
          (charactersData.data?.stats?.totalCharacters || 0),
        activeAgents:
          (agentsData.data?.stats?.activeAgents || 0) +
          (charactersData.data?.stats?.activeCharacters || 0),
        draftAgents: agentsData.data?.stats?.draftAgents || 0,
        totalInteractions:
          (agentsData.data?.stats?.totalInteractions || 0) +
          (charactersData.data?.stats?.totalConversations || 0),
        totalCost: agentsData.data?.stats?.totalCost || 0,
      };

      setStats(combinedStats);
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast({
        message: 'Failed to load agents and characters',
        mode: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function deployAgent(agentId: string) {
    setDeployingAgents((prev) => new Set(Array.from(prev).concat([agentId])));

    try {
      // Deploy agent using real API
      const response = await fetch(`/api/agents/${agentId}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.success) {
        // Refresh the agents list to get updated status
        await loadAgents();

        toast({
          message: 'Agent deployed successfully',
          mode: 'success',
        });
      } else {
        throw new Error(data.error || 'Deployment failed');
      }
    } catch (error) {
      console.error('Failed to deploy agent:', error);
      toast({
        message: 'Failed to deploy agent',
        mode: 'error',
      });
    } finally {
      setDeployingAgents((prev) => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  }

  async function stopAgent(agentId: string) {
    try {
      // Stop agent using real API
      const response = await fetch(`/api/agents/${agentId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.success) {
        // Refresh the agents list to get updated status
        await loadAgents();

        toast({
          message: 'Agent stopped successfully',
          mode: 'success',
        });
      } else {
        throw new Error(data.error || 'Stop failed');
      }
    } catch (error) {
      console.error('Failed to stop agent:', error);
      toast({
        message: 'Failed to stop agent',
        mode: 'error',
      });
    }
  }

  async function deleteAgent(agentId: string) {
    try {
      // Delete agent using real API
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.success) {
        // Refresh the agents list to get updated data
        await loadAgents();

        toast({
          message: 'Agent deleted successfully',
          mode: 'success',
        });

        setShowDeleteModal(false);
        setSelectedAgent(null);
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      toast({
        message: 'Failed to delete agent',
        mode: 'error',
      });
    }
  }

  async function deleteCharacter(characterId: string) {
    try {
      // Delete character using characters API
      const response = await fetch(`/api/characters/${characterId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.success) {
        // Refresh the list to get updated data
        await loadAgents();

        toast({
          message: 'Character deleted successfully',
          mode: 'success',
        });

        setShowDeleteModal(false);
        setSelectedAgent(null);
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Failed to delete character:', error);
      toast({
        message: 'Failed to delete character',
        mode: 'error',
      });
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'deployed':
        return <CheckCircledIcon className="h-4 w-4 text-green-600" />;
      case 'deploying':
        return <ClockIcon className="h-4 w-4 animate-spin text-yellow-600" />;
      case 'failed':
        return <CrossCircledIcon className="h-4 w-4 text-red-600" />;
      case 'frontend-only':
        return <GlobeIcon className="h-4 w-4 text-blue-600" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-400" />;
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'deployed':
        return 'Active';
      case 'deploying':
        return 'Deploying...';
      case 'failed':
        return 'Failed';
      case 'frontend-only':
        return 'Frontend Only';
      default:
        return 'Draft';
    }
  }

  function getVisibilityIcon(visibility: string) {
    switch (visibility) {
      case 'public':
        return <GlobeIcon className="h-4 w-4 text-blue-600" />;
      case 'organization':
        return <EyeOpenIcon className="h-4 w-4 text-purple-600" />;
      default:
        return <LockClosedIcon className="h-4 w-4 text-gray-600" />;
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-6 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded bg-gray-200"></div>
            ))}
          </div>
          <div className="h-96 rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agents</h1>
          <p className="mt-2 text-gray-600">
            Create, deploy, and manage your AI agents.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Filter Buttons */}
          <div className="flex items-center space-x-1 rounded-lg border border-gray-300 p-1">
            <button
              onClick={() => setViewFilter('all')}
              className={`rounded-md px-3 py-1 text-sm ${
                viewFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setViewFilter('agents')}
              className={`rounded-md px-3 py-1 text-sm ${
                viewFilter === 'agents'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => setViewFilter('characters')}
              className={`rounded-md px-3 py-1 text-sm ${
                viewFilter === 'characters'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Characters
            </button>
          </div>

          <Link href="/dashboard/agents/editor">
            <Button className="flex items-center space-x-2">
              <RocketIcon className="h-4 w-4" />
              <span>Agent Editor</span>
            </Button>
          </Link>

          <Link href="/characters/create">
            <Button variant="outline" className="flex items-center space-x-2">
              <PlusIcon className="h-4 w-4" />
              <span>Create Character</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Agents
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalAgents}
                </p>
              </div>
              <RocketIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Agents
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.activeAgents}
                </p>
              </div>
              <CheckCircledIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Interactions
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalInteractions.toLocaleString()}
                </p>
              </div>
              <ClockIcon className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalCost.toFixed(2)}
                </p>
              </div>
              <RocketIcon className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Agents List */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Agents</h2>
        </div>

        {/* Apply filter */}
        {(() => {
          const filteredAgents = agents.filter((agent) => {
            if (viewFilter === 'agents') {
              return agent.type === 'agent' || !agent.type;
            }
            if (viewFilter === 'characters') {
              return agent.type === 'character';
            }
            return true; // 'all'
          });

          return filteredAgents.length === 0 ? (
            <div className="p-8 text-center">
              <RocketIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                {viewFilter === 'characters'
                  ? 'No characters yet'
                  : viewFilter === 'agents'
                    ? 'No agents yet'
                    : 'No agents or characters yet'}
              </h3>
              <p className="mb-4 text-gray-600">
                {viewFilter === 'characters'
                  ? 'Create your first character to get started.'
                  : viewFilter === 'agents'
                    ? 'Create your first AI agent to get started.'
                    : 'Create your first AI agent or character to get started.'}
              </p>
              <div className="flex items-center justify-center space-x-3">
                {viewFilter !== 'characters' && (
                  <Link href="/dashboard/agents/create">
                    <Button className="flex items-center space-x-2">
                      <PlusIcon className="h-4 w-4" />
                      <span>Create Agent</span>
                    </Button>
                  </Link>
                )}
                {viewFilter !== 'agents' && (
                  <Link href="/characters/create">
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>Create Character</span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAgents.map((agent) => (
                <div key={agent.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-1 items-start space-x-4">
                      {/* Avatar */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 font-semibold text-white">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Agent Info */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {agent.name}
                          </h3>
                          <span className="text-sm text-gray-500">
                            /{agent.slug}
                          </span>
                          {getVisibilityIcon(agent.visibility)}
                          {agent.type === 'character' && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                              Character
                            </span>
                          )}
                        </div>

                        {agent.description && (
                          <p className="mb-2 text-gray-600">
                            {agent.description}
                          </p>
                        )}

                        {/* Status */}
                        <div className="mb-2 flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            {deployingAgents.has(agent.id) ? (
                              <ClockIcon className="h-4 w-4 animate-spin text-yellow-600" />
                            ) : (
                              getStatusIcon(agent.deploymentStatus)
                            )}
                            <span className="text-sm font-medium">
                              {deployingAgents.has(agent.id)
                                ? 'Deploying...'
                                : getStatusText(agent.deploymentStatus)}
                            </span>
                          </div>

                          {agent.deploymentUrl && (
                            <a
                              href={agent.deploymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLinkIcon className="h-3 w-3" />
                              <span>View Live</span>
                            </a>
                          )}
                        </div>

                        {/* Error Message */}
                        {agent.deploymentError && (
                          <div className="mb-2 text-sm text-red-600">
                            Error: {agent.deploymentError}
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 md:grid-cols-4">
                          <div>
                            <span className="font-medium">Plugins:</span>{' '}
                            {agent.plugins.length}
                          </div>
                          <div>
                            <span className="font-medium">Interactions:</span>{' '}
                            {agent.totalInteractions.toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Cost:</span> $
                            {agent.totalCost}
                          </div>
                          <div>
                            <span className="font-medium">Updated:</span>{' '}
                            {formatDate(agent.updatedAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="ml-4 flex items-center space-x-2">
                      {agent.type === 'character' ? (
                        // Character-specific actions (limited)
                        <>
                          {agent.deploymentUrl && (
                            <Link
                              href={agent.deploymentUrl}
                              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                              title="Chat with Character"
                            >
                              <ExternalLinkIcon className="h-4 w-4" />
                            </Link>
                          )}

                          <Link
                            href={`/characters/${agent.id}`}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                            title="Edit Character"
                          >
                            <Pencil1Icon className="h-4 w-4" />
                          </Link>

                          <button
                            onClick={() => {
                              setSelectedAgent(agent);
                              setShowDeleteModal(true);
                            }}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                            title="Delete Character"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        // Agent-specific actions (full capabilities)
                        <>
                          {agent.deploymentStatus === 'deployed' ? (
                            <button
                              onClick={() => stopAgent(agent.id)}
                              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                              title="Stop Agent"
                            >
                              <StopIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => deployAgent(agent.id)}
                              disabled={deployingAgents.has(agent.id)}
                              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-green-600 disabled:opacity-50"
                              title="Deploy Agent"
                            >
                              <PlayIcon className="h-4 w-4" />
                            </button>
                          )}

                          <Link
                            href={`/dashboard/agents/editor?id=${agent.id}`}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                            title="Edit Agent"
                          >
                            <Pencil1Icon className="h-4 w-4" />
                          </Link>

                          <button
                            onClick={() => {
                              setSelectedAgent(agent);
                              setShowDeleteModal(true);
                            }}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                            title="Delete Agent"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          selectedAgent?.type === 'character'
            ? 'Delete Character'
            : 'Delete Agent'
        }
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedAgent(null);
        }}
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <CrossCircledIcon className="mt-0.5 h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-gray-900">
                Are you sure you want to delete the{' '}
                {selectedAgent?.type === 'character' ? 'character' : 'agent'}{' '}
                <strong>"{selectedAgent?.name}"</strong>?
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {selectedAgent?.type === 'character'
                  ? 'This action cannot be undone. All conversations and configuration will be lost.'
                  : 'This action cannot be undone. The agent will be stopped and all configuration will be lost.'}
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <Button
              handleClick={() =>
                selectedAgent &&
                (selectedAgent.type === 'character'
                  ? deleteCharacter(selectedAgent.id)
                  : deleteAgent(selectedAgent.id))
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Delete{' '}
              {selectedAgent?.type === 'character' ? 'Character' : 'Agent'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
