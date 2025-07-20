import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useElizaClient } from '../hooks/useElizaClient';
import { ElizaMessage } from '../services/ElizaService';
import { v4 as uuidv4 } from 'uuid';

// API configuration  
const API_BASE_URL = 'http://localhost:7777';

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

    // Plugin API calls
    const togglePlugin = async (pluginName: keyof PluginToggleState) => {
        try {
            let success = false;
            
            switch (pluginName) {
                case 'autonomy':
                    // Use the working autonomy enable/disable endpoints
                    const currentAutonomyState = plugins.autonomy;
                    const autonomyEndpoint = currentAutonomyState ? 'disable' : 'enable';
                    const response = await fetch(`${API_BASE_URL}/autonomy/${autonomyEndpoint}`, {
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
                    const shellResponse = await fetch(`${API_BASE_URL}/api/agents/default/capabilities/shell/toggle`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    success = shellResponse.ok;
                    break;
                    
                case 'browser':
                    const browserResponse = await fetch(`${API_BASE_URL}/api/agents/default/capabilities/browser/toggle`, {
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
                setGoals(data || []);
                console.log('[GOALS] Successfully fetched', data?.length || 0, 'goals');
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
                setTodos(processedTodos || []);
                console.log('[TODOS] Successfully fetched', processedTodos?.length || 0, 'todos');
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
        try {
            const response = await fetch(`${API_BASE_URL}/autonomy/status`);
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
            // Get autonomy room ID from a known pattern
            // Since autonomy room IDs are generated fresh on each restart, 
            // we'll fetch recent memories and look for autonomy room messages
            let autonomousRoomId = null;
            
            // Try to get recent memories from all rooms and find the autonomy room
            const allMemoriesResponse = await fetch(`${API_BASE_URL}/api/memories?count=50`);
            if (allMemoriesResponse.ok) {
                const allResult = await allMemoriesResponse.json();
                const allData = allResult.success ? allResult.data : [];
                
                // Find memories with autonomy metadata or from agent talking to itself
                const autonomyMemories = allData.filter((memory: any) => 
                    memory.content?.metadata?.isAutonomous === true || 
                    (memory.entityId === memory.agentId && memory.content?.text && 
                     memory.content?.text.toLowerCase().includes('goal'))
                );
                
                if (autonomyMemories.length > 0) {
                    autonomousRoomId = autonomyMemories[0].roomId;
                    console.log('[MONOLOGUE] Found autonomy room ID:', autonomousRoomId);
                }
            }
            
            if (!autonomousRoomId) {
                // Fallback: just show that we couldn't find autonomous thoughts
                setMonologue([{ text: 'No autonomous thoughts found yet...', timestamp: Date.now() }]);
                return;
            }
            
            // Fetch ALL messages from the autonomous room (not just filtered thoughts)
            const response = await fetch(`${API_BASE_URL}/api/memories?roomId=${autonomousRoomId}&count=20`);
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : [];
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
                setAgentMonologue(roomMessages);
                console.log(`[MONOLOGUE] Fetched ${roomMessages.length} messages from autonomy room`);
            } else {
                console.error('Failed to fetch memories:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Failed to fetch monologue:', error);
        }
    };

    const fetchVisionSettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/agents/default/settings/vision`);
            if (response.ok) {
                const result = await response.json();
                // Handle new API response format
                const data = result.success ? result.data : result;
                console.log('[VISION] Fetched vision settings:', data);
                setPlugins(prev => ({
                    ...prev,
                    camera: data.ENABLE_CAMERA === 'true' || data.VISION_CAMERA_ENABLED === 'true',
                    screen: data.ENABLE_SCREEN_CAPTURE === 'true' || data.VISION_SCREEN_ENABLED === 'true',
                    microphone: data.ENABLE_MICROPHONE === 'true' || data.VISION_MICROPHONE_ENABLED === 'true',
                    speakers: data.ENABLE_SPEAKER === 'true' || data.VISION_SPEAKER_ENABLED === 'true'
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
            // Update local state
            setConfigValues((prev: any) => ({
                ...prev,
                [plugin]: {
                    ...prev[plugin],
                    [key]: value
                }
            }));

            // Send update to server
            const response = await fetch(`${API_BASE_URL}/api/plugin-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plugin,
                    config: { [key]: value }
                })
            });

            if (response.ok) {
                setOutput(prev => [...prev, {
                    type: 'system',
                    content: `◉ Updated ${plugin}.${key} configuration`,
                    timestamp: new Date(),
                }]);
            } else {
                const error = await response.json();
                setOutput(prev => [...prev, {
                    type: 'error',
                    content: `Failed to update config: ${error.error}`,
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('Failed to update plugin config:', error);
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

        try {
            const formData = new FormData();
            formData.append('files', file);
            formData.append('agentId', userId);

            const response = await fetch(`${API_BASE_URL}/knowledge/documents`, {
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
            fetchKnowledgeFiles();
            fetchPluginConfigs();
        }, 5000);
        
        // Initial fetch
        fetchGoals();
        fetchTodos();
        fetchAutonomyStatus();
        fetchMonologue();
        fetchVisionSettings();
        fetchShellSettings();
        fetchBrowserSettings();
        fetchKnowledgeFiles();
        fetchPluginConfigs();
        
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
                    <div className="status-content">
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
                            {/* Environment Configuration */}
                            {pluginConfigs.environment && (
                                <div className="config-section">
                                    <div className="config-title">Environment Settings</div>
                                    <div className="config-item">
                                        <label>Model Provider</label>
                                        <select 
                                            className="config-select"
                                            value={configValues.environment?.MODEL_PROVIDER || 'openai'}
                                            onChange={(e) => updatePluginConfig('environment', 'MODEL_PROVIDER', e.target.value)}
                                        >
                                            <option value="openai">OpenAI</option>
                                            <option value="anthropic">Anthropic</option>
                                            <option value="google">Google</option>
                                            <option value="local">Local Model</option>
                                        </select>
                                    </div>
                                    <div className="config-item">
                                        <label>OpenAI API Key</label>
                                        <input 
                                            type="password" 
                                            className="config-input" 
                                            placeholder={pluginConfigs.environment?.OPENAI_API_KEY || 'Not Set'}
                                            onChange={(e) => updatePluginConfig('environment', 'OPENAI_API_KEY', e.target.value)}
                                        />
                                    </div>
                                    <div className="config-item">
                                        <label>Language Model</label>
                                        <input 
                                            className="config-input" 
                                            value={configValues.environment?.LANGUAGE_MODEL || ''}
                                            placeholder="gpt-4o-mini"
                                            onChange={(e) => updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

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
                                onChange={(e) => setInput(e.target.value)}
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
                    {/* Plugin Controls */}
                    <div className="controls-section">
                        <div className="controls-header">◆ CAPABILITIES</div>
                        <div className="controls-grid">
                            {Object.entries(plugins).map(([plugin, enabled]) => (
                                <button
                                    key={plugin}
                                    className={`control-btn ${enabled ? 'enabled' : 'disabled'}`}
                                    onClick={() => togglePlugin(plugin as keyof PluginToggleState)}
                                    data-testid={`${plugin}-toggle`}
                                    aria-checked={enabled}
                                    role="switch"
                                    aria-label={`Toggle ${plugin} capability`}
                                >
                                    <div className="control-indicator" data-testid={`${plugin}-toggle-status`}>
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
        </div>
    );
};