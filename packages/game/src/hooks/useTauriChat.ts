import { useState, useEffect } from 'react';
import { TauriService, TauriMessage } from '../services/TauriService';

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
      setIsLoading(true);

      // Initialize Tauri service
      await TauriService.initialize();

      // Check if we're in Tauri environment
      if (TauriService.isRunningInTauri()) {
        setIsConnected(true);

        // Load initial messages if any
        const initialMessages = await TauriService.fetchMemories();
        setMessages(initialMessages);
      } else {
        setError('Not running in Tauri environment');
      }

      setIsLoading(false);
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

  const sendMessage = async (content: string) => {
    await TauriService.sendMessage(content);
  };

  return {
    isConnected,
    sendMessage,
    messages,
    error,
    isLoading,
  };
}
