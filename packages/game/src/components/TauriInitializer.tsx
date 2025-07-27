import { useEffect, useState } from 'react';
import { TauriService } from '../services/TauriService';

interface TauriInitializerProps {
  children: React.ReactNode;
}

/**
 * Component that ensures Tauri API is initialized before rendering children
 * This solves the timing issue where TauriService tries to detect Tauri before it's available
 */
export function TauriInitializer({ children }: TauriInitializerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeTauri = async () => {
      try {
        console.log('[TauriInitializer] Starting Tauri initialization...');

        // Wait a bit to ensure window is fully loaded
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Initialize TauriService
        await TauriService.initialize();

        const isTauri = TauriService.isRunningInTauri();
        console.log('[TauriInitializer] Tauri initialized, running in Tauri:', isTauri);

        setIsInitialized(true);
      } catch (err) {
        console.error('[TauriInitializer] Failed to initialize Tauri:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize Tauri');
        // Still mark as initialized to allow the app to continue
        setIsInitialized(true);
      }
    };

    // Use a timeout to ensure we're not blocking on window load
    const timeoutId = setTimeout(initializeTauri, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  if (!isInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#0a0a0a',
          color: '#00ff00',
          fontFamily: 'monospace',
        }}
      >
        <div>Initializing Tauri environment...</div>
      </div>
    );
  }

  if (error) {
    console.warn('[TauriInitializer] Continuing with error:', error);
  }

  return <>{children}</>;
}
