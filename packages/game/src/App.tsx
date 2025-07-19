import { useEffect, useState } from 'react';
import './styles/terminal.css';
import { useWebSocket } from './hooks/useWebSocket';
import ChatPanel from './components/ChatPanel';
import LogPanel from './components/LogPanel';
import BootSequence from './components/BootSequence';

function App() {
    // Check localStorage for skip boot flag (for testing)
    const skipBoot = localStorage.getItem('skipBoot') === 'true';
    const [bootComplete, setBootComplete] = useState(skipBoot);
    
    const { isConnected, messages, sendMessage, isLoading, socket } = useWebSocket();

    useEffect(() => {
        // Log connection status
        console.log('[App] Connection status:', isConnected);
    }, [isConnected]);

    useEffect(() => {
        console.log('[App] Boot complete state:', bootComplete);
    }, [bootComplete]);

    const handleBootComplete = () => {
        console.log('[App] Boot sequence completed, transitioning to main app');
        setBootComplete(true);
    };

    if (!bootComplete) {
        console.log('[App] Rendering boot sequence');
        return (
            <div className="app">
                <BootSequence onComplete={handleBootComplete} />
            </div>
        );
    }

    console.log('[App] Rendering main terminal interface');
    return (
        <div className="app">
            <div className="terminal-container">
                {/* Connection status indicator */}
                <div className={`connection-status glow ${isConnected ? 'connected' : 'disconnected'}`}>
                    {isConnected ? '● Online' : '○ Offline'}
                </div>

                {/* Main terminal layout */}
                <div className="terminal-layout">
                    {/* Left panel - Chat */}
                    <div className="panel panel-left chat-panel">
                        <ChatPanel 
                            messages={messages}
                            onSendMessage={sendMessage}
                            isLoading={isLoading}
                            isConnected={isConnected}
                        />
                    </div>

                    {/* Right panel - Logs/Tabs */}
                    <div className="panel panel-right log-panel">
                        <LogPanel 
                            socket={socket}
                            isConnected={isConnected}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App; 