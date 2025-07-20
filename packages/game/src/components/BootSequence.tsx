import { useEffect, useState, useCallback } from 'react';

const initialBootMessages = [
    'ELIZA OS v1.0.0 - Agent Runtime Environment',
    '',
    'Loading ELIZA OS kernel...',
    'Mounting virtual filesystems...',
    'Starting system services...',
    '',
    ' ███████╗██╗     ██╗███████╗ █████╗     ██████╗ ███████╗',
    ' ██╔════╝██║     ██║╚══███╔╝██╔══██╗   ██╔═══██╗██╔════╝',
    ' █████╗  ██║     ██║  ███╔╝ ███████║   ██║   ██║███████╗',
    ' ██╔══╝  ██║     ██║ ███╔╝  ██╔══██║   ██║   ██║╚════██║',
    ' ███████╗███████╗██║███████╗██║  ██║██╗╚██████╔╝███████║',
    ' ╚══════╝╚══════╝╚═╝╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝ ╚══════╝',
    '',
    'Agent Runtime Environment Initialized',
    'EXPERIMENTAL SOFTWARE. USE AT YOUR OWN RISK.',
];

const connectionMessages = [
    'Establishing connection to agent runtime...',
    'Validating API endpoints...',
    'Loading agent configuration...',
    'Initializing plugin subsystems...',
    '  • Autonomy Engine ... [PENDING]',
    '  • Vision System ... [PENDING]', 
    '  • Shell Interface ... [PENDING]',
    '  • Knowledge Base ... [PENDING]',
    '  • Browser Agent ... [PENDING]',
    '',
    'Agent connection status:',
];

type ConnectionStatus = 'connecting' | 'connected' | 'failed';

interface BootSequenceProps {
    onComplete: () => void;
    onConnectionTest?: () => Promise<boolean>;
}

