import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useElizaClient } from '../hooks/useElizaClient';
import { ElizaMessage } from '../services/ElizaService';
import { v4 as uuidv4 } from 'uuid';
import { SecurityWarning, SECURITY_CAPABILITIES } from './SecurityWarning';
import { InputValidator, XSSProtection, SecurityLogger } from '../utils/SecurityUtils';

// API configuration - use environment variable or default
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || `http://localhost:${import.meta.env.VITE_BACKEND_PORT || '7777'}`;

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
    speakers: boolean;
    shell: boolean;
    browser: boolean;
}

interface SecurityWarningState {
    isVisible: boolean;
    capability: string;
    onConfirm: () => void;
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
        speakers: false,
        shell: false,
        browser: false
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
        opacity: isToggling ? 0.7 : 1
    });

    const handleClick = async (capability: string) => {
        if (isTogglingState[capability as keyof typeof isTogglingState]) return; // Prevent double clicks
        
        setIsTogglingState(prev => ({ ...prev, [capability]: true }));
        try {
            await onToggle(capability);
        } catch (error) {
            console.error(`Failed to toggle ${capability}:`, error);
        } finally {
            setIsTogglingState(prev => ({ ...prev, [capability]: false }));
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
                style={buttonStyle(states.speakers, isTogglingState.speakers)}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('CLICKED: speakers');
                    handleClick('speakers');
                }}
                data-testid="speakers-toggle"
            >
                <span data-testid="speakers-toggle-status">{states.speakers ? '●' : '○'}</span>
                <span>{isTogglingState.speakers ? '...' : 'SPK'}</span>
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

interface AgentStatus {
    isOnline: boolean;
    lastActivity: Date;
    tokenUsage: number;
    cost: number;
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
    
    // Plugin toggles
    const [plugins, setPlugins] = useState<PluginToggleState>({
        autonomy: false, // Default to off since autonomy service is temporarily disabled
        camera: false,
        screen: false,
        microphone: false,
        speakers: false,
        shell: false,
        browser: false,
    });

