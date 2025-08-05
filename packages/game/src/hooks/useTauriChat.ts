import { useState, useEffect } from 'react';
import { TauriService } from '../services/TauriService';
import { TauriMessage } from '../types/shared';

interface UseTauriChatReturn {
  isConnected: boolean;
  sendMessage: (content: string) => Promise<void>;
  messages: TauriMessage[];
  error: string | null;
  isLoading: boolean;
}

// Hook for using Tauri-based chat functionality
export function useTauriChat(): UseTauriChatReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<TauriMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Give TauriService a moment to detect Tauri environment
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Initialize Tauri service
        await TauriService.initialize();

        // Check if we're in Tauri environment
        if (TauriService.isRunningInTauri()) {
          setIsConnected(true);

          // Load initial messages if any
          try {
            const initialMessages = await TauriService.fetchMemories();
            setMessages(initialMessages);
          } catch (error) {
            console.warn('[CHAT] Failed to load initial messages:', error);
            // Don't fail initialization if we can't load messages
            setMessages([]);
          }

          // Auto-send greeting message after confirming services are ready
          setTimeout(async () => {
            try {
              console.log('[AUTO-GREETING] Checking if agent and Ollama are ready...');

              // Check agent health
              const agentHealth = await TauriService.checkAgentHealth();
              console.log('[AUTO-GREETING] Agent health:', agentHealth);

              // If agent is healthy, send greeting
              if (agentHealth && agentHealth.status === 'healthy') {
                console.log('[AUTO-GREETING] Sending hello message to Eliza...');
                await TauriService.sendMessage('hello eliza');
                console.log('[AUTO-GREETING] Greeting sent successfully');
              } else {
                console.log('[AUTO-GREETING] Agent not ready, skipping auto-greeting');
              }
            } catch (error) {
              console.warn('[AUTO-GREETING] Failed to send auto-greeting:', error);
            }
          }, 2000); // Wait 2 seconds for services to be fully ready
        } else {
          setError('Not running in Tauri environment');
          setIsConnected(false);
        }
      } catch (error) {
        console.error('[CHAT] Failed to initialize chat:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize chat');
        setIsConnected(false);
      } finally {
        // Always set loading to false, even if there's an error
        setIsLoading(false);
      }
    };

    initialize();

    // Set up message listener
    const unsubscribe = TauriService.onMessage((message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Reset loading state if it gets stuck
  useEffect(() => {
    if (isLoading) {
      const resetTimeout = setTimeout(() => {
        console.warn('[CHAT] Loading state stuck - forcing reset');
        setIsLoading(false);
      }, 15000); // 15 second failsafe

      return () => clearTimeout(resetTimeout);
    }
  }, [isLoading]);

  const sendMessage = async (content: string) => {
    // Set a timeout to prevent stuck loading state
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
      console.warn('[CHAT] Message sending timeout - resetting loading state');
    }, 10000); // 10 second timeout

    try {
      setIsLoading(true);
      await TauriService.sendMessage(content);
    } catch (error) {
      console.error('[CHAT] Failed to send message:', error);
      throw error; // Re-throw so the component can handle it
    } finally {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
    }
  };

  return {
    isConnected,
    sendMessage,
    messages,
    error,
    isLoading,
  };
}