export default function BootSequence({ onComplete, onConnectionTest }: BootSequenceProps) {
    const [visibleLines, setVisibleLines] = useState<number>(0);
    const [showCursor, setShowCursor] = useState(true);
    const [currentPhase, setCurrentPhase] = useState<'boot' | 'connection' | 'testing' | 'setup'>('boot');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [messages, setMessages] = useState<string[]>(initialBootMessages);
    const [showSetup, setShowSetup] = useState(false);
    const [setupConfig, setSetupConfig] = useState({
        openaiKey: '',
        anthropicKey: '',
        modelProvider: 'openai'
    });

    const testConnection = useCallback(async () => {
        setCurrentPhase('testing');
        
        try {
            // Test basic connectivity
            setMessages(prev => [...prev, '  Testing agent connectivity... [TESTING]']);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if API keys are configured
            const configResponse = await fetch('http://localhost:7777/api/plugin-config', {
                method: 'GET'
            });
            
            let needsSetup = false;
            if (configResponse.ok) {
                const configData = await configResponse.json();
                const env = configData.data?.configurations?.environment;
                needsSetup = (!env?.OPENAI_API_KEY || env.OPENAI_API_KEY === 'NOT_SET') && 
                           (!env?.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY === 'NOT_SET');
            }
            
            if (needsSetup) {
                setConnectionStatus('failed');
                setMessages(prev => [
                    ...prev.slice(0, -1),
                    '  Testing agent connectivity... [SETUP]',
                    '',
                    '⚠ No AI model configuration found',
                    '⚠ API keys required for operation',
                    '',
                    'Launching setup wizard...'
                ]);
                
                setTimeout(() => {
                    setShowSetup(true);
                }, 2000);
                return;
            }
            
            // Use the provided connection test or default test
            const isConnected = onConnectionTest ? await onConnectionTest() : await defaultConnectionTest();
            
            if (isConnected) {
                setConnectionStatus('connected');
                setMessages(prev => [
                    ...prev.slice(0, -1),
                    '  Testing agent connectivity... [  OK  ]',
                    '',
                    '✓ Agent runtime is online and responding',
                    '✓ All systems operational',
                    '✓ Ready for agent interaction',
                    '',
                    'Welcome to ELIZA Terminal v2.0',
                    'Type "help" for available commands',
                    '',
                    'Launching main interface...'
                ]);
                
                setTimeout(() => {
                    onComplete();
                }, 1500);
            } else {
                setConnectionStatus('failed');
                setMessages(prev => [
                    ...prev.slice(0, -1),
                    '  Testing agent connectivity... [FAIL]',
                    '',
                    '✗ Unable to connect to agent runtime',
                    '✗ Check configuration and try again',
                    '',
                    'Press any key to retry or continue...'
                ]);
            }
        } catch (error) {
            setConnectionStatus('failed');
            setMessages(prev => [
                ...prev.slice(0, -1),
                '  Testing agent connectivity... [FAIL]',
                '',
                '✗ Connection error occurred',
                '✗ Please check your configuration',
                '',
                'Press any key to retry or continue...'
            ]);
        }
    }, [onConnectionTest, onComplete]);

    const defaultConnectionTest = async (): Promise<boolean> => {
        try {
            const response = await fetch('http://localhost:7777/api/server/health', {
                method: 'GET',
                timeout: 5000,
            } as any);
            return response.ok;
        } catch {
            return false;
        }
    };

    const handleSetupComplete = async () => {
        try {
            // Save configuration to backend
            const config = {
                MODEL_PROVIDER: setupConfig.modelProvider,
                ...(setupConfig.modelProvider === 'openai' && setupConfig.openaiKey && {
                    OPENAI_API_KEY: setupConfig.openaiKey
                }),
                ...(setupConfig.modelProvider === 'anthropic' && setupConfig.anthropicKey && {
                    ANTHROPIC_API_KEY: setupConfig.anthropicKey
                })
            };
            
            console.log('[Setup] Saving configuration...');
            const response = await fetch('http://localhost:7777/api/plugin-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plugin: 'environment',
                    config
                })
            });
            
            if (response.ok) {
                console.log('[Setup] Configuration saved successfully');
                // Continue to main interface
                onComplete();
            } else {
                console.error('[Setup] Failed to save configuration');
                alert('Failed to save configuration. Please try again.');
            }
        } catch (error) {
            console.error('[Setup] Error saving configuration:', error);
            alert('Error saving configuration. Please check your connection.');
        }
    };
    
    const isSetupValid = () => {
        if (setupConfig.modelProvider === 'openai') {
            return setupConfig.openaiKey.trim().length > 0;
        } else if (setupConfig.modelProvider === 'anthropic') {
            return setupConfig.anthropicKey.trim().length > 0;
        }
        return false;
    };

    useEffect(() => {
        if (currentPhase === 'boot') {
            const lineTimer = setInterval(() => {
                setVisibleLines(prev => {
                    if (prev >= initialBootMessages.length) {
                        clearInterval(lineTimer);
                        setCurrentPhase('connection');
                        setMessages([...initialBootMessages, ...connectionMessages]);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 100);

            return () => clearInterval(lineTimer);
        } else if (currentPhase === 'connection') {
            const lineTimer = setInterval(() => {
                setVisibleLines(prev => {
                    if (prev >= messages.length) {
                        clearInterval(lineTimer);
                        setTimeout(() => {
                            testConnection();
                        }, 1000);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 150);

            return () => clearInterval(lineTimer);
        }
    }, [currentPhase, messages.length, testConnection]);

    useEffect(() => {
        const cursorTimer = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 500);

        return () => clearInterval(cursorTimer);
    }, []);

    // Handle retry on failed connection
    useEffect(() => {
        if (connectionStatus === 'failed' && !showSetup) {
            const handleKeyPress = (e: KeyboardEvent) => {
                setConnectionStatus('connecting');
                setCurrentPhase('testing');
                testConnection();
                document.removeEventListener('keydown', handleKeyPress);
            };

            document.addEventListener('keydown', handleKeyPress);
            return () => document.removeEventListener('keydown', handleKeyPress);
        }
    }, [connectionStatus, showSetup, testConnection]);

    const getStatusColor = (status: ConnectionStatus) => {
        switch (status) {
            case 'connected': return 'var(--terminal-green)';
            case 'failed': return 'var(--terminal-red)';
            default: return 'var(--terminal-amber)';
        }
    };

    // Setup phase UI - show this FIRST if needed
    if (showSetup) {
        return (
            <div className="boot-screen">
                <div className="setup-content">
                    <div className="setup-header">
                        <h2 className="glow">ELIZA OS Configuration</h2>
                        <p>Configure your AI model settings to begin</p>
                    </div>
                    
                    <div className="setup-form">
                        <div className="form-group">
                            <label htmlFor="modelProvider">Model Provider:</label>
                            <select 
                                id="modelProvider"
                                value={setupConfig.modelProvider}
                                onChange={(e) => setSetupConfig({...setupConfig, modelProvider: e.target.value})}
                                className="setup-input"
                            >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                            </select>
                        </div>
                        
                        {setupConfig.modelProvider === 'openai' && (
                            <div className="form-group">
                                <label htmlFor="openaiKey">OpenAI API Key:</label>
                                <input
                                    id="openaiKey"
                                    type="password"
                                    value={setupConfig.openaiKey}
                                    onChange={(e) => setSetupConfig({...setupConfig, openaiKey: e.target.value})}
                                    className="setup-input"
                                    placeholder="sk-..."
                                />
                            </div>
                        )}
                        
                        {setupConfig.modelProvider === 'anthropic' && (
                            <div className="form-group">
                                <label htmlFor="anthropicKey">Anthropic API Key:</label>
                                <input
                                    id="anthropicKey"
                                    type="password"
                                    value={setupConfig.anthropicKey}
                                    onChange={(e) => setSetupConfig({...setupConfig, anthropicKey: e.target.value})}
                                    className="setup-input"
                                    placeholder="sk-ant-..."
                                />
                            </div>
                        )}
                        
                        <div className="form-actions">
                            <button 
                                onClick={handleSetupComplete}
                                className="setup-button primary"
                                disabled={!isSetupValid()}
                            >
                                Continue
                            </button>
                            <button 
                                onClick={() => {
                                    // Skip setup and continue with existing config
                                    console.log('[Setup] Skipping setup, using existing configuration');
                                    onComplete();
                                }}
                                className="setup-button secondary"
                            >
                                Skip (Use Existing)
                            </button>
                        </div>
                        
                        <div className="setup-info">
                            <p className="info-text">Your API keys are stored locally and never transmitted to third parties.</p>
                            <p className="info-text">You can change these settings later in the configuration panel.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main boot sequence UI
    return (
        <div className="boot-screen">
            <div className="boot-content">
                {messages.slice(0, visibleLines).map((message, index) => (
                    <div 
                        key={index} 
                        className="boot-line glow"
                        style={{
                            color: message.includes('[FAIL]') ? 'var(--terminal-red)' :
                                   message.includes('[  OK  ]') ? 'var(--terminal-green)' :
                                   message.includes('[TESTING]') ? 'var(--terminal-amber)' :
                                   message.includes('[SETUP]') ? 'var(--terminal-amber)' :
                                   message.includes('✓') ? 'var(--terminal-green)' :
                                   message.includes('✗') ? 'var(--terminal-red)' :
                                   message.includes('⚠') ? 'var(--terminal-amber)' :
                                   undefined
                        }}
                    >
                        {message}
                    </div>
                ))}
                {showCursor && (
                    <span 
                        className="cursor-blink"
                        style={{ color: getStatusColor(connectionStatus) }}
                    >
                        █
                    </span>
                )}
                {!showCursor && (
                    <span 
                        className="cursor-blink"
                        style={{ color: getStatusColor(connectionStatus) }}
                    >
                        &nbsp;
                    </span>
                )}
                
                {connectionStatus === 'connecting' && currentPhase === 'testing' && (
                    <div className="connection-indicator">
                        <span className="loading">CONNECTING</span>
                    </div>
                )}
            </div>
        </div>
    );
}