    // Data state
    const [goals, setGoals] = useState<Goal[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [agentMonologue, setAgentMonologue] = useState<string[]>([]);
    const [agentStatus, setAgentStatus] = useState<AgentStatus>({
        isOnline: true,
        lastActivity: new Date(),
        tokenUsage: 0,
        cost: 0
    });

    // UI state
    const [currentTab, setCurrentTab] = useState<'goals' | 'todos' | 'monologue' | 'files' | 'config'>('goals');
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [knowledgeFiles, setKnowledgeFiles] = useState<Array<{id: string, title: string, type: string, createdAt: string}>>([]);
    const [isResetting, setIsResetting] = useState(false);
    const [pluginConfigs, setPluginConfigs] = useState<any>({});
    const [configValues, setConfigValues] = useState<any>({});
    
    // Security state
    const [securityWarning, setSecurityWarning] = useState<SecurityWarningState>({
        isVisible: false,
        capability: '',
        onConfirm: () => {}
    });

    const [userId] = useState(() => {
        const stored = localStorage.getItem('terminal-user-id');
        if (stored) return stored;
        const newId = uuidv4();
        localStorage.setItem('terminal-user-id', newId);
        return newId;
    });

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const historyPosition = useRef<number>(-1);
    const commandHistory = useRef<string[]>([]);

    // Eliza client integration
    const handleMessage = useCallback((message: ElizaMessage) => {
        if (message.authorId !== userId) {
            setOutput((prev) => [
                ...prev,
                {
                    type: 'agent',
                    content: message.content,
                    timestamp: message.timestamp,
                },
            ]);
            
            // Add to agent monologue if it's from the autonomous room or contains thinking patterns
            if (message.metadata?.channelId === 'autonomous' || // From autonomy plugin's dedicated room
                message.content.includes('thinking:') || 
                message.content.includes('goal:') || 
                message.content.includes('planning:') ||
                message.content.includes('What should I do next?')) {
                setAgentMonologue(prev => [...prev.slice(-9), message.content].slice(-10));
            }
        }
    }, [userId]);

    const handleConnectionChange = useCallback((connected: boolean) => {
        setAgentStatus(prev => ({ ...prev, isOnline: connected }));
    }, []);

    const { isConnected, sendMessage, error } = useElizaClient({
        baseUrl: API_BASE_URL,
        userId,
        onMessage: handleMessage,
        onConnectionChange: handleConnectionChange,
    });

    // Security-aware capability toggle handler
    const handleCapabilityToggle = async (capability: string) => {
        console.log(`[API_TOGGLE] Making API call for: ${capability}`);
        
        // Check if this is a dangerous capability that requires security warning
        const isDangerous = ['shell', 'browser'].includes(capability);
        const currentState = plugins[capability as keyof PluginToggleState];
        
        // If enabling a dangerous capability, show security warning first
        if (isDangerous && !currentState) {
            const securityConfig = SECURITY_CAPABILITIES[capability as keyof typeof SECURITY_CAPABILITIES];
            if (securityConfig) {
                setSecurityWarning({
                    isVisible: true,
                    capability,
                    onConfirm: () => {
                        setSecurityWarning({ isVisible: false, capability: '', onConfirm: () => {} });
                        performCapabilityToggle(capability);
                    }
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
            
            switch (capability) {
                case 'autonomy':
                    // For autonomy, we need to toggle based on current state
                    const currentAutonomyState = plugins.autonomy;
                    const autonomyEndpoint = currentAutonomyState ? 'disable' : 'enable';
                    const response = await fetch(`${API_BASE_URL}/autonomy/${autonomyEndpoint}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (response.ok) {
                        const result = await response.json();
                        newState = result.success ? result.data.enabled : false;
                        success = true;
                    }
                    console.log(`[API_TOGGLE] Autonomy API call result: ${success}, new state: ${newState}`);
                    break;
                    
                case 'camera':
                    newState = !plugins.camera;
                    success = await updateVisionSetting('ENABLE_CAMERA', newState);
                    console.log(`[API_TOGGLE] Camera API call result: ${success}, new state: ${newState}`);
                    break;
                    
                case 'screen':
                    newState = !plugins.screen;
                    success = await updateVisionSetting('ENABLE_SCREEN_CAPTURE', newState);
                    console.log(`[API_TOGGLE] Screen API call result: ${success}, new state: ${newState}`);
                    break;
                    
                case 'microphone':
                    newState = !plugins.microphone;
                    success = await updateVisionSetting('ENABLE_MICROPHONE', newState);
                    console.log(`[API_TOGGLE] Microphone API call result: ${success}, new state: ${newState}`);
                    break;
                    
                case 'speakers':
                    newState = !plugins.speakers;
                    success = await updateVisionSetting('ENABLE_SPEAKER', newState);
                    console.log(`[API_TOGGLE] Speakers API call result: ${success}, new state: ${newState}`);
                    break;
                    
                case 'shell':
                    const shellResponse = await fetch(`${API_BASE_URL}/api/agents/default/capabilities/shell/toggle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (shellResponse.ok) {
                        const result = await shellResponse.json();
                        newState = result.success ? result.data.enabled : false;
                        success = true;
                    }
                    console.log(`[API_TOGGLE] Shell API call result: ${success}, new state: ${newState}`);
                    break;
                    
                case 'browser':
                    const browserResponse = await fetch(`${API_BASE_URL}/api/agents/default/capabilities/browser/toggle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (browserResponse.ok) {
                        const result = await browserResponse.json();
                        newState = result.success ? result.data.enabled : false;
                        success = true;
                    }
                    console.log(`[API_TOGGLE] Browser API call result: ${success}, new state: ${newState}`);
                    break;
            }

            if (success) {
                // Update the local plugin state to reflect the API call result
                setPlugins(prev => ({
                    ...prev,
                    [capability]: newState
                }));
                console.log(`[API_TOGGLE] Successfully toggled ${capability} to ${newState}`);
                
                // Log security events for dangerous capabilities
                if (['shell', 'browser'].includes(capability)) {
                    SecurityLogger.logSecurityEvent(
                        newState ? 'access_granted' as any : 'access_revoked' as any,
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

    // Helper function to update vision settings
    const updateVisionSetting = async (settingKey: string, enabled: boolean): Promise<boolean> => {
        try {
            // Update both the main setting and the vision-specific setting
            const settingsToUpdate = [
                { key: settingKey, value: enabled.toString() },
                { key: `VISION_${settingKey.replace('ENABLE_', '')}_ENABLED`, value: enabled.toString() }
            ];
            
            const updatePromises = settingsToUpdate.map(setting =>
                fetch(`${API_BASE_URL}/api/agents/default/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(setting)
                })
            );
            
            const responses = await Promise.all(updatePromises);
            const allSuccessful = responses.every(response => response.ok);
            
            if (allSuccessful) {
                // Trigger vision service refresh
                await fetch(`${API_BASE_URL}/api/agents/default/vision/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`Failed to update ${settingKey}:`, error);
            return false;
        }
    };

    // Agent reset functionality
    const resetAgent = async () => {
        setIsResetting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/reset-agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                // Clear local state
                setOutput([
                    {
                        type: 'system',
                        content: '◉ Agent reset successful - New agent instance started',
                        timestamp: new Date(),
                    }
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
                    speakers: false,
                    shell: false,
                    browser: false,
                });
                
                setShowResetDialog(false);
                
                // Show success message
                setTimeout(() => {
                    setOutput(prev => [...prev, {
                        type: 'system',
                        content: '◉ Fresh agent initialized. All previous data cleared.',
                        timestamp: new Date(),
                    }]);
                }, 1000);
                
            } else {
                const error = await response.json();
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Reset failed: ${error.details || error.error}`,
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('Reset agent failed:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: 'Reset failed: Network error',
                timestamp: new Date(),
            }]);
        } finally {
            setIsResetting(false);
        }
    };

    // Data fetching
    const fetchGoals = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/goals`);
            if (response.ok) {
                const result = await response.json();
                // Handle both API response formats:
                // - Standard goals plugin returns array directly
                // - Game API plugin returns { success: true, data: [] }
                const data = result.success ? result.data : (Array.isArray(result) ? result : []);
                console.log('[GOALS] About to call setGoals with:', data?.length || 0, 'items');
                setGoals(data || []);
                console.log('[GOALS] Successfully fetched', data?.length || 0, 'goals');
                console.log('[GOALS] Raw API response:', JSON.stringify(result, null, 2));
                console.log('[GOALS] Processed goals:', data);
                
                // Add success message to terminal output
                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `✅ Goals loaded: ${data?.length || 0} goals found`,
                    timestamp: new Date(),
                }]);
            } else {
                console.warn('[GOALS] API returned error status:', response.status);
                if (response.status !== 404) { // Don't show errors for missing endpoints
                    setOutput(prev => [...prev, {
                        type: 'error',
                        content: `Failed to fetch goals: ${response.status} ${response.statusText}`,
                        timestamp: new Date(),
                    }]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch goals:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: `Network error fetching goals: ${error.message}`,
                timestamp: new Date(),
            }]);
        }
    };

    const fetchTodos = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/todos`);
            if (response.ok) {
                const result = await response.json();
                // Handle both API response formats:
                // - Standard todos plugin returns array directly (structured by world/room)
                // - Game API plugin returns { success: true, data: [] }
                const data = result.success ? result.data : (Array.isArray(result) ? result : []);
                
                // Flatten the todos if they're in nested structure
                let processedTodos = [];
                if (Array.isArray(data) && data.length > 0 && data[0]?.rooms) {
                    processedTodos = data.flatMap((world: any) => 
                        world.rooms.flatMap((room: any) => room.tasks || [])
                    );
                } else if (Array.isArray(data)) {
                    processedTodos = data;
                } else {
                    processedTodos = [];
                }
                console.log('[TODOS] About to call setTodos with:', processedTodos?.length || 0, 'items');
                setTodos(processedTodos || []);
                console.log('[TODOS] Successfully fetched', processedTodos?.length || 0, 'todos');
                console.log('[TODOS] Raw API response:', JSON.stringify(result, null, 2));
                console.log('[TODOS] Processed todos:', processedTodos);
                
                // Add success message to terminal output
                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `✅ TODOs loaded: ${processedTodos?.length || 0} tasks found`,
                    timestamp: new Date(),
                }]);
            } else {
                console.warn('[TODOS] API returned error status:', response.status);
                if (response.status !== 404) { // Don't show errors for missing endpoints
                    setOutput(prev => [...prev, {
                        type: 'error',
                        content: `Failed to fetch todos: ${response.status} ${response.statusText}`,
                        timestamp: new Date(),
                    }]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch todos:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: `Network error fetching todos: ${error.message}`,
                timestamp: new Date(),
            }]);
        }
    };

    const fetchAutonomyStatus = async () => {
        console.log('[FETCH] fetchAutonomyStatus called');
        try {
            const response = await fetch(`${API_BASE_URL}/autonomy/status`);
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                console.log('[FETCH] fetchAutonomyStatus updating autonomy to:', data.enabled && data.running);
                setPlugins(prev => ({
                    ...prev,
                    autonomy: data.enabled && data.running
                }));
            }
        } catch (error) {
            console.error('Failed to fetch autonomy status:', error);
        }
    };

    const fetchMonologue = async () => {
        try {
            // First, get the autonomy room ID from the autonomy status endpoint
            let autonomousRoomId = null;
            
            try {
                const autonomyStatusResponse = await fetch(`${API_BASE_URL}/autonomy/status`);
                if (autonomyStatusResponse.ok) {
                    const autonomyResult = await autonomyStatusResponse.json();
                    autonomousRoomId = autonomyResult.autonomousRoomId;
                    console.log('[MONOLOGUE] Got autonomy room ID from status:', autonomousRoomId);
                } else {
                    console.warn('[MONOLOGUE] Autonomy status endpoint not available:', autonomyStatusResponse.status);
                }
            } catch (error) {
                console.warn('[MONOLOGUE] Failed to fetch autonomy status:', error);
            }
            
            // If we don't have the autonomy room ID, try fallback approach
            if (!autonomousRoomId) {
                console.log('[MONOLOGUE] Autonomy room ID not found, trying fallback...');
                setAgentMonologue([{ text: 'Autonomy system not available...', timestamp: Date.now(), isFromAgent: false }]);
                return;
            }
            
            // Fetch ALL messages from the autonomous room
            const response = await fetch(`${API_BASE_URL}/api/memories?roomId=${autonomousRoomId}&count=20`);
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : [];
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
                        isFromAgent: memory.entityId === memory.agentId
                    }));
                
                if (roomMessages.length === 0) {
                    setAgentMonologue([{ text: 'Agent is thinking...', timestamp: Date.now(), isFromAgent: true }]);
                } else {
                    setAgentMonologue(roomMessages);
                }
                console.log(`[MONOLOGUE] Displayed ${roomMessages.length} autonomy messages`);
            } else {
                console.error('[MONOLOGUE] Failed to fetch memories:', response.status, response.statusText);
                setAgentMonologue([{ text: 'Unable to load agent thoughts...', timestamp: Date.now(), isFromAgent: false }]);
            }
        } catch (error) {
            console.error('[MONOLOGUE] Failed to fetch monologue:', error);
            setAgentMonologue([{ text: 'Error loading monologue...', timestamp: Date.now(), isFromAgent: false }]);
        }
    };

    const fetchVisionSettings = async () => {
        console.log('[FETCH] fetchVisionSettings called');
        try {
            const response = await fetch(`${API_BASE_URL}/api/agents/default/settings/vision`);
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                console.log('[FETCH] Vision settings data:', data);
                
                // Only update vision-related settings, preserve others
                const visionUpdates = {
                    camera: data.ENABLE_CAMERA === 'true' || data.VISION_CAMERA_ENABLED === 'true',
                    screen: data.ENABLE_SCREEN_CAPTURE === 'true' || data.VISION_SCREEN_ENABLED === 'true',
                    microphone: data.ENABLE_MICROPHONE === 'true' || data.VISION_MICROPHONE_ENABLED === 'true',
                    speakers: data.ENABLE_SPEAKER === 'true' || data.VISION_SPEAKER_ENABLED === 'true'
                };
                
                console.log('[FETCH] fetchVisionSettings updating vision settings to:', visionUpdates);
                
                setPlugins(prev => ({
                    ...prev,
                    ...visionUpdates
                }));
            } else {
                console.warn('[VISION] Failed to fetch vision settings:', response.status);
            }
        } catch (error) {
            console.error('[VISION] Failed to fetch vision settings:', error);
        }
    };

    const fetchShellSettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/agents/default/capabilities/shell`);
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                console.log('[SHELL] Fetched shell settings:', data);
                setPlugins(prev => ({
                    ...prev,
                    shell: data.enabled
                }));
            } else {
                console.warn('[SHELL] Failed to fetch shell settings:', response.status);
            }
        } catch (error) {
            console.error('[SHELL] Failed to fetch shell settings:', error);
        }
    };

    const fetchBrowserSettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/agents/default/capabilities/browser`);
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                console.log('[BROWSER] Fetched browser settings:', data);
                setPlugins(prev => ({
                    ...prev,
                    browser: data.enabled
                }));
            } else {
                console.warn('[BROWSER] Failed to fetch browser settings:', response.status);
            }
        } catch (error) {
            console.error('[BROWSER] Failed to fetch browser settings:', error);
        }
    };

    const fetchKnowledgeFiles = async () => {
        try {
            const response = await fetch('http://localhost:7777/knowledge/documents');
            if (response.ok) {
                const result = await response.json();
                console.log('[KNOWLEDGE] Raw API response:', result);
                
                // Handle response format - API returns { success: true, data: { documents: [...], count: number } }
                let documentsArray = [];
                if (result.success && result.data && Array.isArray(result.data.documents)) {
                    documentsArray = result.data.documents;
                } else if (Array.isArray(result.documents)) {
                    documentsArray = result.documents;
                } else if (Array.isArray(result)) {
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
                    createdAt: doc.createdAt || new Date().toISOString()
                }));
                setKnowledgeFiles(formattedFiles);
                console.log('[KNOWLEDGE] Successfully fetched', formattedFiles.length, 'knowledge files');
            } else {
                console.warn('[KNOWLEDGE] API returned non-OK status:', response.status);
                setKnowledgeFiles([]);
            }
        } catch (error) {
            console.error('[KNOWLEDGE] Failed to fetch knowledge files:', error);
            setKnowledgeFiles([]);
        }
    };

    const fetchPluginConfigs = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/plugin-config`);
            if (response.ok) {
                const result = await response.json();
                const configs = result.data?.configurations || {};
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
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Configuration validation failed: ${validation.error}`,
                    timestamp: new Date(),
                }]);
                return;
            }
            
            const sanitizedValue = validation.sanitizedValue !== undefined ? validation.sanitizedValue : value;
            
            // Update local state immediately for responsive UI
            setConfigValues((prev: any) => ({
                ...prev,
                [plugin]: {
                    ...prev[plugin],
                    [key]: sanitizedValue
                }
            }));

            // Don't send empty values for API keys
            if ((key.includes('API_KEY') || key.includes('_KEY')) && !sanitizedValue.trim()) {
                console.log(`[CONFIG] Skipping empty API key update for ${key}`);
                return;
            }

            console.log(`[CONFIG] Updating ${plugin}.${key}:`, key.includes('KEY') ? '***REDACTED***' : sanitizedValue);

            // Send update to server with proper error handling
            const response = await fetch(`${API_BASE_URL}/api/plugin-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plugin,
                    config: { [key]: sanitizedValue }
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`[CONFIG] Successfully updated ${plugin}.${key}`);
                
                // Show success message
                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `◉ Updated ${plugin}.${key} configuration`,
                    timestamp: new Date(),
                }]);

                // If we're updating critical environment variables, refresh the config
                if (plugin === 'environment' && ['MODEL_PROVIDER', 'LANGUAGE_MODEL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].includes(key)) {
                    // Small delay then refresh plugin configs to get updated status
                    setTimeout(() => {
                        fetchPluginConfigs();
                    }, 1000);
                }
            } else {
                const error = await response.json();
                console.error(`[CONFIG] Failed to update ${plugin}.${key}:`, error);
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Failed to update config: ${error.error?.message || error.message || 'Unknown error'}`,
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('[CONFIG] Failed to update plugin config:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: `Failed to update config: Network error`,
                timestamp: new Date(),
            }]);
        }
    };

    const validateConfiguration = async () => {
        try {
            setOutput(prev => [...prev, {
                type: 'system',
                content: '◉ Validating configuration...',
                timestamp: new Date(),
            }]);

            const response = await fetch(`${API_BASE_URL}/api/config/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();
                const validation = result.data.validation;
                const recommendations = result.data.recommendations;

                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `Configuration Validation Complete`,
                    timestamp: new Date(),
                }]);

                // Show overall status
                const statusIcon = validation.overall === 'healthy' ? '✅' : 
                                 validation.overall === 'degraded' ? '⚠️' : '❌';
                setOutput(prev => [...prev, {
                    type: validation.overall === 'healthy' ? 'system' : 'error',
                    content: `${statusIcon} Overall Status: ${validation.overall.toUpperCase()}`,
                    timestamp: new Date(),
                }]);

                // Show provider statuses
                Object.entries(validation.providers).forEach(([provider, config]: [string, any]) => {
                    const providerIcon = config.status === 'healthy' ? '✅' : 
                                       config.status === 'degraded' ? '⚠️' : '❌';
                    setOutput(prev => [...prev, {
                        type: config.status === 'healthy' ? 'system' : 'error',
                        content: `${providerIcon} ${provider}: ${config.message}`,
                        timestamp: new Date(),
                    }]);
                });

                // Show recommendations
                if (recommendations && recommendations.length > 0) {
                    setOutput(prev => [...prev, {
                        type: 'system',
                        content: '📋 Recommendations:',
                        timestamp: new Date(),
                    }]);
                    
                    recommendations.forEach((rec: string) => {
                        setOutput(prev => [...prev, {
                            type: rec.includes('✅') ? 'system' : 'error',
                            content: rec,
                            timestamp: new Date(),
                        }]);
                    });
                }
            } else {
                const error = await response.json();
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Validation failed: ${error.error?.message || 'Unknown error'}`,
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('[CONFIG] Validation failed:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: 'Configuration validation failed: Network error',
                timestamp: new Date(),
            }]);
        }
    };

    const testConfiguration = async () => {
        try {
            setOutput(prev => [...prev, {
                type: 'system',
                content: '◉ Testing configuration with actual LLM calls...',
                timestamp: new Date(),
            }]);

            const response = await fetch(`${API_BASE_URL}/api/config/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();
                const testData = result.data;

                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `Configuration Test Complete (Provider: ${testData.testResults.provider})`,
                    timestamp: new Date(),
                }]);

                // Show overall test status
                const statusIcon = testData.overallStatus === 'success' ? '✅' : 
                                 testData.overallStatus === 'partial' ? '⚠️' : '❌';
                setOutput(prev => [...prev, {
                    type: testData.overallStatus === 'success' ? 'system' : 'error',
                    content: `${statusIcon} Test Status: ${testData.overallStatus.toUpperCase()}`,
                    timestamp: new Date(),
                }]);

                // Show test summary
                const summary = testData.summary;
                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `📊 Results: ${summary.passed}/${summary.total} tests passed, ${summary.failed} failed, ${summary.partial} partial`,
                    timestamp: new Date(),
                }]);

                // Show individual test results
                Object.entries(testData.testResults.tests).forEach(([testName, test]: [string, any]) => {
                    const testIcon = test.status === 'success' ? '✅' : 
                                   test.status === 'partial' ? '⚠️' : '❌';
                    setOutput(prev => [...prev, {
                        type: test.status === 'success' ? 'system' : 'error',
                        content: `${testIcon} ${testName}: ${test.message}`,
                        timestamp: new Date(),
                    }]);
                });
            } else {
                const error = await response.json();
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Configuration test failed: ${error.error?.message || 'Unknown error'}`,
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('[CONFIG] Test failed:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: 'Configuration test failed: Network error',
                timestamp: new Date(),
            }]);
        }
    };

    const deleteKnowledgeFile = async (fileId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/knowledge/documents/${fileId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                // Refresh the file list
                await fetchKnowledgeFiles();
                setOutput(prev => [...prev, {
                    type: 'system',
                    content: '◉ Knowledge file deleted successfully',
                    timestamp: new Date(),
                }]);
            } else {
                const error = await response.json();
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Failed to delete file: ${error.error || 'Unknown error'}`,
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('Failed to delete knowledge file:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: 'Failed to delete file: Network error',
                timestamp: new Date(),
            }]);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file upload
        const validation = InputValidator.validateFileUpload(file);
        if (!validation.valid) {
            SecurityLogger.logSecurityEvent(
                'invalid_input',
                `File upload validation failed: ${validation.error}`,
                'medium'
            );
            setOutput(prev => [...prev, {
                type: 'error',
                content: `File upload failed: ${validation.error}`,
                timestamp: new Date(),
            }]);
            e.target.value = ''; // Reset the input
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('agentId', userId);

            const response = await fetch(`${API_BASE_URL}/knowledge/upload`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                // Refresh the file list
                await fetchKnowledgeFiles();
                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `◉ File "${file.name}" uploaded successfully`,
                    timestamp: new Date(),
                }]);
            } else {
                const errorResponse = await response.json();
                const errorMessage = errorResponse?.error?.message || errorResponse?.message || 'Unknown error';
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Failed to upload file: ${errorMessage}`,
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('Failed to upload file:', error);
            setOutput(prev => [...prev, {
                type: 'error',
                content: 'Failed to upload file: Network error',
                timestamp: new Date(),
            }]);
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

    // Security-aware chat handlers
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !isConnected) return;

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

        setOutput((prev) => [
            ...prev,
            {
                type: 'user',
                content: sanitizedInput,
                timestamp: new Date(),
            },
        ]);

        setInput('');

        try {
            await sendMessage(sanitizedInput);
            setAgentStatus(prev => ({ 
                ...prev, 
                lastActivity: new Date(),
                tokenUsage: prev.tokenUsage + sanitizedInput.length
            }));
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
                setInput(commandHistory.current[commandHistory.current.length - 1 - historyPosition.current]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyPosition.current > 0) {
                historyPosition.current--;
                setInput(commandHistory.current[commandHistory.current.length - 1 - historyPosition.current]);
            } else if (historyPosition.current === 0) {
                historyPosition.current = -1;
                setInput('');
            }
        }
    };

    const renderStatusPanel = () => {
        console.log('[RENDER] Current tab:', currentTab, 'Goals count:', goals.length, 'Todos count:', todos.length);
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
                                goals.map(goal => (
                                    <div key={goal.id} className="status-item">
                                        <div className="status-indicator">
                                            {goal.isCompleted ? '✓' : '○'}
                                        </div>
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
                                todos.map(todo => (
                                    <div key={todo.id} className="status-item">
                                        <div className="status-indicator">
                                            {todo.isCompleted ? '✓' : '○'}
                                        </div>
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
                                            {thought.timestamp ? new Date(thought.timestamp).toLocaleTimeString() : '--:--:--'}
                                        </div>
                                        <div className="monologue-text">
                                            <span className={`monologue-sender ${thought.isFromAgent ? 'agent' : 'system'}`}>
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
                                knowledgeFiles.map(file => (
                                    <div key={file.id} className="file-item">
                                        <span className="file-icon">📄</span>
                                        <div className="file-info">
                                            <span className="file-name">{file.title}</span>
                                            <span className="file-meta">{file.type} • {new Date(file.createdAt).toLocaleDateString()}</span>
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
                                {(configValues.environment?.MODEL_PROVIDER === 'openai' || !configValues.environment?.MODEL_PROVIDER) && (
                                    <>
                                        <div className="config-item">
                                            <label>OpenAI API Key</label>
                                            <input 
                                                type="password" 
                                                className="config-input" 
                                                value={configValues.environment?.OPENAI_API_KEY || ''}
                                                placeholder={pluginConfigs.environment?.OPENAI_API_KEY === '***SET***' ? 'Currently Set' : 'Enter OpenAI API Key'}
                                                onChange={(e) => updatePluginConfig('environment', 'OPENAI_API_KEY', e.target.value)}
                                                data-testid="openai-api-key-input"
                                            />
                                        </div>
                                        <div className="config-item">
                                            <label>Model</label>
                                            <select 
                                                className="config-select"
                                                value={configValues.environment?.LANGUAGE_MODEL || 'gpt-4o-mini'}
                                                onChange={(e) => updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)}
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
                                                placeholder={pluginConfigs.environment?.ANTHROPIC_API_KEY === '***SET***' ? 'Currently Set' : 'Enter Anthropic API Key'}
                                                onChange={(e) => updatePluginConfig('environment', 'ANTHROPIC_API_KEY', e.target.value)}
                                                data-testid="anthropic-api-key-input"
                                            />
                                        </div>
                                        <div className="config-item">
                                            <label>Model</label>
                                            <select 
                                                className="config-select"
                                                value={configValues.environment?.LANGUAGE_MODEL || 'claude-3-5-sonnet-20241022'}
                                                onChange={(e) => updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)}
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
                                                value={configValues.environment?.OLLAMA_SERVER_URL || 'http://localhost:11434'}
                                                placeholder="http://localhost:11434"
                                                onChange={(e) => updatePluginConfig('environment', 'OLLAMA_SERVER_URL', e.target.value)}
                                                data-testid="ollama-server-url-input"
                                            />
                                        </div>
                                        <div className="config-item">
                                            <label>Model</label>
                                            <input 
                                                type="text" 
                                                className="config-input" 
                                                value={configValues.environment?.LANGUAGE_MODEL || 'llama3.1:8b'}
                                                placeholder="llama3.1:8b"
                                                onChange={(e) => updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)}
                                                data-testid="ollama-model-input"
                                            />
                                            <small style={{color: '#888', fontSize: '10px', marginTop: '4px'}}>
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
                                        value={configValues.environment?.TEXT_EMBEDDING_MODEL || 'text-embedding-3-small'}
                                        placeholder="text-embedding-3-small"
                                        onChange={(e) => updatePluginConfig('environment', 'TEXT_EMBEDDING_MODEL', e.target.value)}
                                        data-testid="embedding-model-input"
                                    />
                                </div>
                            </div>

                            {/* Plugin-specific configurations */}
                            {Object.entries(pluginConfigs).filter(([key]) => key !== 'environment').map(([plugin, config]: [string, any]) => (
                                <div key={plugin} className="config-section">
                                    <div className="config-title">{plugin.charAt(0).toUpperCase() + plugin.slice(1)} Plugin</div>
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
                                    <small style={{color: '#888', fontSize: '10px', lineHeight: '1.3'}}>
                                        Validate: Check API connectivity and configuration<br/>
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
                                    This will permanently delete all agent memories, goals, todos, and restart with a fresh instance.
                                </div>
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
            {/* Connection Status */}
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`} data-testid="connection-status">
                {isConnected ? '◉ ONLINE' : '◯ OFFLINE'}
                <span className="autonomy-status" data-testid="autonomy-status">
                    {plugins.autonomy ? 'Active' : 'Paused'}
                </span>
            </div>

            {/* Main Layout */}
            <div className="terminal-layout">
                {/* Left Panel - Chat */}
                <div className="panel panel-left">
                    <div className="panel-header">
                        ◆ ADMIN TERMINAL
                    </div>
                    
                    <div 
                        className="panel-content chat-content" 
                        ref={chatContainerRef}
                        data-testid="chat-messages"
                        role="log"
                    >
                        {output.map((line, index) => (
                            <div key={index} className={`chat-line chat-${line.type}`} data-testid={line.type === 'user' ? 'user-message' : line.type === 'agent' ? 'agent-message' : 'system-message'}>
                                <span className="chat-timestamp" data-testid="message-timestamp">
                                    {line.timestamp.toLocaleTimeString()}
                                </span>
                                <span className="chat-prefix">
                                    {line.type === 'user' ? '[USER]' : 
                                     line.type === 'agent' ? '[AGENT]' : 
                                     line.type === 'system' ? '[SYS]' : '[ERR]'}
                                </span>
                                <span className="chat-content">{line.content}</span>
                                <div className="message-actions" data-testid="message-actions" style={{display: 'none'}}>
                                    <button className="message-action" data-testid="copy-message-button" onClick={() => copyToClipboard(line.content)}>
                                        Copy
                                    </button>
                                </div>
                            </div>
                        ))}
                        {error && (
                            <div className="chat-line chat-error">
                                <span className="chat-prefix">[ERR]</span>
                                <span className="chat-content">Connection error: {error}</span>
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
                                placeholder=""
                                disabled={!isConnected}
                                data-testid="chat-input"
                                aria-label="Enter command or message"
                            />
                            <button 
                                type="submit" 
                                className="send-btn"
                                disabled={!input.trim() || !isConnected}
                                data-testid="chat-send-button"
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
                        {(['goals', 'todos', 'monologue', 'files', 'config'] as const).map(tab => (
                            <button
                                key={tab}
                                className={`tab-btn ${currentTab === tab ? 'active' : ''}`}
                                onClick={() => setCurrentTab(tab)}
                                data-testid={`${tab}-tab`}
                            >
                                {tab.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Status Panel Content */}
                    <div data-testid={`${currentTab}-content`}>
                        {renderStatusPanel()}
                    </div>
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
                                        alert('Please type "RESET AGENT" exactly to confirm.');
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
                capability={SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]?.capability || ''}
                riskLevel={SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]?.riskLevel || 'medium'}
                description={SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]?.description || ''}
                risks={SECURITY_CAPABILITIES[securityWarning.capability as keyof typeof SECURITY_CAPABILITIES]?.risks || []}
                onConfirm={securityWarning.onConfirm}
                onCancel={() => setSecurityWarning({ isVisible: false, capability: '', onConfirm: () => {} })}
                isVisible={securityWarning.isVisible}
            />
        </div>
    );
};