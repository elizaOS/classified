import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TauriService, TauriMessage as TauriMsg } from '../services/TauriService';
import { useTauriChat } from '../hooks/useTauriChat';
import { v4 as uuidv4 } from 'uuid';
import { SecurityWarning, SECURITY_CAPABILITIES } from './SecurityWarning';
import { InputValidator, SecurityLogger } from '../utils/SecurityUtils';
import { ContainerLogs } from './ContainerLogs';
import { AgentLogs } from './AgentLogs';

interface OutputLine {
  type: 'user' | 'agent' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

interface PluginToggleState {
  autonomy: boolean;
  camera: boolean;
  screen: boolean;
  microphone: boolean;
  shell: boolean;
  browser: boolean;
}

interface SecurityWarningState {
  isVisible: boolean;
  capability: string;
  onConfirm: () => void;
}

interface MediaStreams {
  camera?: MediaStream;
  screen?: MediaStream;
  microphone?: MediaStream;
}

interface StreamingState {
  camera: boolean;
  screen: boolean;
  microphone: boolean;
}

// Ultra simple buttons - each button triggers API calls and updates backend state
const UltraSimpleButtons: React.FC<{
  states: PluginToggleState;
  onToggle: (capability: string) => Promise<void>;
}> = ({ states, onToggle }) => {
  const [isTogglingState, setIsTogglingState] = useState({
    autonomy: false,
    camera: false,
    screen: false,
    microphone: false,
    shell: false,
    browser: false,
  });

  const buttonStyle = (isActive: boolean, isToggling: boolean) => ({
    flex: '1 1 0',
    height: '40px',
    backgroundColor: isActive ? '#00ff00' : '#1a1a1a',
    color: isActive ? '#000000' : '#00ff00',
    cursor: isToggling ? 'wait' : 'pointer',
    textAlign: 'center' as const,
    border: `1px solid ${isActive ? '#00ff00' : '#333333'}`,
    fontSize: '9px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
    opacity: isToggling ? 0.7 : 1,
  });

  const handleClick = async (capability: string) => {
    if (isTogglingState[capability as keyof typeof isTogglingState]) {
      return;
    } // Prevent double clicks

    setIsTogglingState((prev) => ({ ...prev, [capability]: true }));
    try {
      await onToggle(capability);
    } catch (error) {
      console.error(`Failed to toggle ${capability}:`, error);
    } finally {
      setIsTogglingState((prev) => ({ ...prev, [capability]: false }));
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2px', width: '100%' }}>
      <div
        style={buttonStyle(states.autonomy, isTogglingState.autonomy)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('CLICKED: autonomy');
          handleClick('autonomy');
        }}
        data-testid="autonomy-toggle"
      >
        <span data-testid="autonomy-toggle-status">{states.autonomy ? '●' : '○'}</span>
        <span>{isTogglingState.autonomy ? '...' : 'AUTO'}</span>
      </div>

      <div
        style={buttonStyle(states.camera, isTogglingState.camera)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('CLICKED: camera');
          handleClick('camera');
        }}
        data-testid="camera-toggle"
      >
        <span data-testid="camera-toggle-status">{states.camera ? '●' : '○'}</span>
        <span>{isTogglingState.camera ? '...' : 'CAM'}</span>
      </div>

      <div
        style={buttonStyle(states.screen, isTogglingState.screen)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('CLICKED: screen');
          handleClick('screen');
        }}
        data-testid="screen-toggle"
      >
        <span data-testid="screen-toggle-status">{states.screen ? '●' : '○'}</span>
        <span>{isTogglingState.screen ? '...' : 'SCR'}</span>
      </div>

      <div
        style={buttonStyle(states.microphone, isTogglingState.microphone)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('CLICKED: microphone');
          handleClick('microphone');
        }}
        data-testid="microphone-toggle"
      >
        <span data-testid="microphone-toggle-status">{states.microphone ? '●' : '○'}</span>
        <span>{isTogglingState.microphone ? '...' : 'MIC'}</span>
      </div>

      <div
        style={buttonStyle(states.shell, isTogglingState.shell)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('CLICKED: shell');
          handleClick('shell');
        }}
        data-testid="shell-toggle"
      >
        <span data-testid="shell-toggle-status">{states.shell ? '●' : '○'}</span>
        <span>{isTogglingState.shell ? '...' : 'SH'}</span>
      </div>

      <div
        style={buttonStyle(states.browser, isTogglingState.browser)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('CLICKED: browser');
          handleClick('browser');
        }}
        data-testid="browser-toggle"
      >
        <span data-testid="browser-toggle-status">{states.browser ? '●' : '○'}</span>
        <span>{isTogglingState.browser ? '...' : 'WWW'}</span>
      </div>
    </div>
  );
};

interface Goal {
  id: string;
  name: string;
  description: string;
  isCompleted: boolean;
  createdAt: string;
}

interface Todo {
  id: string;
  name: string;
  type: 'daily' | 'one-off' | 'aspirational';
  isCompleted: boolean;
  priority?: number;
}

