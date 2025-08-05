import { useState, useEffect } from 'react';

import StartupFlow from './components/StartupFlow';
import GameInterface from './components/GameInterface';
import { TauriInitializer } from './components/TauriInitializer';
import { debugWebSockets } from './utils/debugWebSockets';
import { blockOldMessages } from './utils/blockOldMessages';
import { createLogger } from './utils/logger';
import { ErrorBoundary } from './components/ErrorBoundary';

// Create component logger
const logger = createLogger('App');

// Start WebSocket debugging immediately
debugWebSockets();
blockOldMessages();

function App() {
  // Check if we should skip startup (for testing)
  const skipStartup = localStorage.getItem('skipStartup') === 'true';
  const [startupComplete, setStartupComplete] = useState(skipStartup);

  // Clear skipStartup flag after reading it
  useEffect(() => {
    if (skipStartup) {
      localStorage.removeItem('skipStartup');
    }
  }, [skipStartup]);

  const handleStartupComplete = () => {
    logger.info('Startup flow completed, transitioning to main interface');
    setStartupComplete(true);
  };

  if (!startupComplete) {
    logger.debug('Rendering startup flow');
    return (
      <ErrorBoundary>
        <TauriInitializer>
          <div className="h-full">
            <StartupFlow onComplete={handleStartupComplete} />
          </div>
        </TauriInitializer>
      </ErrorBoundary>
    );
  }

  logger.debug('Rendering main game interface');
  return (
    <ErrorBoundary>
      <TauriInitializer>
        <div className="h-full">
          <GameInterface />
        </div>
      </TauriInitializer>
    </ErrorBoundary>
  );
}

export default App;
