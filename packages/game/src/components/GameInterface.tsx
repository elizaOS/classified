import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useElizaClient } from '../hooks/useElizaClient';
import { ElizaMessage } from '../services/ElizaService';
import { v4 as uuidv4 } from 'uuid';

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
        autonomy: true, // Default to on since autonomy service starts on by default
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
    const [knowledgeFiles, setKnowledgeFiles] = useState<string[]>(['letter-from-creators.md']);
    const [isResetting, setIsResetting] = useState(false);

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
            if (message.roomId === 'autonomous' || // From autonomy plugin's dedicated room
                message.content.includes('thinking:') || 
                message.content.includes('goal:') || 
                message.content.includes('planning:') ||
                message.content.includes('What should I do next?')) {
                setAgentMonologue(prev => [...prev.slice(-9), message.content].slice(-10));
            }
        }
    }, [userId]);

    const { isConnected, sendMessage, error } = useElizaClient({
        baseUrl: 'http://localhost:3000',
        userId,
        onMessage: handleMessage,
        onConnectionChange: (connected) => {
            setAgentStatus(prev => ({ ...prev, isOnline: connected }));
        },
    });

    // Plugin API calls
    const togglePlugin = async (pluginName: keyof PluginToggleState) => {
        try {
            let success = false;
            
            switch (pluginName) {
                case 'autonomy':
                    // Use the working autonomy enable/disable endpoints
                    const currentAutonomyState = plugins.autonomy;
                    const autonomyEndpoint = currentAutonomyState ? 'disable' : 'enable';
                    const response = await fetch(`http://localhost:3000/autonomy/${autonomyEndpoint}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    success = response.ok;
                    break;
                    
                case 'camera':
                    success = await updateVisionSetting('ENABLE_CAMERA', !plugins.camera);
                    break;
                    
                case 'screen':
                    success = await updateVisionSetting('ENABLE_SCREEN_CAPTURE', !plugins.screen);
                    break;
                    
                case 'microphone':
                    success = await updateVisionSetting('ENABLE_MICROPHONE', !plugins.microphone);
                    break;
                    
                case 'speakers':
                    success = await updateVisionSetting('ENABLE_SPEAKER', !plugins.speakers);
                    break;
                    
                case 'shell':
                    const shellResponse = await fetch(`http://localhost:3000/api/agents/default/capabilities/shell/toggle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    success = shellResponse.ok;
                    break;
                    
                case 'browser':
                    const browserResponse = await fetch(`http://localhost:3000/api/agents/default/capabilities/browser/toggle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    success = browserResponse.ok;
                    break;
            }

            if (success) {
                setPlugins(prev => ({
                    ...prev,
                    [pluginName]: !prev[pluginName]
                }));
            }
        } catch (error) {
            console.error(`Failed to toggle ${pluginName}:`, error);
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
                fetch('http://localhost:3000/api/agents/default/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(setting)
                })
            );
            
            const responses = await Promise.all(updatePromises);
            const allSuccessful = responses.every(response => response.ok);
            
            if (allSuccessful) {
                // Trigger vision service refresh
                await fetch('http://localhost:3000/api/agents/default/vision/refresh', {
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
            const response = await fetch('http://localhost:3000/api/reset-agent', {
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
                setKnowledgeFiles(['letter-from-creators.md']);
                
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
            const response = await fetch('http://localhost:3000/api/goals');
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : [];
                setGoals(data);
            }
        } catch (error) {
            console.error('Failed to fetch goals:', error);
        }
    };

    const fetchTodos = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/todos');
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : [];
                // Flatten the todos if they're in nested structure
                if (Array.isArray(data) && data.length > 0 && data[0].rooms) {
                    setTodos(data.flatMap((world: any) => 
                        world.rooms.flatMap((room: any) => room.tasks || [])
                    ));
                } else {
                    setTodos(data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch todos:', error);
        }
    };

    const fetchAutonomyStatus = async () => {
        try {
            const response = await fetch('http://localhost:3000/autonomy/status');
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
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
            // Fetch recent messages from the autonomous room
            const response = await fetch('http://localhost:3000/api/memories?roomId=autonomous&count=20');
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : [];
                const autonomousThoughts = data
                    .filter((memory: any) => memory.content?.text)
                    .map((memory: any) => memory.content.text)
                    .slice(-10); // Keep last 10 thoughts
                setAgentMonologue(autonomousThoughts);
            }
        } catch (error) {
            console.error('Failed to fetch monologue:', error);
        }
    };

    const fetchVisionSettings = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/agents/default/settings/vision');
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                setPlugins(prev => ({
                    ...prev,
                    camera: data.ENABLE_CAMERA === 'true' || data.VISION_CAMERA_ENABLED === 'true',
                    screen: data.ENABLE_SCREEN_CAPTURE === 'true' || data.VISION_SCREEN_ENABLED === 'true',
                    microphone: data.ENABLE_MICROPHONE === 'true' || data.VISION_MICROPHONE_ENABLED === 'true',
                    speakers: data.ENABLE_SPEAKER === 'true' || data.VISION_SPEAKER_ENABLED === 'true'
                }));
            }
        } catch (error) {
            console.error('Failed to fetch vision settings:', error);
        }
    };

    const fetchShellSettings = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/agents/default/capabilities/shell');
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                setPlugins(prev => ({
                    ...prev,
                    shell: data.enabled
                }));
            }
        } catch (error) {
            console.error('Failed to fetch shell settings:', error);
        }
    };

    const fetchBrowserSettings = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/agents/default/capabilities/browser');
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                setPlugins(prev => ({
                    ...prev,
                    browser: data.enabled
                }));
            }
        } catch (error) {
            console.error('Failed to fetch browser settings:', error);
        }
    };

    // Auto-scroll chat
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [output]);

    // Periodic data refresh
    useEffect(() => {
        const interval = setInterval(() => {
            fetchGoals();
            fetchTodos();
            fetchAutonomyStatus();
            fetchMonologue();
            fetchVisionSettings();
            fetchShellSettings();
            fetchBrowserSettings();
        }, 5000);
        
        // Initial fetch
        fetchGoals();
        fetchTodos();
        fetchAutonomyStatus();
        fetchMonologue();
        fetchVisionSettings();
        fetchShellSettings();
        fetchBrowserSettings();
        
        return () => clearInterval(interval);
    }, []);

    // Chat handlers
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !isConnected) return;

        const trimmedInput = input.trim();
        commandHistory.current.push(trimmedInput);
        historyPosition.current = -1;

        setOutput((prev) => [
            ...prev,
            {
                type: 'user',
                content: trimmedInput,
                timestamp: new Date(),
            },
        ]);

        setInput('');

        try {
            await sendMessage(trimmedInput);
            setAgentStatus(prev => ({ 
                ...prev, 
                lastActivity: new Date(),
                tokenUsage: prev.tokenUsage + trimmedInput.length
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
        switch (currentTab) {
            case 'goals':
                return (
                    <div className="status-content">
                        <div className="status-header">
                            <span>◎ AGENT OBJECTIVES [{goals.length}]</span>
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
                    <div className="status-content">
                        <div className="status-header">
                            <span>◎ TASK QUEUE [{todos.length}]</span>
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
                            <span>◎ AGENT THOUGHTS</span>
                        </div>
                        <div className="scrollable-content">
                            {agentMonologue.length === 0 ? (
                                <div className="empty-state">Agent is quiet...</div>
                            ) : (
                                agentMonologue.map((thought, index) => (
                                    <div key={index} className="monologue-item">
                                        {thought}
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
                            {knowledgeFiles.map(file => (
                                <div key={file} className="file-item">
                                    <span className="file-icon">📄</span>
                                    <span className="file-name">{file}</span>
                                    <button className="file-action">✕</button>
                                </div>
                            ))}
                            <div className="file-upload">
                                <input 
                                    type="file" 
                                    id="file-upload" 
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setKnowledgeFiles(prev => [...prev, e.target.files![0].name]);
                                        }
                                    }}
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
                            <div className="config-section">
                                <div className="config-title">AI Provider</div>
                                <select className="config-select">
                                    <option>Local Model</option>
                                    <option>OpenAI</option>
                                    <option>Anthropic</option>
                                </select>
                            </div>
                            <div className="config-section">
                                <div className="config-title">API Keys</div>
                                <input type="password" className="config-input" placeholder="OpenAI API Key" />
                                <input type="password" className="config-input" placeholder="Anthropic API Key" />
                            </div>
                            <div className="config-section">
                                <div className="config-title">Agent Settings</div>
                                <input className="config-input" placeholder="Agent Name" />
                                <input className="config-input" placeholder="Temperature (0.0-1.0)" />
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
        <div className="terminal-container">
            {/* Connection Status */}
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '◉ ONLINE' : '◯ OFFLINE'}
            </div>

            {/* Main Layout */}
            <div className="terminal-layout">
                {/* Left Panel - Chat */}
                <div className="panel panel-left">
                    <div className="panel-header">
                        ◆ AGENT CONSOLE 
                        <span className="panel-subtitle">
                            {agentStatus.isOnline ? 'Connected' : 'Disconnected'} | 
                            Tokens: {agentStatus.tokenUsage} | 
                            Cost: ${agentStatus.cost.toFixed(4)}
                        </span>
                    </div>
                    
                    <div 
                        className="panel-content chat-content" 
                        ref={chatContainerRef}
                    >
                        {output.map((line, index) => (
                            <div key={index} className={`chat-line chat-${line.type}`}>
                                <span className="chat-timestamp">
                                    {line.timestamp.toLocaleTimeString()}
                                </span>
                                <span className="chat-prefix">
                                    {line.type === 'user' ? '[USER]' : 
                                     line.type === 'agent' ? '[AGENT]' : 
                                     line.type === 'system' ? '[SYS]' : '[ERR]'}
                                </span>
                                <span className="chat-content">{line.content}</span>
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
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="chat-input"
                                placeholder="Enter command or message..."
                                disabled={!isConnected}
                            />
                            <button 
                                type="submit" 
                                className="send-btn"
                                disabled={!input.trim() || !isConnected}
                            >
                                SEND
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Panel - Status */}
                <div className="panel panel-right">
                    {/* Plugin Controls */}
                    <div className="controls-section">
                        <div className="controls-header">◆ AGENT CAPABILITIES</div>
                        <div className="controls-grid">
                            {Object.entries(plugins).map(([plugin, enabled]) => (
                                <button
                                    key={plugin}
                                    className={`control-btn ${enabled ? 'enabled' : 'disabled'}`}
                                    onClick={() => togglePlugin(plugin as keyof PluginToggleState)}
                                >
                                    <div className="control-indicator">
                                        {enabled ? '◉' : '◯'}
                                    </div>
                                    <div className="control-label">
                                        {plugin.toUpperCase()}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="status-tabs">
                        {(['goals', 'todos', 'monologue', 'files', 'config'] as const).map(tab => (
                            <button
                                key={tab}
                                className={`tab-btn ${currentTab === tab ? 'active' : ''}`}
                                onClick={() => setCurrentTab(tab)}
                            >
                                {tab.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Status Panel Content */}
                    {renderStatusPanel()}
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
        </div>
    );
};