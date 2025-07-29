'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  GitBranch,
  Code,
  CheckCircle,
  Clock,
  AlertCircle,
  Sparkles,
  Send,
  BarChart3,
  TrendingUp,
  FileText,
  TestTube,
  Rocket,
  ArrowRight,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-switcher';
import { ChatMessage } from '@/components/autocoder/AgentChat';

interface SwarmProject {
  id: string;
  name: string;
  description: string;
  type: string;
  currentPhase: string;
  status: string;
  progress: {
    overall: number;
    analysis: number;
    planning: number;
    development: number;
    testing: number;
    deployment: number;
  };
  activeAgents: Array<{
    agentId: string;
    role: string;
    status: string;
    specialization?: string;
  }>;
  timeline: {
    estimatedCompletion: string;
    milestones: Array<{
      phase: string;
      estimatedDate: string;
      completed: boolean;
    }>;
  };
  repositoryUrl?: string;
}

interface SwarmProjectDashboardProps {
  project: SwarmProject;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onBack: () => void;
  isConnected: boolean;
  onScaleProject?: (targetAgentCount: number) => void;
  isScaling?: boolean;
  onUpdateStatus?: (
    action: 'pause' | 'resume' | 'cancel',
    reason?: string,
  ) => void;
  isUpdatingStatus?: boolean;
}

