import { useState } from 'react';
import './styles/terminal.css';
import { Terminal } from './components/Terminal';
import BootSequence from './components/BootSequence';
import { debugWebSockets } from './utils/debugWebSockets';
import { blockOldMessages } from './utils/blockOldMessages';

// Start WebSocket debugging immediately
debugWebSockets();
blockOldMessages();

function App() {
    // Check localStorage for skip boot flag (for testing)
    const skipBoot = localStorage.getItem('skipBoot') === 'true';
    const [bootComplete, setBootComplete] = useState(skipBoot);

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
            <Terminal />
        </div>
    );
}

export default App; 