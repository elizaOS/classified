import { useState, useEffect } from 'react';
import './GameInterface.css';
import { Services } from '../services';
import { useTauriChat } from '../hooks/useTauriChat';
import { useMediaCapture } from '../hooks/useMediaCapture';
import { SecurityWarning, SECURITY_CAPABILITIES } from './SecurityWarning';
import { CapabilityToggle } from './CapabilityToggle';
import { ConfigPanel, LogsPanel, AgentScreenPanel, TerminalPanel } from './StatusPanels';
import { TabNavigation, type TabType } from './shared/TabNavigation';
import { ConnectionStatus } from './shared/ConnectionStatus';
import type { OutputLine } from './StatusPanels/AgentScreenPanel';
import type { PluginToggleState } from './CapabilityToggle';

// Types specific to GameInterface
interface SecurityWarningState {
  isVisible: boolean;
  capability: string;
  onConfirm: () => void;
}

type LogsSubTabType = 'agent' | 'container';

// Extend Window interface for test compatibility
declare global {
  interface Window {
    elizaClient?: {
      socket: {
        connected: boolean;
        on: (event: string, callback: Function) => void;
        emit: (event: string, data: unknown) => void;
        disconnect: () => void;
        connect: () => void;
      };
      sendMessage: (message: string) => void;
    };
  }
}

const GameInterface = () => {
  // State declarations
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [currentTab, setCurrentTab] = useState<TabType>('terminal');
  const [logsSubTab, setLogsSubTab] = useState<LogsSubTabType>('agent');
  const [plugins] = useState<PluginToggleState>({
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

  // Hooks
  const { streamingState, startMediaCapture, stopMediaStream } = useMediaCapture();
  const { isConnected: tauriConnected } = useTauriChat();

  // Initialize services on mount
  useEffect(() => {
    const initializeServices = async () => {
      await Services.chat.ensureInitialized();
      setIsConnected(Services.chat.getInitializationStatus().isInitialized);
    };
    initializeServices();
  }, []);

  // Update connection status from Tauri chat hook
  useEffect(() => {
    setIsConnected(tauriConnected);
  }, [tauriConnected]);

  // In production, elizaClient is managed by the Tauri backend

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrentTab('terminal' as TabType);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Video processing function
  const processVideoStream = async (stream: MediaStream, type: string) => {
    console.log(`Processing ${type} stream:`, stream);
    // TODO: Implement actual video processing
  };

  // Render the current panel based on selected tab
  const renderCurrentPanel = () => {
    switch (currentTab) {
      case 'terminal':
        return <TerminalPanel output={output} />;
      case 'config':
        return (
          <ConfigPanel
            configValues={{}}
            pluginConfigs={{}}
            isResetting={false}
            updatePluginConfig={() => {}}
            validateConfiguration={() => {}}
            testConfiguration={() => {}}
            setShowResetDialog={() => {}}
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
    <div className="game-interface" data-testid="game-interface">
      {/* Connection Status */}
      <ConnectionStatus isConnected={isConnected} />

      {/* Tab Navigation */}
      <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Layout */}
      <div className="main-layout">
        {/* Content Area */}
        <div className="content-area">
          <div className="panel-container">{renderCurrentPanel()}</div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-title">⚙️ CAPABILITIES</div>
          <CapabilityToggle
            states={plugins}
            capabilityUsage={{}}
            onToggle={async (capability) => {
              console.log('Toggle capability:', capability);
            }}
          />
        </div>
      </div>

      {/* Security Warning Modal */}
      <SecurityWarning
        capability={securityWarning.capability}
        risks={
          SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]
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
    </div>
  );
};

export default GameInterface;
