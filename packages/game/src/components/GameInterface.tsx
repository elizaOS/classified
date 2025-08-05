import { useState, useEffect } from 'react';
import { Services } from '../services';
import { useTauriChat } from '../hooks/useTauriChat';
import { useMediaCapture } from '../hooks/useMediaCapture';
import { SecurityWarning, CAPABILITY_RISKS } from './SecurityWarning';
import { CapabilityToggle } from './CapabilityToggle';
import {
  ConfigPanel,
  LogsPanel,
  AgentScreenPanel,
  TerminalPanel,
  GoalsPanel,
  TodosPanel,
  FilesPanel,
  MonologuePanel,
} from './StatusPanels';
import type { Goal, Todo, KnowledgeFile, MonologueItem } from './StatusPanels';
import { TabNavigation, type TabType } from './shared/TabNavigation';
import { KeyboardShortcuts } from './shared/KeyboardShortcuts';
import { createLogger } from '../utils/logger';
import type { OutputLine } from './StatusPanels/AgentScreenPanel';
import type { PluginToggleState } from './CapabilityToggle';

const logger = createLogger('GameInterface');

// Types specific to GameInterface
interface SecurityWarningState {
  isVisible: boolean;
  capability: string;
  onConfirm: () => void;
}

type LogsSubTabType = 'agent' | 'container';
type StatusPanelTab = 'goals' | 'todos' | 'files' | 'monologue';

