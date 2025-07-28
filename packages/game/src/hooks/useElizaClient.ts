import { useEffect, useState, useCallback, useRef } from 'react';
import { ElizaService, ElizaMessage, ElizaChannel } from '../services/ElizaService';
import { v4 as uuidv4 } from 'uuid';

interface UseElizaClientOptions {
  baseUrl?: string;
  userId?: string;
  agentId?: string;
  onMessage?: (message: ElizaMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseElizaClientReturn {
  isConnected: boolean;
  dmChannel: ElizaChannel | null;
  sendMessage: (content: string) => Promise<void>;
  messages: ElizaMessage[];
  error: string | null;
  isLoading: boolean;
}

export function useElizaClient({
  baseUrl = 'http://localhost:7777',
  userId,
  agentId = '2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f',
  onMessage,
  onConnectionChange,
}: UseElizaClientOptions): UseElizaClientReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [dmChannel, setDmChannel] = useState<ElizaChannel | null>(null);
  const [messages, setMessages] = useState<ElizaMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const serviceRef = useRef<ElizaService | null>(null);
  const userIdRef = useRef<string>(userId || uuidv4());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize service
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new ElizaService(baseUrl, userIdRef.current, agentId);
    }

    return () => {
      // Cleanup on unmount
      if (serviceRef.current) {
        serviceRef.current.cleanup();
      }
    };
  }, [baseUrl, agentId]);

  // Setup message listener
  useEffect(() => {
    if (!serviceRef.current) return;

    // Subscribe to messages from the service
    unsubscribeRef.current = serviceRef.current.onMessage((message: ElizaMessage) => {
      console.log('[useElizaClient] Received message:', message);
      
      // Add to messages list
      setMessages((prev) => {
        // Check for duplicates by ID
        if (prev.some((m) => m.id === message.id)) {
          console.log('[useElizaClient] Skipping duplicate message:', message.id);
          return prev;
        }
        return [...prev, message];
      });

      // Call the onMessage callback
      onMessage?.(message);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [onMessage]);

  // Check connection and setup channel
  useEffect(() => {
    const checkConnection = async () => {
      if (!serviceRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        // Check if we can ping the service
        const connected = await serviceRef.current.ping();
        setIsConnected(connected);
        onConnectionChange?.(connected);

        if (connected) {
          // Get or create DM channel
          const channel = await serviceRef.current.getOrCreateDmChannel();
          console.log('[useElizaClient] Got DM channel:', channel);
          setDmChannel(channel);

          // Load message history
          try {
            const history = await serviceRef.current.getChannelMessages(channel.id);
            console.log('[useElizaClient] Loaded message history:', history.length, 'messages');
            setMessages(history);
          } catch (historyError) {
            console.error('[useElizaClient] Failed to load message history:', historyError);
            // Continue without history
            setMessages([]);
          }
        }
      } catch (err) {
        console.error('[useElizaClient] Connection check failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
        setIsConnected(false);
        onConnectionChange?.(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial connection check
    checkConnection();

    // Periodic connection check
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [onConnectionChange]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!serviceRef.current || !dmChannel) {
        throw new Error('Not connected or no channel available');
      }

      try {
        setError(null);

        // Send via service
        const message = await serviceRef.current.sendMessage(dmChannel.id, content);

        // Add to local messages immediately for better UX
        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m.id === message.id)) {
            console.log('[useElizaClient] Message already exists, skipping duplicate:', message.id);
            return prev;
          }
          return [...prev, message];
        });

        console.log('[useElizaClient] Message sent:', message);

        // The agent's response will come through the message listener
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        console.error('[useElizaClient] Failed to send message:', errorMessage);
        setError(errorMessage);
        throw err;
      }
    },
    [dmChannel]
  );

  return {
    isConnected,
    dmChannel,
    sendMessage,
    messages,
    error,
    isLoading,
  };
}
