import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import BootSequence from './components/BootSequence';
import { GameInterface } from './components/GameInterface';
import { debugWebSockets } from './utils/debugWebSockets';
import { blockOldMessages } from './utils/blockOldMessages';

// Start WebSocket debugging immediately
debugWebSockets();
blockOldMessages();

function App() {
    // Check if we should skip boot (for testing)
    const skipBoot = localStorage.getItem('skipBoot') === 'true';
    const [bootComplete, setBootComplete] = useState(skipBoot);

    // Clear skipBoot flag after reading it
    useEffect(() => {
        if (skipBoot) {
            localStorage.removeItem('skipBoot');
        }
    }, [skipBoot]);

    const handleBootComplete = () => {
        console.log('[App] Boot sequence completed, transitioning to main app');
        setBootComplete(true);
    };

    // Connection test for boot sequence
    const testAgentConnection = useCallback(async (): Promise<boolean> => {
        try {
            // Test basic ElizaOS server connectivity
            const healthResponse = await fetch('http://localhost:7777/api/server/health', {
                method: 'GET',
                timeout: 5000,
            } as any);
            
            if (!healthResponse.ok) {
                console.warn('[App] Health check failed');
                return false;
            }

            // Test specific plugin endpoints
            const autonomyResponse = await fetch('http://localhost:7777/autonomy/status', {
                method: 'GET',
                timeout: 7777,
            } as any);

            // Connection is considered successful if either health or autonomy responds
            const isConnected = healthResponse.ok || autonomyResponse.ok;
            console.log('[App] Connection test result:', isConnected);
            
            return isConnected;
        } catch (error) {
            console.warn('[App] Connection test failed:', error);
            return false;
        }
    }, []);

    if (!bootComplete) {
        console.log('[App] Rendering boot sequence');
        return (
            <div className="app">
                <BootSequence 
                    onComplete={handleBootComplete}
                    onConnectionTest={testAgentConnection}
                />
            </div>
        );
    }

    console.log('[App] Rendering main game interface');
    return (
        <div className="app">
            <GameInterface />
        </div>
    );
}

export default App; 