const GameInterface = () => {
  // Hooks - MUST be called before any conditional logic or returns
  const { streamingState, startMediaCapture, stopMediaStream } = useMediaCapture();
  const { isConnected: tauriConnected } = useTauriChat();

  // State declarations
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [currentTab, setCurrentTab] = useState<TabType>('terminal');
  const [logsSubTab, setLogsSubTab] = useState<LogsSubTabType>('agent');
  const [plugins, setPlugins] = useState<PluginToggleState>({
    autonomy: false,
    camera: false,
    screen: false,
    microphone: false,
    speakers: false,
    shell: false,
    browser: false,
  });
  const [securityWarning, setSecurityWarning] = useState<SecurityWarningState>({
    isVisible: false,
    capability: '',
    onConfirm: () => {},
  });
  const [agentScreenActive, setAgentScreenActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [pluginConfigs, setPluginConfigs] = useState<Record<string, any>>({});
  const [isResetting] = useState(false);
  const [, setShowResetDialog] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [activeStatusTab, setActiveStatusTab] = useState<StatusPanelTab>('goals');

  // Status panel states
  const [goals, setGoals] = useState<Goal[]>([
    // Example goals - in production these would come from the agent
    {
      id: '1',
      name: 'Complete User Request',
      description: 'Help the user with their current task',
      isCompleted: false,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [todos, setTodos] = useState<Todo[]>([
    // Example todos - in production these would come from the agent
    {
      id: '1',
      name: 'Analyze code structure',
      type: 'one-off',
      isCompleted: false,
      priority: 1,
    },
  ]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([
    // Example files - in production these would be actual knowledge base files
    {
      id: '1',
      title: 'Project Documentation',
      type: 'markdown',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [agentMonologue, setAgentMonologue] = useState<MonologueItem[]>([
    // Example thoughts - in production these would come from the agent
    {
      text: 'Initializing agent capabilities...',
      timestamp: Date.now(),
      isFromAgent: true,
    },
  ]);

  // Simulate agent activity for demo purposes
  useEffect(() => {
    // Add periodic monologue updates when connected
    if (isConnected) {
      const interval = setInterval(() => {
        setAgentMonologue((prev) => {
          const thoughts = [
            'Processing user input...',
            'Analyzing code structure...',
            'Checking system status...',
            'Monitoring capabilities...',
            'Ready for commands...',
          ];
          const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
          return [
            ...prev.slice(-4),
            {
              text: randomThought,
              timestamp: Date.now(),
              isFromAgent: true,
            },
          ];
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Initialize services on mount
  useEffect(() => {
    let mounted = true;

    const initializeServices = async () => {
      try {
        await Services.chat.ensureInitialized();

        if (!mounted) return;

        setIsConnected(Services.chat.getInitializationStatus().isInitialized);

        try {
          const plugins = await Services.config.fetchPluginConfigs();
          if (mounted) {
            setPluginConfigs(plugins);
          }
        } catch (error) {
          logger.warn('Failed to load plugin configs', { error });
          // Continue without plugin configs
        }
      } catch (error) {
        logger.error('Failed to initialize services', { error });
        if (mounted) {
          setIsConnected(false);
        }
      }
    };

    initializeServices();

    return () => {
      mounted = false;
    };
  }, []);

  // Update connection status from Tauri chat hook
  useEffect(() => {
    setIsConnected(tauriConnected);
  }, [tauriConnected]);

  // In production, elizaClient is managed by the Tauri backend

  // Keyboard shortcuts and focus management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global keyboard shortcuts
      if (e.key === 'Escape') {
        setCurrentTab('terminal' as TabType);
        // Focus the chat input when returning to terminal
        setTimeout(() => {
          const chatInput = document.querySelector(
            '[data-testid="chat-input"]'
          ) as HTMLInputElement;
          if (chatInput) {
            chatInput.focus();
          }
        }, 100);
      }

      // Tab navigation with Alt + number keys
      if (e.altKey && !e.shiftKey && !e.ctrlKey) {
        const tabMap: { [key: string]: TabType } = {
          '1': 'terminal',
          '2': 'config',
          '3': 'logs',
          '4': 'agent-screen',
        };

        const statusTabMap: { [key: string]: StatusPanelTab } = {
          '5': 'goals',
          '6': 'todos',
          '7': 'files',
          '8': 'monologue',
        };

        if (tabMap[e.key]) {
          e.preventDefault();
          setCurrentTab(tabMap[e.key]);
        } else if (statusTabMap[e.key]) {
          e.preventDefault();
          setActiveStatusTab(statusTabMap[e.key]);
        }
      }

      // Focus management - Alt + F to focus chat input
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const chatInput = document.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
        if (chatInput) {
          chatInput.focus();
        }
      }

      // Show keyboard shortcuts with ? key
      if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        // Only show if not typing in an input field
        const activeElement = document.activeElement;
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShowKeyboardShortcuts((prev) => !prev);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Auto-focus chat input when switching to terminal tab
  useEffect(() => {
    if (currentTab === 'terminal') {
      setTimeout(() => {
        const chatInput = document.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
        if (chatInput && document.activeElement !== chatInput) {
          chatInput.focus();
        }
      }, 100);
    }
  }, [currentTab]);

  // Video processing function
  const processVideoStream = async (stream: MediaStream, type: string) => {
    logger.debug(`Processing ${type} stream`, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
    });
    // Video processing is handled by the media capture hook and Tauri backend
  };

  // Configuration management functions
  const updatePluginConfig = async (plugin: string, key: string, value: any) => {
    // Update local state immediately for responsive UI
    setPluginConfigs((prev) => ({
      ...prev,
      [plugin]: {
        ...prev[plugin],
        [key]: value,
      },
    }));

    try {
      await Services.config.updatePluginConfig(plugin, { [key]: value });
      // Refresh plugin configs
      const plugins = await Services.config.fetchPluginConfigs();
      setPluginConfigs(plugins);
    } catch (error) {
      logger.error('Failed to update plugin config', { plugin, key, error });

      // Show user-friendly error message
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: `Configuration update pending - changes will be applied when backend is available`,
          timestamp: new Date(),
        },
      ]);

      // Keep the local state updated even if backend fails
      // This allows the UI to remain responsive
    }
  };

  const validateConfiguration = async () => {
    try {
      const result = await Services.config.validateConfiguration();
      logger.info('Configuration validation result', { result });

      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: result.valid
            ? '✅ Configuration is valid'
            : `❌ Configuration validation failed: ${result.errors?.join(', ')}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      logger.error('Configuration validation failed', { error });
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: `Configuration validation unavailable - backend service not responding`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const testConfiguration = async () => {
    try {
      const result = await Services.config.testConfiguration();
      logger.info('Configuration test result', { result });

      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: result.success
            ? '✅ Configuration test passed'
            : `❌ Configuration test failed: ${JSON.stringify(result.results)}`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      logger.error('Configuration test failed', { error });
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: `Configuration test unavailable - backend service not responding`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  // Render the current panel based on selected tab
  const renderCurrentPanel = () => {
    switch (currentTab) {
      case 'terminal':
        return (
          <TerminalPanel
            output={output}
            onNewMessage={(message) => setOutput((prev) => [...prev, message])}
          />
        );
      case 'config':
        return (
          <ConfigPanel
            pluginConfigs={pluginConfigs}
            isResetting={isResetting}
            updatePluginConfig={updatePluginConfig}
            validateConfiguration={validateConfiguration}
            testConfiguration={testConfiguration}
            setShowResetDialog={setShowResetDialog}
          />
        );
      case 'logs':
        return <LogsPanel activeSubTab={logsSubTab} onSubTabChange={setLogsSubTab} />;
      case 'agent-screen':
        return (
          <AgentScreenPanel
            agentScreenActive={agentScreenActive}
            setAgentScreenActive={setAgentScreenActive}
            streamingState={streamingState}
            startMediaCapture={startMediaCapture}
            stopMediaStream={stopMediaStream}
            processVideoStream={processVideoStream}
            setOutput={setOutput}
          />
        );
      default:
        return <TerminalPanel output={output} />;
    }
  };

  return (
    <div
      className="flex flex-col h-screen bg-black text-terminal-green font-mono relative"
      data-testid="game-interface"
    >
      {/* Tab Navigation */}
      <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">{renderCurrentPanel()}</div>
        </div>

        {/* Sidebar */}
        <div className="w-[350px] border-l border-terminal-green bg-black/90 p-4 overflow-y-auto flex flex-col gap-5">
          <div className="mb-5">
            <div className="text-terminal-green font-bold mb-4 text-center border-b border-terminal-green-border pb-2 text-xs uppercase tracking-wider">
              ⚙️ CAPABILITIES
            </div>
            <CapabilityToggle
              states={plugins}
              capabilityUsage={{}}
              onToggle={async (capability, newState) => {
                logger.info('Toggling capability', { capability, newState });

                // Update local state immediately for responsive UI
                setPlugins((prev) => ({ ...prev, [capability]: newState }));

                try {
                  // Use the toggle_capability command for agent capabilities
                  const result = await Services.agent.toggleCapability(capability, newState);

                  if (result.success) {
                    // Add output message about the capability change
                    setOutput((prev) => [
                      ...prev,
                      {
                        type: 'system',
                        content: `${capability.toUpperCase()} capability ${newState ? 'ENABLED' : 'DISABLED'}`,
                        timestamp: new Date(),
                        metadata: { capability, state: newState },
                      },
                    ]);

                    // Update goals when autonomy is enabled
                    if (capability === 'autonomy' && newState) {
                      setGoals((prev) => [
                        ...prev,
                        {
                          id: `goal-${Date.now()}`,
                          name: 'Autonomous Operation',
                          description: 'Operate autonomously to assist the user',
                          isCompleted: false,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                    }

                    // Add todo when a new capability is enabled
                    if (newState) {
                      setTodos((prev) => [
                        ...prev,
                        {
                          id: `todo-${Date.now()}`,
                          name: `Test ${capability} capability`,
                          type: 'one-off' as const,
                          isCompleted: false,
                          priority: 2,
                        },
                      ]);
                    }
                  } else {
                    throw new Error(result.error || 'Failed to toggle capability');
                  }
                } catch (error) {
                  // Revert state on error
                  setPlugins((prev) => ({ ...prev, [capability]: !newState }));
                  logger.error('Failed to toggle capability', { capability, error });

                  setOutput((prev) => [
                    ...prev,
                    {
                      type: 'error',
                      content: `Failed to ${newState ? 'enable' : 'disable'} ${capability}: ${error}`,
                      timestamp: new Date(),
                    },
                  ]);
                }
              }}
            />
          </div>

          {/* Status Panels Section */}
          <div className="mb-5 flex flex-col gap-3">
            <div className="text-terminal-green font-bold mb-4 text-center border-b border-terminal-green-border pb-2 text-xs uppercase tracking-wider">
              📊 STATUS
            </div>

            {/* Status Panel Tabs */}
            <div className="flex gap-1 mb-3 bg-black/60 border border-terminal-green-border p-1">
              <button
                className={`flex-1 h-9 flex items-center justify-center gap-1 transition-all duration-200 outline-none font-mono relative ${
                  activeStatusTab === 'goals'
                    ? 'bg-gradient-to-br from-green-700 to-terminal-green border border-terminal-green text-black shadow-[0_0_8px_rgba(0,255,0,0.4)]'
                    : 'bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 text-gray-400 hover:bg-gradient-to-br hover:from-gray-800 hover:to-gray-700 hover:border-gray-600 hover:text-gray-300 hover:transform hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
                onClick={() => setActiveStatusTab('goals')}
                title={`Goals (${goals.length})`}
              >
                <span className="text-base leading-none">🎯</span>
                {goals.length > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 leading-none min-w-[16px] text-center ${activeStatusTab === 'goals' ? 'bg-black/30' : 'bg-white/10'}`}
                  >
                    {goals.length}
                  </span>
                )}
              </button>
              <button
                className={`flex-1 h-9 flex items-center justify-center gap-1 transition-all duration-200 outline-none font-mono relative ${
                  activeStatusTab === 'todos'
                    ? 'bg-gradient-to-br from-green-700 to-terminal-green border border-terminal-green text-black shadow-[0_0_8px_rgba(0,255,0,0.4)]'
                    : 'bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 text-gray-400 hover:bg-gradient-to-br hover:from-gray-800 hover:to-gray-700 hover:border-gray-600 hover:text-gray-300 hover:transform hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
                onClick={() => setActiveStatusTab('todos')}
                title={`Tasks (${todos.length})`}
              >
                <span className="text-base leading-none">✓</span>
                {todos.length > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 leading-none min-w-[16px] text-center ${activeStatusTab === 'todos' ? 'bg-black/30' : 'bg-white/10'}`}
                  >
                    {todos.length}
                  </span>
                )}
              </button>
              <button
                className={`flex-1 h-9 flex items-center justify-center gap-1 transition-all duration-200 outline-none font-mono relative ${
                  activeStatusTab === 'files'
                    ? 'bg-gradient-to-br from-green-700 to-terminal-green border border-terminal-green text-black shadow-[0_0_8px_rgba(0,255,0,0.4)]'
                    : 'bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 text-gray-400 hover:bg-gradient-to-br hover:from-gray-800 hover:to-gray-700 hover:border-gray-600 hover:text-gray-300 hover:transform hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
                onClick={() => setActiveStatusTab('files')}
                title={`Knowledge (${knowledgeFiles.length})`}
              >
                <span className="text-base leading-none">📄</span>
                {knowledgeFiles.length > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 leading-none min-w-[16px] text-center ${activeStatusTab === 'files' ? 'bg-black/30' : 'bg-white/10'}`}
                  >
                    {knowledgeFiles.length}
                  </span>
                )}
              </button>
              <button
                className={`flex-1 h-9 flex items-center justify-center gap-1 transition-all duration-200 outline-none font-mono relative ${
                  activeStatusTab === 'monologue'
                    ? 'bg-gradient-to-br from-green-700 to-terminal-green border border-terminal-green text-black shadow-[0_0_8px_rgba(0,255,0,0.4)]'
                    : 'bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 text-gray-400 hover:bg-gradient-to-br hover:from-gray-800 hover:to-gray-700 hover:border-gray-600 hover:text-gray-300 hover:transform hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
                onClick={() => setActiveStatusTab('monologue')}
                title={`Thoughts (${agentMonologue.length})`}
              >
                <span className="text-base leading-none">💭</span>
                {agentMonologue.length > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 leading-none min-w-[16px] text-center ${activeStatusTab === 'monologue' ? 'bg-black/30' : 'bg-white/10'}`}
                  >
                    {agentMonologue.length}
                  </span>
                )}
              </button>
            </div>

            {/* Active Panel Content */}
            <div className="bg-black/60 border border-terminal-green-border overflow-hidden transition-all duration-200 max-h-96 flex flex-col hover:border-terminal-green/50 hover:bg-black/70 hover:shadow-[0_0_8px_rgba(0,255,0,0.2)]">
              {activeStatusTab === 'goals' && <GoalsPanel goals={goals} />}
              {activeStatusTab === 'todos' && <TodosPanel todos={todos} />}
              {activeStatusTab === 'files' && (
                <FilesPanel
                  knowledgeFiles={knowledgeFiles}
                  onFileUpload={async (event) => {
                    // Handle file upload
                    const file = event.target.files?.[0];
                    if (file) {
                      logger.info('File upload requested', { fileName: file.name });
                      // TODO: Implement file upload
                    }
                  }}
                  onDeleteFile={async (fileId) => {
                    // Handle file deletion
                    logger.info('File deletion requested', { fileId });
                    setKnowledgeFiles((prev) => prev.filter((f) => f.id !== fileId));
                  }}
                />
              )}
              {activeStatusTab === 'monologue' && (
                <MonologuePanel agentMonologue={agentMonologue} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security Warning Modal */}
      <SecurityWarning
        capability={securityWarning.capability}
        risks={
                      CAPABILITY_RISKS[securityWarning.capability as keyof typeof CAPABILITY_RISKS]
            ?.risks || []
        }
        riskLevel="medium"
        description="This capability requires system permissions."
        onConfirm={securityWarning.onConfirm}
        onCancel={() =>
          setSecurityWarning({ isVisible: false, capability: '', onConfirm: () => {} })
        }
        isVisible={securityWarning.isVisible}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcuts
        isVisible={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
};

export default GameInterface;