export function SwarmProjectDashboard({
  project,
  messages,
  onSendMessage,
  onBack,
  isConnected,
  onScaleProject,
  isScaling = false,
  onUpdateStatus,
  isUpdatingStatus = false,
}: SwarmProjectDashboardProps) {
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'agents' | 'chat' | 'progress'
  >('overview');

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'analysis':
        return <FileText className="h-4 w-4" />;
      case 'planning':
        return <GitBranch className="h-4 w-4" />;
      case 'development':
        return <Code className="h-4 w-4" />;
      case 'testing':
        return <TestTube className="h-4 w-4" />;
      case 'deployment':
        return <Rocket className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'working':
        return 'text-orange-600 bg-orange-100';
      case 'ready':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-stroke-weak bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="border-b border-stroke-weak p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="text-typography-weak hover:text-typography-strong"
            >
              ← Back
            </button>
            <ThemeToggle />
          </div>
          <div className="mt-4">
            <h1 className="truncate text-lg font-semibold text-typography-strong">
              {project.name}
            </h1>
            <div className="mt-1 flex items-center space-x-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  project.status === 'active'
                    ? 'bg-green-500'
                    : project.status === 'completed'
                      ? 'bg-blue-500'
                      : project.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm capitalize text-typography-weak">
                {project.status}
              </span>
              <span className="text-xs text-typography-weak">
                • {project.activeAgents.length} engineers
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-stroke-weak">
          <nav className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'agents', label: 'Engineers', icon: Users },
              { id: 'progress', label: 'Progress', icon: BarChart3 },
              { id: 'chat', label: 'Chat', icon: Sparkles },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex flex-1 items-center justify-center space-x-1 py-3 text-xs ${
                  activeTab === id
                    ? 'border-b-2 border-orange-500 text-orange-600'
                    : 'text-typography-weak hover:text-typography-strong'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Current Phase */}
              <div className="rounded-lg border border-stroke-weak bg-background p-3">
                <div className="mb-2 flex items-center space-x-2">
                  {getPhaseIcon(project.currentPhase)}
                  <span className="font-medium capitalize text-typography-strong">
                    {project.currentPhase}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-orange-600 transition-all duration-300"
                    style={{ width: `${project.progress.overall}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-typography-weak">
                  {project.progress.overall}% complete
                </p>
              </div>

              {/* Project Type */}
              <div className="rounded-lg border border-stroke-weak bg-background p-3">
                <h3 className="mb-1 font-medium text-typography-strong">
                  Project Type
                </h3>
                <span className="inline-block rounded bg-orange-100 px-2 py-1 text-xs text-orange-800">
                  {project.type}
                </span>
              </div>

              {/* Repository */}
              {project.repositoryUrl && (
                <div className="rounded-lg border border-stroke-weak bg-background p-3">
                  <h3 className="mb-1 font-medium text-typography-strong">
                    Repository
                  </h3>
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-orange-600 hover:underline"
                  >
                    <GitBranch className="mr-1 h-3 w-3" />
                    View on GitHub
                  </a>
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-lg border border-stroke-weak bg-background p-3">
                <h3 className="mb-2 font-medium text-typography-strong">
                  Timeline
                </h3>
                <div className="space-y-2">
                  {project.timeline.milestones.map((milestone, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      {milestone.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                      <span
                        className={`text-sm ${
                          milestone.completed
                            ? 'text-typography-strong'
                            : 'text-typography-weak'
                        }`}
                      >
                        {milestone.phase}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-4">
              {/* Scaling Controls */}
              {onScaleProject && (
                <div className="rounded-lg border border-stroke-weak bg-background p-3">
                  <h3 className="mb-2 font-medium text-typography-strong">
                    Scale Team
                  </h3>
                  <div className="mb-2 flex items-center space-x-2">
                    <span className="text-sm text-typography-weak">
                      Engineers:
                    </span>
                    <span className="font-medium text-typography-strong">
                      {project.activeAgents.length}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5, 7, 10].map((count) => (
                      <button
                        key={count}
                        onClick={() => onScaleProject(count)}
                        disabled={
                          isScaling || count === project.activeAgents.length
                        }
                        className={`rounded px-2 py-1 text-xs transition-colors ${
                          count === project.activeAgents.length
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700 disabled:opacity-50'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  {isScaling && (
                    <p className="mt-2 text-xs text-orange-600">
                      Scaling team...
                    </p>
                  )}
                </div>
              )}

              {/* Active Engineers List */}
              <div className="space-y-3">
                {project.activeAgents.map((agent, idx) => (
                  <div
                    key={agent.agentId}
                    className="rounded-lg border border-stroke-weak bg-background p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600">
                          <span className="text-xs font-medium text-white">
                            {agent.role.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-typography-strong">
                            Engineer {idx + 1}
                          </p>
                          <p className="text-xs capitalize text-typography-weak">
                            {agent.role}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-1 text-xs ${getStatusColor(agent.status)}`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    {agent.specialization && (
                      <p className="text-xs text-typography-weak">
                        Specialization: {agent.specialization}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-4">
              {Object.entries(project.progress).map(([phase, percentage]) => {
                if (phase === 'overall') {
                  return null;
                }
                return (
                  <div key={phase} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getPhaseIcon(phase)}
                        <span className="text-sm font-medium capitalize text-typography-strong">
                          {phase}
                        </span>
                      </div>
                      <span className="text-sm text-typography-weak">
                        {percentage}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-orange-600 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex h-full flex-col">
              <div className="mb-4 flex-1 space-y-3">
                {messages.slice(-10).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.type === 'user'
                          ? 'bg-orange-600 text-white'
                          : 'border border-stroke-weak bg-white text-typography-strong dark:bg-gray-800'
                      }`}
                    >
                      {msg.type === 'agent' && (
                        <div className="mb-1 flex items-center text-xs text-typography-weak">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Engineer
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.message}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-end space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Message the swarm..."
                  className="flex-1 rounded-lg border border-stroke-weak bg-background px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isConnected}
                  className="rounded-lg bg-orange-600 px-3 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Main Header */}
        <header className="border-b border-stroke-weak bg-white px-6 py-4 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-typography-strong">
                {project.name}
              </h2>
              <p className="mt-1 text-sm text-typography-weak">
                {project.description}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-typography-strong">
                  {project.progress.overall}% Complete
                </p>
                <p className="text-xs text-typography-weak">
                  {
                    project.activeAgents.filter((a) => a.status === 'working')
                      .length
                  }{' '}
                  engineers working
                </p>
              </div>
              <div className="relative h-16 w-16">
                <svg
                  className="h-16 w-16 -rotate-90 transform"
                  viewBox="0 0 64 64"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - project.progress.overall / 100)}`}
                    className="text-orange-600 transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-medium text-typography-strong">
                    {project.progress.overall}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Quick Actions */}
            {onScaleProject && (
              <div className="rounded-lg border border-stroke-weak bg-white p-4 dark:bg-gray-900">
                <h3 className="mb-3 font-semibold text-typography-strong">
                  Quick Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      onScaleProject(project.activeAgents.length + 1)
                    }
                    disabled={isScaling || project.activeAgents.length >= 10}
                    className="flex items-center space-x-1 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Users className="h-4 w-4" />
                    <span>Add Engineer</span>
                  </button>
                  {project.activeAgents.length > 1 && (
                    <button
                      onClick={() =>
                        onScaleProject(project.activeAgents.length - 1)
                      }
                      disabled={isScaling}
                      className="flex items-center space-x-1 rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Users className="h-4 w-4" />
                      <span>Remove Engineer</span>
                    </button>
                  )}
                  {onUpdateStatus && (
                    <>
                      {project.status === 'active' && (
                        <button
                          onClick={() => onUpdateStatus('pause')}
                          disabled={isUpdatingStatus}
                          className="flex items-center space-x-1 rounded bg-yellow-600 px-3 py-2 text-sm text-white hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Clock className="h-4 w-4" />
                          <span>Pause</span>
                        </button>
                      )}
                      {project.status === 'paused' && (
                        <button
                          onClick={() => onUpdateStatus('resume')}
                          disabled={isUpdatingStatus}
                          className="flex items-center space-x-1 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Resume</span>
                        </button>
                      )}
                      {(project.status === 'active' ||
                        project.status === 'paused') && (
                        <button
                          onClick={() =>
                            onUpdateStatus(
                              'cancel',
                              'User requested cancellation',
                            )
                          }
                          disabled={isUpdatingStatus}
                          className="flex items-center space-x-1 rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <AlertCircle className="h-4 w-4" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </>
                  )}
                  {project.repositoryUrl && (
                    <a
                      href={project.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      <GitBranch className="h-4 w-4" />
                      <span>View Repository</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Phase Progress */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              {[
                { key: 'analysis', label: 'Analysis', icon: FileText },
                { key: 'planning', label: 'Planning', icon: GitBranch },
                { key: 'development', label: 'Development', icon: Code },
                { key: 'testing', label: 'Testing', icon: TestTube },
                { key: 'deployment', label: 'Deployment', icon: Rocket },
              ].map(({ key, label, icon: Icon }, idx) => {
                const progress =
                  project.progress[key as keyof typeof project.progress];
                const isActive = project.currentPhase === key;
                const isCompleted = progress === 100;

                return (
                  <div
                    key={key}
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      isActive
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : isCompleted
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-stroke-weak bg-background'
                    }`}
                  >
                    <div
                      className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
                        isActive
                          ? 'bg-orange-500 text-white'
                          : isCompleted
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-medium text-typography-strong">
                      {label}
                    </h3>
                    <p className="mt-1 text-xs text-typography-weak">
                      {progress}%
                    </p>
                    {idx < 4 && (
                      <ArrowRight className="mx-auto mt-2 h-4 w-4 text-gray-400" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active Engineers */}
            <div className="rounded-lg border border-stroke-weak bg-white p-6 dark:bg-gray-900">
              <h3 className="mb-4 font-semibold text-typography-strong">
                Active Engineers ({project.activeAgents.length})
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {project.activeAgents.map((agent, idx) => (
                  <div
                    key={agent.agentId}
                    className="rounded-lg border border-stroke-weak bg-background p-4"
                  >
                    <div className="mb-3 flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600">
                        <span className="text-sm font-medium text-white">
                          {agent.role.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-typography-strong">
                          Engineer {idx + 1}
                        </p>
                        <p className="text-sm capitalize text-typography-weak">
                          {agent.role}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-typography-weak">
                          Status
                        </span>
                        <span
                          className={`rounded px-2 py-1 text-xs ${getStatusColor(agent.status)}`}
                        >
                          {agent.status}
                        </span>
                      </div>
                      {agent.specialization && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-typography-weak">
                            Focus
                          </span>
                          <span className="text-xs text-typography-strong">
                            {agent.specialization}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-lg border border-stroke-weak bg-white p-6 dark:bg-gray-900">
              <h3 className="mb-4 font-semibold text-typography-strong">
                Recent Activity
              </h3>
              <div className="space-y-3">
                {messages.slice(-5).map((msg) => (
                  <div key={msg.id} className="flex items-start space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-typography-strong">
                          {msg.type === 'user' ? 'You' : 'Engineer'}
                        </span>
                        <span className="text-xs text-typography-weak">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-typography-weak">
                        {msg.message.length > 100
                          ? `${msg.message.substring(0, 100)}...`
                          : msg.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
