import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';

interface TauriInitializerProps {
  children: React.ReactNode;
}

const logger = createLogger('TauriInitializer');

// This component initializes the Tauri environment and handles window events

export function TauriInitializer({ children }: TauriInitializerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [shutdownMessage, setShutdownMessage] = useState('Shutting down...');

  useEffect(() => {
    const initializeTauri = async () => {
      logger.info('Initializing Tauri environment');

      try {
        // Check if we're in a Tauri environment
        if (!(window as any).__TAURI__) {
          logger.warn('Not running in Tauri environment');
          setIsInitialized(true);
          return;
        }

        logger.info('Tauri environment detected');

        // Import Tauri modules dynamically
        const { event } = await import('@tauri-apps/api');

        // Listen for window close request
        await event.listen('tauri://close-requested', async () => {
          logger.info('Close requested');
          // You can perform cleanup here if needed
        });

        // Listen for shutdown event from backend
        if (typeof (window as any).__TAURI__?.event?.listen === 'function') {
          const unlistenShutdown = await event.listen('shutdown', async () => {
            logger.info('Shutdown event received');
            setIsShuttingDown(true);
            // Give time for UI to update before closing
            setTimeout(async () => {
              if ((window as any).__TAURI__?.window?.appWindow) {
                await (window as any).__TAURI__.window.appWindow.close();
              }
            });
          });

          // Listen for shutdown progress
          const unlistenProgress = await event.listen('shutdown-progress', (evt: any) => {
            logger.info('Shutdown progress:', evt.payload);
            setShutdownMessage(evt.payload);
          });

          // Store unlisten functions for cleanup
          (window as any).__shutdownUnlisten = unlistenShutdown;
          (window as any).__progressUnlisten = unlistenProgress;
        }

        setIsInitialized(true);
      } catch (err) {
        logger.error('Failed to initialize Tauri:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Tauri');
        // Still mark as initialized to allow the app to continue
        setIsInitialized(true);
      }
    };

    // Use a timeout to ensure we're not blocking on window load
    const timeoutId = setTimeout(initializeTauri, 0);

    return () => {
      clearTimeout(timeoutId);
      // Clean up shutdown listener if it exists
      if ((window as any).__shutdownUnlisten) {
        (window as any).__shutdownUnlisten();
      }
      if ((window as any).__progressUnlisten) {
        (window as any).__progressUnlisten();
      }
    };
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center h-screen bg-black text-terminal-green font-mono">
        <div>Initializing Tauri environment...</div>
      </div>
    );
  }

  if (error) {
    logger.warn('Continuing with error', { error });
  }

  // Show shutdown UI when shutting down
  if (isShuttingDown) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white font-sans">
        <div className="text-center">
          <h2 className="text-2xl mb-5">Shutting Down ElizaOS</h2>
          <p className="text-base text-gray-300 mb-5">
            {shutdownMessage}
          </p>
          <div className="w-10 h-10 border-[3px] border-gray-700 border-t-white animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}