export const GameInterface: React.FC = () => {
  // Chat state
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputLine[]>([
    {
      type: 'system',
      content: '◉ ELIZA TERMINAL v2.0 - Agent Connection Established',
      timestamp: new Date(),
    },
  ]);

  // Game API readiness state
  const [gameApiReady, setGameApiReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  
  // Model readiness state
  const [modelsReady, setModelsReady] = useState(false);
  const [checkingModels, setCheckingModels] = useState(true);

  // Plugin toggles
  const [plugins, setPlugins] = useState<PluginToggleState>({
    autonomy: false, // Default to off since autonomy service is temporarily disabled
    camera: false,
    screen: false,
    microphone: false,
    shell: false,
    browser: false,
  });

  // Data state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [agentMonologue, setAgentMonologue] = useState<
    Array<{ text: string; timestamp: number; isFromAgent: boolean }>
  >([]);
  // Agent status removed - not currently used

  // UI state
  const [currentTab, setCurrentTab] = useState<
    'goals' | 'todos' | 'monologue' | 'files' | 'config' | 'logs' | 'agent-screen'
  >('goals');
  const [logsSubTab, setLogsSubTab] = useState<'agent' | 'container'>('agent');
  // Config dialog removed - not currently used
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState<
    Array<{ id: string; title: string; type: string; createdAt: string }>
  >([]);
  const [isResetting, setIsResetting] = useState(false);
  const [pluginConfigs, setPluginConfigs] = useState<any>({});
  const [configValues, setConfigValues] = useState<any>({});
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [monologue, setMonologue] = useState<string[]>([]);

  // Security state
  const [securityWarning, setSecurityWarning] = useState<SecurityWarningState>({
    isVisible: false,
    capability: '',
    onConfirm: () => {},
  });

  const [_userId] = useState(() => {
    const stored = localStorage.getItem('terminal-user-id');
    if (stored) {
      return stored;
    }
    const newId = uuidv4();
    localStorage.setItem('terminal-user-id', newId);
    return newId;
  });

  // Media streaming state
  const [mediaStreams, setMediaStreams] = useState<MediaStreams>({});
  const [streamingState, setStreamingState] = useState<StreamingState>({
    camera: false,
    screen: false,
    microphone: false,
  });
  const [agentScreenActive, setAgentScreenActive] = useState(false);
  const mediaCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const historyPosition = useRef<number>(-1);
  const commandHistory = useRef<string[]>([]);
  const lastProcessedRef = useRef<number>(0);

  // Check if running in Tauri environment - make it reactive
  const [isRunningInTauri, setIsRunningInTauri] = useState(false);
  const [tauriCheckComplete, setTauriCheckComplete] = useState(false);

  // Check Tauri environment on mount and after a delay
  useEffect(() => {
    const checkTauri = async () => {
      // Initial check
      setIsRunningInTauri(TauriService.isRunningInTauri());

      // Wait for potential initialization
      await TauriService.ensureInitialized();

      // Check again after initialization
      const status = TauriService.getInitializationStatus();
      setIsRunningInTauri(status.isTauri);
      setTauriCheckComplete(true);
    };

    checkTauri();
  }, []);

  // Listen for startup status updates to track Game API readiness
  useEffect(() => {
    if (!isRunningInTauri) return;

    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { invoke } = await import('@tauri-apps/api/core');

        // Get current startup status
        try {
          const currentStatus = await invoke('get_startup_status');
          if (currentStatus && typeof currentStatus === 'object') {
            const status = currentStatus as any;
            setGameApiReady(status.game_api_ready || false);

            // Check for error states that affect Game API
            if (status.stage === 'Error' && status.message?.includes('Game API')) {
              setStartupError(status.details || 'Game API verification failed');
            }
          }
        } catch (e) {
          console.error('Failed to get startup status:', e);
        }

        // Listen for startup status updates
        const unlisten = await listen('startup-status', (event: any) => {
          const status = event.payload;
          if (status) {
            setGameApiReady(status.game_api_ready || false);

            // Update error state if Game API fails
            if (status.stage === 'Error' && status.message?.includes('Game API')) {
              setStartupError(status.details || 'Game API verification failed');
            } else if (status.stage === 'Ready' || status.stage === 'GameAPIReady') {
              setStartupError(null);
            }
          }
        });

        unlistenFn = unlisten;
      } catch (error) {
        console.error('Failed to setup startup status listener:', error);
      }
    };

    setupListener();

    // Cleanup
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [isRunningInTauri]);

  // Use Tauri chat hook if in Tauri, otherwise show loading or error
  const tauriChatResult = useTauriChat();

  const { isConnected, sendMessage, messages, error } = isRunningInTauri
    ? tauriChatResult
    : {
        isConnected: false,
        sendMessage: async () => {
          throw new Error('Not in Tauri environment');
        },
        messages: [],
        error: tauriCheckComplete ? 'Not running in Tauri environment' : null,
      };

  // Handle incoming messages
  useEffect(() => {
    // Only process new messages
    const newMessages = messages.slice(lastProcessedRef.current);

    newMessages.forEach((message: TauriMsg) => {
      // Ensure timestamp is a Date object
      const messageTimestamp =
        message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);

      // Add to output - deduplication is now handled by TauriService
      setOutput((prev) => [
        ...prev,
        {
          type: message.type,
          content: message.content,
          timestamp: messageTimestamp,
        },
      ]);

      // Add to agent monologue if it contains thinking patterns
      if (
        message.type === 'agent' &&
        (message.content.includes('thinking:') ||
          message.content.includes('goal:') ||
          message.content.includes('planning:') ||
          message.content.includes('What should I do next?'))
      ) {
        setAgentMonologue((prev) =>
          [
            ...prev.slice(-9),
            { text: message.content, timestamp: messageTimestamp.getTime(), isFromAgent: true },
          ].slice(-10)
        );
      }
    });

    // Update last processed index
    lastProcessedRef.current = messages.length;
  }, [messages]);

  // Connection status requires both WebSocket connection AND Game API readiness
  const effectiveIsConnected = isConnected && gameApiReady;

  // Media capture functions
  const startCameraCapture = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      return stream;
    } catch (error) {
      console.error('Failed to capture camera:', error);
      return null;
    }
  };

  const startScreenCapture = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      return stream;
    } catch (error) {
      console.error('Failed to capture screen:', error);
      return null;
    }
  };

  const startMicrophoneCapture = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });
      return stream;
    } catch (error) {
      console.error('Failed to capture microphone:', error);
      return null;
    }
  };

  // Stop media streams
  const stopMediaStream = (type: 'camera' | 'screen' | 'microphone') => {
    const stream = mediaStreams[type];
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());

      // Clean up audio processor if exists
      if (type === 'microphone' && (stream as any).audioProcessor) {
        const { audioContext, source, processor } = (stream as any).audioProcessor;
        source.disconnect();
        processor.disconnect();
        audioContext.close();
      }

      setMediaStreams((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });

      setStreamingState((prev) => ({ ...prev, [type]: false }));
    }
  };

  // Send frame to Tauri backend
  const sendFrameToTauri = async (imageData: Uint8Array, type: 'camera' | 'screen') => {
    try {
      await invoke('stream_media_frame', {
        stream_type: type,
        frame_data: Array.from(imageData), // Convert to array for IPC
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`Failed to send ${type} frame to Tauri:`, error);
    }
  };

  // Send audio chunk to Tauri backend
  const sendAudioToTauri = async (audioData: Uint8Array) => {
    try {
      await invoke('stream_media_audio', {
        audio_data: Array.from(audioData), // Convert to array for IPC
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to send audio to Tauri:', error);
    }
  };

  // Process video streams and send frames
  const processVideoStream = (stream: MediaStream, type: 'camera' | 'screen') => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    const canvas = mediaCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on stream type
    if (type === 'camera') {
      canvas.width = 640;
      canvas.height = 480;
    } else {
      canvas.width = 1280;
      canvas.height = 720;
    }

    setStreamingState((prev) => ({ ...prev, [type]: true }));

    const captureFrame = () => {
      if (!streamingState[type] && mediaStreams[type]) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data as JPEG
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            await sendFrameToTauri(uint8Array, type);
          }
        },
        'image/jpeg',
        0.8
      );
    };

    // Capture frames at 10 FPS
    const interval = setInterval(captureFrame, 100);

    // Store interval for cleanup
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }
    streamIntervalRef.current = interval;
  };

  // Process audio stream
  const processAudioStream = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    setStreamingState((prev) => ({ ...prev, microphone: true }));

    processor.onaudioprocess = async (event) => {
      if (!streamingState.microphone) return;

      const inputData = event.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);

      // Convert float32 to int16
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const uint8Array = new Uint8Array(pcmData.buffer);
      await sendAudioToTauri(uint8Array);
    };

    // Store processor for cleanup
    (stream as any).audioProcessor = { audioContext, source, processor };
  };

  // Security-aware capability toggle handler
  const handleCapabilityToggle = async (capability: string) => {
    console.log(`[API_TOGGLE] Making API call for: ${capability}`);

    // Check if this is a dangerous capability that requires security warning
    const isDangerous = ['shell', 'browser'].includes(capability);
    const currentState = plugins[capability as keyof PluginToggleState];

    // If enabling a dangerous capability, show security warning first
    if (isDangerous && !currentState) {
      const securityConfig =
        SECURITY_CAPABILITIES[capability as keyof typeof SECURITY_CAPABILITIES];
      if (securityConfig) {
        setSecurityWarning({
          isVisible: true,
          capability,
          onConfirm: () => {
            setSecurityWarning({ isVisible: false, capability: '', onConfirm: () => {} });
            performCapabilityToggle(capability);
          },
        });
        return;
      }
    }

    // For non-dangerous capabilities or disabling, proceed directly
    await performCapabilityToggle(capability);
  };

  // Actual API toggle implementation (extracted for reuse)
  const performCapabilityToggle = async (capability: string) => {
    console.log(`[API_TOGGLE] Performing toggle for: ${capability}`);

    try {
      let success = false;
      let newState = false;

      if (isRunningInTauri) {
        // Use TauriService for all capability toggles
        switch (capability) {
          case 'autonomy':
            newState = !plugins.autonomy;
            await TauriService.toggleAutonomy(newState);
            success = true;
            break;

          case 'camera':
          case 'screen':
          case 'microphone':
          case 'shell':
          case 'browser':
            newState = !plugins[capability as keyof PluginToggleState];
            await TauriService.toggleCapability(capability);
            success = true;
            break;
        }
      } else {
        // Not in Tauri - shouldn't happen in production
        throw new Error('Not running in Tauri environment');
      }

      if (success) {
        // Update the local plugin state to reflect the change
        setPlugins((prev) => ({
          ...prev,
          [capability]: newState,
        }));
        console.log(`[API_TOGGLE] Successfully toggled ${capability} to ${newState}`);

        // Log security events for dangerous capabilities
        if (['shell', 'browser'].includes(capability)) {
          SecurityLogger.logSecurityEvent(
            newState ? ('access_granted' as any) : ('access_revoked' as any),
            `${capability} capability ${newState ? 'enabled' : 'disabled'}`,
            newState ? 'high' : 'medium'
          );
        }
      } else {
        console.error(`[API_TOGGLE] Failed to toggle ${capability} on server`);
        throw new Error(`Failed to toggle ${capability}`);
      }
    } catch (error) {
      console.error(`[API_TOGGLE] Exception toggling ${capability}:`, error);
      throw error; // Re-throw to let button component handle the error state
    }
  };

  // Helper function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could show a notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Helper function to update vision settings (removed - using TauriService now)

  // Agent reset functionality
  const resetAgent = async () => {
    setIsResetting(true);
    try {
      if (isRunningInTauri) {
        await TauriService.resetAgent();

        // Clear local state
        setOutput([
          {
            type: 'system',
            content: '◉ Agent reset successful - New agent instance started',
            timestamp: new Date(),
          },
        ]);
        setGoals([]);
        setTodos([]);
        setAgentMonologue([]);
        setKnowledgeFiles([]);

        // Reset plugins to default state
        setPlugins({
          autonomy: false,
          screen: false,
          camera: false,
          microphone: false,
          shell: false,
          browser: false,
        });

        setShowResetDialog(false);

        // Show success message
        setTimeout(() => {
          setOutput((prev) => [
            ...prev,
            {
              type: 'system',
              content: '◉ Fresh agent initialized. All previous data cleared.',
              timestamp: new Date(),
            },
          ]);
        }, 1000);
      } else {
        throw new Error('Not running in Tauri environment');
      }
    } catch (error) {
      console.error('Reset agent failed:', error);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsResetting(false);
    }
  };

  // Data fetching
  const fetchGoals = async () => {
    try {
      let data: any[] = [];

      if (isRunningInTauri) {
        // Use TauriService for IPC
        data = await TauriService.fetchGoals();
      } else {
        // Fallback - shouldn't happen in production
        data = [];
      }

      console.log('[GOALS] About to call setGoals with:', data?.length || 0, 'items');
      setGoals(data || []);
      console.log('[GOALS] Successfully fetched', data?.length || 0, 'goals');

      // Goals loaded successfully - no longer showing in chat
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      // Error logged to console but not shown in chat to avoid clutter
    }
  };

  const fetchTodos = async () => {
    try {
      let processedTodos: any[] = [];

      if (isRunningInTauri) {
        // Use TauriService for IPC
        processedTodos = await TauriService.fetchTodos();
      } else {
        // Fallback - shouldn't happen in production
        processedTodos = [];
      }

      console.log('[TODOS] About to call setTodos with:', processedTodos?.length || 0, 'items');
      setTodos(processedTodos || []);
      console.log('[TODOS] Successfully fetched', processedTodos?.length || 0, 'todos');

      // TODOs loaded successfully - no longer showing in chat
    } catch (error) {
      console.error('Failed to fetch todos:', error);
      // Error logged to console but not shown in chat to avoid clutter
    }
  };

  const fetchAutonomyStatus = async () => {
    console.log('[FETCH] fetchAutonomyStatus called');
    try {
      const result = await TauriService.fetchAutonomyStatus();
      // Handle new API response format
      const data = result;
      console.log(
        '[FETCH] fetchAutonomyStatus updating autonomy to:',
        data.enabled && data.running
      );
      setPlugins((prev) => ({
        ...prev,
        autonomy: data.enabled && data.running,
      }));
    } catch (error) {
      console.error('Failed to fetch autonomy status:', error);
    }
  };

  const fetchMonologue = async () => {
    try {
      // First, get the autonomy room ID from the autonomy status endpoint
      let autonomousRoomId = null;

      try {
        const autonomyResult = await TauriService.fetchAutonomyStatus();
        autonomousRoomId = autonomyResult.autonomousRoomId;
        console.log('[MONOLOGUE] Got autonomy room ID from status:', autonomousRoomId);
      } catch (error) {
        console.warn('[MONOLOGUE] Failed to fetch autonomy status:', error);
      }

      // If we don't have the autonomy room ID, try fallback approach
      if (!autonomousRoomId) {
        console.log('[MONOLOGUE] Autonomy room ID not found, trying fallback...');
        setAgentMonologue([
          { text: 'Autonomy system not available...', timestamp: Date.now(), isFromAgent: false },
        ]);
        return;
      }

      // Fetch ALL messages from the autonomous room
      const data = await TauriService.fetchMemoriesFromRoom(autonomousRoomId, 20);
      console.log(`[MONOLOGUE] Fetched ${data.length} memories from autonomy room`);

      // Show ALL messages from the autonomy room in chronological order
      const roomMessages = data
        .filter((memory: any) => memory.content?.text) // Only filter out empty messages
        .sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0)) // Chronological order
        .slice(-15) // Keep last 15 messages
        .map((memory: any) => ({
          text: memory.content.text,
          timestamp: memory.createdAt,
          entityId: memory.entityId,
          agentId: memory.agentId,
          isFromAgent: memory.entityId === memory.agentId,
        }));

      if (roomMessages.length === 0) {
        setAgentMonologue([
          { text: 'Agent is thinking...', timestamp: Date.now(), isFromAgent: true },
        ]);
      } else {
        setAgentMonologue(roomMessages);
      }
      console.log(`[MONOLOGUE] Displayed ${roomMessages.length} autonomy messages`);
    } catch (error) {
      console.error('[MONOLOGUE] Failed to fetch monologue:', error);
      setAgentMonologue([
        { text: 'Error loading monologue...', timestamp: Date.now(), isFromAgent: false },
      ]);
    }
  };

  const fetchVisionSettings = async () => {
    console.log('[FETCH] fetchVisionSettings called');
    try {
      const result = await TauriService.getVisionSettings();
      // Handle new API response format
      const data = result;
      console.log('[FETCH] Vision settings data:', data);

      // Only update vision-related settings, preserve others
      const visionUpdates = {
        camera: data.ENABLE_CAMERA === 'true' || data.VISION_CAMERA_ENABLED === 'true',
        screen: data.ENABLE_SCREEN_CAPTURE === 'true' || data.VISION_SCREEN_ENABLED === 'true',
        microphone: data.ENABLE_MICROPHONE === 'true' || data.VISION_MICROPHONE_ENABLED === 'true',
      };

      console.log('[FETCH] fetchVisionSettings updating vision settings to:', visionUpdates);

      setPlugins((prev) => ({
        ...prev,
        ...visionUpdates,
      }));
    } catch (error) {
      console.error('[VISION] Failed to fetch vision settings:', error);
    }
  };

  const fetchShellSettings = async () => {
    try {
      const result = await TauriService.getCapabilityStatus('shell');
      console.log('[SHELL] Fetched shell settings:', result);
      setPlugins((prev) => ({
        ...prev,
        shell: result.enabled,
      }));
    } catch (error) {
      console.error('[SHELL] Failed to fetch shell settings:', error);
    }
  };

  const fetchBrowserSettings = async () => {
    try {
      const result = await TauriService.getCapabilityStatus('browser');
      console.log('[BROWSER] Fetched browser settings:', result);
      setPlugins((prev) => ({
        ...prev,
        browser: result.enabled,
      }));
    } catch (error) {
      console.error('[BROWSER] Failed to fetch browser settings:', error);
    }
  };

  const fetchKnowledgeFiles = async () => {
    try {
      const result = await TauriService.fetchKnowledgeFiles();
      console.log('[KNOWLEDGE] Raw API response:', result);

      // Handle response format
      let documentsArray: any[] = [];
      if (Array.isArray(result)) {
        documentsArray = result;
      } else {
        console.warn('[KNOWLEDGE] Unexpected response format:', result);
        documentsArray = [];
      }

      console.log('[KNOWLEDGE] Processing', documentsArray.length, 'documents');
      const formattedFiles = documentsArray.map((doc: any) => ({
        id: doc.id,
        title: doc.title || doc.originalFilename || 'Untitled',
        type: doc.contentType || 'unknown',
        createdAt: doc.createdAt || new Date().toISOString(),
      }));
      setKnowledgeFiles(formattedFiles);
      console.log('[KNOWLEDGE] Successfully fetched', formattedFiles.length, 'knowledge files');
    } catch (error) {
      console.error('[KNOWLEDGE] Failed to fetch knowledge files:', error);
      setKnowledgeFiles([]);
    }
  };

  const fetchPluginConfigs = async () => {
    try {
      const result = await TauriService.fetchPluginConfigs();
      if (result) {
        const configs = result || {};
        setPluginConfigs(configs);

        // Initialize config values with current values
        const values: any = {};
        Object.entries(configs).forEach(([plugin, config]: [string, any]) => {
          values[plugin] = { ...config };
        });
        setConfigValues(values);
      }
    } catch (error) {
      console.error('Failed to fetch plugin configs:', error);
    }
  };

  const updatePluginConfig = async (plugin: string, key: string, value: any) => {
    try {
      // Validate configuration value
      const validation = InputValidator.validateConfigValue(key, value);
      if (!validation.valid) {
        SecurityLogger.logSecurityEvent(
          'invalid_input',
          `Configuration validation failed for ${plugin}.${key}: ${validation.error}`,
          'medium'
        );
        setOutput((prev) => [
          ...prev,
          {
            type: 'error',
            content: `Configuration validation failed: ${validation.error}`,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const sanitizedValue =
        validation.sanitizedValue !== undefined ? validation.sanitizedValue : value;

      // Update local state immediately for responsive UI
      setConfigValues((prev: any) => ({
        ...prev,
        [plugin]: {
          ...prev[plugin],
          [key]: sanitizedValue,
        },
      }));

      // Don't send empty values for API keys
      if ((key.includes('API_KEY') || key.includes('_KEY')) && !sanitizedValue.trim()) {
        console.log(`[CONFIG] Skipping empty API key update for ${key}`);
        return;
      }

      console.log(
        `[CONFIG] Updating ${plugin}.${key}:`,
        key.includes('KEY') ? '***REDACTED***' : sanitizedValue
      );

      // Send update to server with proper error handling
      await TauriService.updatePluginConfig(plugin, { [key]: sanitizedValue });
      console.log(`[CONFIG] Successfully updated ${plugin}.${key}`);

      // Show success message
      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: `◉ Updated ${plugin}.${key} configuration`,
          timestamp: new Date(),
        },
      ]);

      // If we're updating critical environment variables, refresh the config
      if (
        plugin === 'environment' &&
        ['MODEL_PROVIDER', 'LANGUAGE_MODEL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].includes(key)
      ) {
        // Small delay then refresh plugin configs to get updated status
        setTimeout(() => {
          fetchPluginConfigs();
        }, 1000);
      }
    } catch (error) {
      console.error('[CONFIG] Failed to update plugin config:', error);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: 'Failed to update config: Network error',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const validateConfiguration = async () => {
    try {
      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: '◉ Validating configuration...',
          timestamp: new Date(),
        },
      ]);

      const result = await TauriService.validateConfiguration();

      if (result) {
        setOutput((prev) => [
          ...prev,
          {
            type: 'system',
            content: 'Configuration Validation Complete',
            timestamp: new Date(),
          },
        ]);

        // Show overall status
        const statusIcon = result.valid ? '✅' : '❌';
        setOutput((prev) => [
          ...prev,
          {
            type: result.valid ? 'system' : 'error',
            content: `${statusIcon} Configuration Status: ${result.valid ? 'VALID' : 'INVALID'}`,
            timestamp: new Date(),
          },
        ]);

        // Show errors if any
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach((error) => {
            setOutput((prev) => [
              ...prev,
              {
                type: 'error',
                content: `❌ ${error}`,
                timestamp: new Date(),
              },
            ]);
          });
        }

        // Configuration validation complete
      } else {
        setOutput((prev) => [
          ...prev,
          {
            type: 'error',
            content: 'Validation failed: Unknown error',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('[CONFIG] Validation failed:', error);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: 'Configuration validation failed: Network error',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const testConfiguration = async () => {
    try {
      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: '◉ Testing configuration with actual LLM calls...',
          timestamp: new Date(),
        },
      ]);

      const result = await TauriService.testConfiguration();

      if (result) {
        setOutput((prev) => [
          ...prev,
          {
            type: 'system',
            content: 'Configuration Test Complete',
            timestamp: new Date(),
          },
        ]);

        // Show overall test status
        const statusIcon = result.success ? '✅' : '❌';
        setOutput((prev) => [
          ...prev,
          {
            type: result.success ? 'system' : 'error',
            content: `${statusIcon} Test Status: ${result.success ? 'SUCCESS' : 'FAILED'}`,
            timestamp: new Date(),
          },
        ]);

        // Show test message
        setOutput((prev) => [
          ...prev,
          {
            type: result.success ? 'system' : 'error',
            content: result.results || 'Test completed',
            timestamp: new Date(),
          },
        ]);
      } else {
        setOutput((prev) => [
          ...prev,
          {
            type: 'error',
            content: 'Configuration test failed: Unknown error',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('[CONFIG] Test failed:', error);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: 'Configuration test failed: Network error',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const deleteKnowledgeFile = async (fileId: string) => {
    try {
      await TauriService.deleteKnowledgeFile(fileId);

      // Refresh the file list
      await fetchKnowledgeFiles();
      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: '◉ Knowledge file deleted successfully',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Failed to delete knowledge file:', error);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: 'Failed to delete file: Network error',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file upload
    const validation = InputValidator.validateFileUpload(file);
    if (!validation.valid) {
      SecurityLogger.logSecurityEvent(
        'invalid_input',
        `File upload validation failed: ${validation.error}`,
        'medium'
      );
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: `File upload failed: ${validation.error}`,
          timestamp: new Date(),
        },
      ]);
      e.target.value = ''; // Reset the input
      return;
    }

    try {
      await TauriService.uploadKnowledgeFile(file);

      // Refresh the file list
      await fetchKnowledgeFiles();
      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: `◉ File "${file.name}" uploaded successfully`,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Failed to upload file:', error);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: 'Failed to upload file: Network error',
          timestamp: new Date(),
        },
      ]);
    }

    // Reset the input
    e.target.value = '';
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [output]);

  // Initial state fetching for capabilities
  const fetchAllCapabilityStates = async () => {
    console.log('[FETCH] Fetching all capability states...');
    try {
      // Fetch autonomy status
      await fetchAutonomyStatus();
      // Fetch vision settings
      await fetchVisionSettings();
      // Fetch shell settings
      await fetchShellSettings();
      // Fetch browser settings
      await fetchBrowserSettings();
    } catch (error) {
      console.error('[FETCH] Error fetching capability states:', error);
    }
  };

  // Periodic data refresh - simplified to avoid state conflicts
  useEffect(() => {
    const interval = setInterval(() => {
      fetchGoals();
      fetchTodos();
      fetchMonologue();
      fetchKnowledgeFiles();
      fetchPluginConfigs();
      // Don't auto-refresh capability states to avoid conflicts with user interactions
    }, 5000);

    // Initial fetch - fetch both data and initial plugin states
    fetchGoals();
    fetchTodos();
    fetchMonologue();
    fetchKnowledgeFiles();
    fetchPluginConfigs();
    fetchAllCapabilityStates(); // Fetch initial capability states

    return () => clearInterval(interval);
  }, []);

  // Media streaming state management
  useEffect(() => {
    const startMediaStreams = async () => {
      if (plugins.camera && !mediaStreams.camera) {
        const stream = await startCameraCapture();
        if (stream) {
          setMediaStreams((prev) => ({ ...prev, camera: stream }));
          processVideoStream(stream, 'camera');
        }
      }
      if (plugins.screen && !mediaStreams.screen) {
        const stream = await startScreenCapture();
        if (stream) {
          setMediaStreams((prev) => ({ ...prev, screen: stream }));
          processVideoStream(stream, 'screen');
        }
      }
      if (plugins.microphone && !mediaStreams.microphone) {
        const stream = await startMicrophoneCapture();
        if (stream) {
          setMediaStreams((prev) => ({ ...prev, microphone: stream }));
          processAudioStream(stream);
        }
      }
    };

    const stopMediaStreams = () => {
      if (mediaStreams.camera) {
        stopMediaStream('camera');
      }
      if (mediaStreams.screen) {
        stopMediaStream('screen');
      }
      if (mediaStreams.microphone) {
        stopMediaStream('microphone');
      }
    };

    startMediaStreams();

    return () => {
      stopMediaStreams();
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, [plugins.camera, plugins.screen, plugins.microphone, mediaStreams]);

  // Listen for agent screen frames from Tauri
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupAgentScreenListener = async () => {
      try {
        unsubscribe = await listen('agent-screen-frame', (event: any) => {
          const { frame_data, width, height, timestamp } = event.payload;

          // Get the agent screen canvas
          const canvas = document.getElementById('agent-screen-canvas') as HTMLCanvasElement;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;

          // Convert frame data back to Uint8Array
          const imageData = new Uint8Array(frame_data);

          // Create blob and display on canvas
          const blob = new Blob([imageData], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);

          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        });
      } catch (error) {
        console.error('Failed to setup agent screen listener:', error);
      }
    };

    if (isRunningInTauri) {
      setupAgentScreenListener();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isRunningInTauri]);

  // Security-aware chat handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !effectiveIsConnected) {
      return;
    }

    const trimmedInput = input.trim();

    // Validate and sanitize user input
    const validation = InputValidator.validateUserInput(trimmedInput);
    if (!validation.valid) {
      SecurityLogger.logSecurityEvent(
        'invalid_input',
        `User input validation failed: ${validation.error}`,
        'medium'
      );
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: `Input validation failed: ${validation.error}`,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const sanitizedInput = validation.sanitizedInput || trimmedInput;
    commandHistory.current.push(sanitizedInput);
    historyPosition.current = -1;

    setInput('');

    try {
      await sendMessage(sanitizedInput);
      // User message handled by TauriService immediately, server response via useEffect
    } catch (err) {
      console.error('Failed to send message:', err);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: 'Failed to send message. Please try again.',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyPosition.current < commandHistory.current.length - 1) {
        historyPosition.current++;
        setInput(
          commandHistory.current[commandHistory.current.length - 1 - historyPosition.current]
        );
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPosition.current > 0) {
        historyPosition.current--;
        setInput(
          commandHistory.current[commandHistory.current.length - 1 - historyPosition.current]
        );
      } else if (historyPosition.current === 0) {
        historyPosition.current = -1;
        setInput('');
      }
    }
  };

  const renderStatusPanel = () => {
    console.log(
      '[RENDER] Current tab:',
      currentTab,
      'Goals count:',
      goals.length,
      'Todos count:',
      todos.length
    );
    switch (currentTab) {
      case 'goals':
        return (
          <div className="status-content" data-testid="goals-content">
            <div className="status-header">
              <span>◎ GOALS [{goals.length}]</span>
            </div>
            <div className="scrollable-content">
              {goals.length === 0 ? (
                <div className="empty-state">No active goals</div>
              ) : (
                goals.map((goal) => (
                  <div key={goal.id} className="status-item">
                    <div className="status-indicator">{goal.isCompleted ? '✓' : '○'}</div>
                    <div className="status-text">
                      <div className="status-title">{goal.name}</div>
                      <div className="status-desc">{goal.description}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'todos':
        return (
          <div className="status-content" data-testid="todos-content">
            <div className="status-header">
              <span>◎ TASKS [{todos.length}]</span>
            </div>
            <div className="scrollable-content">
              {todos.length === 0 ? (
                <div className="empty-state">No pending tasks</div>
              ) : (
                todos.map((todo) => (
                  <div key={todo.id} className="status-item">
                    <div className="status-indicator">{todo.isCompleted ? '✓' : '○'}</div>
                    <div className="status-text">
                      <div className="status-title">{todo.name}</div>
                      <div className="status-desc">
                        Type: {todo.type} {todo.priority && `| P${todo.priority}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'monologue':
        return (
          <div className="status-content">
            <div className="status-header">
              <span>◎ THOUGHTS</span>
            </div>
            <div className="scrollable-content">
              {agentMonologue.length === 0 ? (
                <div className="empty-state">Agent is quiet...</div>
              ) : (
                agentMonologue.map((thought, index) => (
                  <div key={index} className="monologue-item" data-testid="monologue-content">
                    <div className="monologue-timestamp">
                      {thought.timestamp
                        ? new Date(thought.timestamp).toLocaleTimeString()
                        : '--:--:--'}
                    </div>
                    <div className="monologue-text">
                      <span
                        className={`monologue-sender ${thought.isFromAgent ? 'agent' : 'system'}`}
                      >
                        {thought.isFromAgent ? '🤖 ' : '⚙️ '}
                      </span>
                      {typeof thought === 'string' ? thought : thought.text}
                    </div>
                    <div className="monologue-type">
                      {thought.isFromAgent ? '[Agent]' : '[System]'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'files':
        return (
          <div className="status-content">
            <div className="status-header">
              <span>◎ KNOWLEDGE BASE [{knowledgeFiles.length}]</span>
            </div>

            <div className="scrollable-content">
              {knowledgeFiles.length === 0 ? (
                <div className="empty-state">No knowledge files loaded</div>
              ) : (
                knowledgeFiles.map((file) => (
                  <div key={file.id} className="file-item">
                    <span className="file-icon">📄</span>
                    <div className="file-info">
                      <span className="file-name">{file.title}</span>
                      <span className="file-meta">
                        {file.type} • {new Date(file.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      className="file-action"
                      onClick={() => deleteKnowledgeFile(file.id)}
                      title="Delete file"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}

              <div className="file-upload">
                <input
                  type="file"
                  id="file-upload"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.pdf,.doc,.docx,.html,.json,.csv"
                />
                <label htmlFor="file-upload" className="upload-btn">
                  + Upload File
                </label>
              </div>
            </div>
          </div>
        );

      case 'config':
        return (
          <div className="status-content">
            <div className="status-header">
              <span>◎ CONFIGURATION</span>
            </div>
            <div className="scrollable-content">
              {/* Model Provider Configuration */}
              <div className="config-section">
                <div className="config-title">Model Provider Settings</div>
                <div className="config-item">
                  <label>Provider</label>
                  <select
                    className="config-select"
                    value={configValues.environment?.MODEL_PROVIDER || 'openai'}
                    onChange={(e) => {
                      updatePluginConfig('environment', 'MODEL_PROVIDER', e.target.value);
                      // Clear model selection when provider changes
                      updatePluginConfig('environment', 'LANGUAGE_MODEL', '');
                    }}
                    data-testid="model-provider-select"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>

                {/* OpenAI Configuration */}
                {(configValues.environment?.MODEL_PROVIDER === 'openai' ||
                  !configValues.environment?.MODEL_PROVIDER) && (
                  <>
                    <div className="config-item">
                      <label>OpenAI API Key</label>
                      <input
                        type="password"
                        className="config-input"
                        value={configValues.environment?.OPENAI_API_KEY || ''}
                        placeholder={
                          pluginConfigs.environment?.OPENAI_API_KEY === '***SET***'
                            ? 'Currently Set'
                            : 'Enter OpenAI API Key'
                        }
                        onChange={(e) =>
                          updatePluginConfig('environment', 'OPENAI_API_KEY', e.target.value)
                        }
                        data-testid="openai-api-key-input"
                      />
                    </div>
                    <div className="config-item">
                      <label>Model</label>
                      <select
                        className="config-select"
                        value={configValues.environment?.LANGUAGE_MODEL || 'gpt-4o-mini'}
                        onChange={(e) =>
                          updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                        }
                        data-testid="openai-model-select"
                      >
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Anthropic Configuration */}
                {configValues.environment?.MODEL_PROVIDER === 'anthropic' && (
                  <>
                    <div className="config-item">
                      <label>Anthropic API Key</label>
                      <input
                        type="password"
                        className="config-input"
                        value={configValues.environment?.ANTHROPIC_API_KEY || ''}
                        placeholder={
                          pluginConfigs.environment?.ANTHROPIC_API_KEY === '***SET***'
                            ? 'Currently Set'
                            : 'Enter Anthropic API Key'
                        }
                        onChange={(e) =>
                          updatePluginConfig('environment', 'ANTHROPIC_API_KEY', e.target.value)
                        }
                        data-testid="anthropic-api-key-input"
                      />
                    </div>
                    <div className="config-item">
                      <label>Model</label>
                      <select
                        className="config-select"
                        value={
                          configValues.environment?.LANGUAGE_MODEL || 'claude-3-5-sonnet-20241022'
                        }
                        onChange={(e) =>
                          updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                        }
                        data-testid="anthropic-model-select"
                      >
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                        <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Ollama Configuration */}
                {configValues.environment?.MODEL_PROVIDER === 'ollama' && (
                  <>
                    <div className="config-item">
                      <label>Ollama Server URL</label>
                      <input
                        type="text"
                        className="config-input"
                        value={
                          configValues.environment?.OLLAMA_SERVER_URL || 'http://localhost:11434'
                        }
                        placeholder="http://localhost:11434"
                        onChange={(e) =>
                          updatePluginConfig('environment', 'OLLAMA_SERVER_URL', e.target.value)
                        }
                        data-testid="ollama-server-url-input"
                      />
                    </div>
                    <div className="config-item">
                      <label>Model</label>
                      <input
                        type="text"
                        className="config-input"
                        value={configValues.environment?.LANGUAGE_MODEL || 'llama3.2:3b'}
                        placeholder="llama3.2:3b"
                        onChange={(e) =>
                          updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                        }
                        data-testid="ollama-model-input"
                      />
                      <small style={{ color: '#888', fontSize: '10px', marginTop: '4px' }}>
                        Enter the model name as it appears in your Ollama installation
                      </small>
                    </div>
                  </>
                )}

                <div className="config-item">
                  <label>Text Embedding Model</label>
                  <input
                    type="text"
                    className="config-input"
                    value={
                      configValues.environment?.TEXT_EMBEDDING_MODEL || 'text-embedding-3-small'
                    }
                    placeholder="text-embedding-3-small"
                    onChange={(e) =>
                      updatePluginConfig('environment', 'TEXT_EMBEDDING_MODEL', e.target.value)
                    }
                    data-testid="embedding-model-input"
                  />
                </div>
              </div>

              {/* Plugin-specific configurations */}
              {Object.entries(pluginConfigs)
                .filter(([key]) => key !== 'environment')
                .map(([plugin, config]: [string, any]) => (
                  <div key={plugin} className="config-section">
                    <div className="config-title">
                      {plugin.charAt(0).toUpperCase() + plugin.slice(1)} Plugin
                    </div>
                    {Object.entries(config || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="config-item">
                        <label>{key}</label>
                        <input
                          className="config-input"
                          value={configValues[plugin]?.[key] || ''}
                          placeholder={String(value)}
                          onChange={(e) => updatePluginConfig(plugin, key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ))}

              {/* Configuration Testing Section */}
              <div className="config-section">
                <div className="config-title">🔍 Configuration Validation</div>
                <div className="config-actions">
                  <button
                    className="config-btn validate-btn"
                    onClick={validateConfiguration}
                    data-testid="validate-config-button"
                  >
                    🔍 VALIDATE CONFIG
                  </button>
                  <button
                    className="config-btn test-btn"
                    onClick={testConfiguration}
                    data-testid="test-config-button"
                  >
                    🧪 TEST CONFIG
                  </button>
                </div>
                <div className="config-help">
                  <small style={{ color: '#888', fontSize: '10px', lineHeight: '1.3' }}>
                    Validate: Check API connectivity and configuration
                    <br />
                    Test: Run actual LLM calls to verify functionality
                  </small>
                </div>
              </div>

              <div className="config-section danger-section">
                <div className="config-title">⚠️ Danger Zone</div>
                <button
                  className="reset-btn"
                  onClick={() => setShowResetDialog(true)}
                  disabled={isResetting}
                >
                  {isResetting ? 'RESETTING...' : 'RESET AGENT'}
                </button>
                <div className="config-warning">
                  This will permanently delete all agent memories, goals, todos, and restart with a
                  fresh instance.
                </div>
              </div>
            </div>
          </div>
        );

      case 'logs':
        return (
          <div className="status-content logs-tab-content" data-testid="logs-content">
            <div className="logs-subtabs">
              <button
                className={`logs-subtab ${logsSubTab === 'agent' ? 'active' : ''}`}
                onClick={() => setLogsSubTab('agent')}
              >
                Agent Logs
              </button>
              <button
                className={`logs-subtab ${logsSubTab === 'container' ? 'active' : ''}`}
                onClick={() => setLogsSubTab('container')}
              >
                Container Logs
              </button>
            </div>
            <div className="logs-content">
              {logsSubTab === 'agent' ? <AgentLogs /> : <ContainerLogs />}
            </div>
          </div>
        );

      case 'agent-screen':
        return (
          <div className="status-content agent-screen-content" data-testid="agent-screen-content">
            <div className="status-header">
              <span>◎ AGENT VIRTUAL SCREEN</span>
              <button
                className={`agent-screen-toggle ${agentScreenActive ? 'active' : ''}`}
                onClick={async () => {
                  try {
                    if (agentScreenActive) {
                      await invoke('stop_agent_screen_capture');
                      setAgentScreenActive(false);
                    } else {
                      await invoke('start_agent_screen_capture');
                      setAgentScreenActive(true);
                    }
                  } catch (error) {
                    console.error('Failed to toggle agent screen capture:', error);
                  }
                }}
                style={{
                  marginLeft: 'auto',
                  padding: '4px 12px',
                  backgroundColor: agentScreenActive ? '#dc2626' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {agentScreenActive ? 'Stop Capture' : 'Start Capture'}
              </button>
            </div>
            <div className="agent-screen-container">
              <canvas
                id="agent-screen-canvas"
                className="agent-screen-canvas"
                style={{
                  width: '100%',
                  height: 'auto',
                  backgroundColor: '#000',
                  imageRendering: 'pixelated',
                }}
              />
              <div className="agent-screen-info">
                {agentScreenActive && (
                  <span className="stream-indicator">🔴 Agent Screen Active</span>
                )}
                {streamingState.camera && (
                  <span className="stream-indicator">📹 Camera Active</span>
                )}
                {streamingState.screen && (
                  <span className="stream-indicator">🖥️ Screen Sharing</span>
                )}
                {streamingState.microphone && (
                  <span className="stream-indicator">🎤 Mic Active</span>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="terminal-container" data-testid="game-interface">
      <style>{`
        .logs-tab-content {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .logs-subtabs {
          display: flex;
          gap: 8px;
          padding: 8px;
          border-bottom: 1px solid rgba(0, 255, 0, 0.2);
          background: rgba(0, 0, 0, 0.6);
        }
        
        .logs-subtab {
          padding: 6px 16px;
          background: rgba(0, 50, 0, 0.4);
          border: 1px solid rgba(0, 255, 0, 0.3);
          color: #00ff00;
          font-size: 12px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        
        .logs-subtab:hover {
          background: rgba(0, 100, 0, 0.4);
          border-color: rgba(0, 255, 0, 0.5);
        }
        
        .logs-subtab.active {
          background: rgba(0, 150, 0, 0.6);
          border-color: #00ff00;
          box-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
        }
        
        .logs-content {
          flex: 1;
          overflow: hidden;
        }
      `}</style>
      {/* Connection Status */}
      <div
        className={`connection-status ${effectiveIsConnected ? 'connected' : 'disconnected'}`}
        data-testid="connection-status"
      >
        {effectiveIsConnected ? (
          '◉ ONLINE'
        ) : (
          <>
            ◯ OFFLINE
            {!isConnected && ' (No Connection)'}
            {isConnected && !gameApiReady && ' (Game API Not Ready)'}
            {startupError && (
              <span className="connection-error" title={startupError}>
                {' '}
                ⚠️
              </span>
            )}
          </>
        )}
        <span className="autonomy-status" data-testid="autonomy-status">
          {plugins.autonomy ? 'Active' : 'Paused'}
        </span>
      </div>

      {/* Main Layout */}
      <div className="terminal-layout">
        {/* Left Panel - Chat */}
        <div className="panel panel-left">
          <div className="panel-header">◆ ADMIN TERMINAL</div>

          <div
            className="panel-content chat-content"
            ref={chatContainerRef}
            data-testid="chat-messages"
            role="log"
          >
            {output.map((line, index) => (
              <div
                key={index}
                className={`chat-line chat-${line.type}`}
                data-testid={
                  line.type === 'user'
                    ? 'user-message'
                    : line.type === 'agent'
                      ? 'agent-message'
                      : 'system-message'
                }
              >
                <span className="chat-timestamp" data-testid="message-timestamp">
                  {line.timestamp.toLocaleTimeString()}
                </span>
                <span className="chat-prefix">
                  {line.type === 'user'
                    ? '[USER]'
                    : line.type === 'agent'
                      ? '[AGENT]'
                      : line.type === 'system'
                        ? '[SYS]'
                        : '[ERR]'}
                </span>
                <span className="chat-content">{line.content}</span>
                <div
                  className="message-actions"
                  data-testid="message-actions"
                  style={{ display: 'none' }}
                >
                  <button
                    className="message-action"
                    data-testid="copy-message-button"
                    onClick={() => copyToClipboard(line.content)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
            {!tauriCheckComplete && !error && (
              <div className="chat-line chat-system">
                <span className="chat-prefix">[SYS]</span>
                <span className="chat-content">Checking Tauri environment...</span>
              </div>
            )}
            {error && (
              <div className="chat-line chat-error">
                <span className="chat-prefix">[ERR]</span>
                <span className="chat-content">Connection error: {error}</span>
              </div>
            )}
            {isConnected && !gameApiReady && (
              <div className="chat-line chat-error">
                <span className="chat-prefix">[ERR]</span>
                <span className="chat-content">
                  Game API is not ready. Chat is disabled.{' '}
                  {startupError || 'Waiting for Game API plugin to initialize...'}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="chat-input-form">
            <div className="input-line">
              <span className="input-prompt">{'>'}</span>
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  const newValue = e.target.value;
                  // Keep original for typing experience, will sanitize on submit
                  setInput(newValue);
                }}
                onKeyDown={handleKeyDown}
                className="chat-input"
                placeholder={
                  !effectiveIsConnected
                    ? isConnected
                      ? 'Game API not ready...'
                      : 'Not connected...'
                    : !modelsReady
                    ? 'AI models loading...'
                    : ''
                }
                disabled={!effectiveIsConnected || !modelsReady}
                data-testid="message-input"
                aria-label="Enter command or message"
              />
              <button
                type="submit"
                className="send-btn"
                disabled={!input.trim() || !effectiveIsConnected}
                data-testid="send-button"
              >
                SEND
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel - Status */}
        <div className="panel panel-right">
          {/* Plugin Controls - Ultra Simple */}
          <div className="controls-section">
            <div className="controls-header">◆ CAPABILITIES</div>
            <UltraSimpleButtons states={plugins} onToggle={handleCapabilityToggle} />
          </div>

          {/* Status Tabs */}
          <div className="status-tabs">
            {(
              ['goals', 'todos', 'monologue', 'files', 'config', 'logs', 'agent-screen'] as const
            ).map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${currentTab === tab ? 'active' : ''}`}
                onClick={() => setCurrentTab(tab)}
                data-testid={`${tab}-tab`}
              >
                {tab === 'agent-screen' ? 'AGENT VIEW' : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Status Panel Content */}
          <div data-testid={`${currentTab}-content`}>{renderStatusPanel()}</div>
        </div>
      </div>

      {/* Reset Agent Confirmation Dialog */}
      {showResetDialog && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <span className="modal-title">⚠️ CONFIRM AGENT RESET</span>
            </div>
            <div className="modal-content">
              <div className="warning-message">
                <p>This action will permanently:</p>
                <ul>
                  <li>Kill your current agent instance</li>
                  <li>Delete all memories and conversations</li>
                  <li>Clear all goals and todos</li>
                  <li>Reset knowledge base to default state</li>
                  <li>Start a completely fresh agent</li>
                </ul>
                <p className="warning-emphasis">
                  <strong>This cannot be undone!</strong>
                </p>
              </div>
              <div className="confirmation-input">
                <p>Type "RESET AGENT" to confirm:</p>
                <input
                  type="text"
                  className="confirm-input"
                  id="confirmResetInput"
                  placeholder="Type here to confirm..."
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowResetDialog(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                className="confirm-reset-btn"
                onClick={() => {
                  const input = document.getElementById('confirmResetInput') as HTMLInputElement;
                  if (input?.value === 'RESET AGENT') {
                    resetAgent();
                  } else {
                    // Show error in console instead of alert
                    console.error(
                      'Reset confirmation failed: Please type "RESET AGENT" exactly to confirm.'
                    );
                    // Clear and focus the input for retry
                    input.value = '';
                    input.focus();
                    input.placeholder = 'Please type "RESET AGENT" exactly';
                  }
                }}
                disabled={isResetting}
              >
                {isResetting ? 'RESETTING...' : 'CONFIRM RESET'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Warning Modal */}
      <SecurityWarning
        capability={
          SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]
            ?.capability || ''
        }
        riskLevel={
          SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]
            ?.riskLevel || 'medium'
        }
        description={
          SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]
            ?.description || ''
        }
        risks={
          SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]
            ?.risks || []
        }
        onConfirm={securityWarning.onConfirm}
        onCancel={() =>
          setSecurityWarning({ isVisible: false, capability: '', onConfirm: () => {} })
        }
        isVisible={securityWarning.isVisible}
      />

      {/* Hidden canvas for media processing */}
      <canvas ref={mediaCanvasRef} style={{ display: 'none' }} width={1280} height={720} />
    </div>
  );
};
