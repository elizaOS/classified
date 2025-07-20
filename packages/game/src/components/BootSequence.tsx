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
    // Skip boot sequence and immediately complete
    useEffect(() => {
        onComplete();
    }, [onComplete]);

    // Return empty div while skipping
    return <div className="boot-screen" />;

    /* ORIGINAL BOOT SEQUENCE CODE - COMMENTED OUT FOR NOW
    const [visibleLines, setVisibleLines] = useState<number>(0);
    const [showCursor, setShowCursor] = useState(true);
    const [currentPhase, setCurrentPhase] = useState<'boot' | 'connection' | 'testing'>('boot');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [messages, setMessages] = useState<string[]>(initialBootMessages);

    const testConnection = useCallback(async () => {
        setCurrentPhase('testing');
        
        try {
            // Test basic connectivity
            setMessages(prev => [...prev, '  Testing agent connectivity... [TESTING]']);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
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
            const response = await fetch('http://localhost:3000/api/server/health', {
                method: 'GET',
                timeout: 5000,
            } as any);
            return response.ok;
        } catch {
            return false;
        }
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
        if (connectionStatus === 'failed') {
            const handleKeyPress = (e: KeyboardEvent) => {
                setConnectionStatus('connecting');
                setCurrentPhase('testing');
                testConnection();
                document.removeEventListener('keydown', handleKeyPress);
            };

            document.addEventListener('keydown', handleKeyPress);
            return () => document.removeEventListener('keydown', handleKeyPress);
        }
    }, [connectionStatus, testConnection]);

    const getStatusColor = (status: ConnectionStatus) => {
        switch (status) {
            case 'connected': return 'var(--terminal-green)';
            case 'failed': return 'var(--terminal-red)';
            default: return 'var(--terminal-amber)';
        }
    };

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
                                   message.includes('✓') ? 'var(--terminal-green)' :
                                   message.includes('✗') ? 'var(--terminal-red)' :
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
    */
} 