import { useEffect, useState, useCallback, useRef } from 'react';
import { ElizaService, ElizaMessage, ElizaChannel } from '../services/ElizaService';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from '@elizaos/client';

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
  const socketManagerRef = useRef<WebSocketManager | null>(null);
  const userIdRef = useRef<string>(userId || uuidv4());
  const connectionStateRef = useRef<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const hasInitializedSocket = useRef(false);

  // Initialize service
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new ElizaService(baseUrl, userIdRef.current, agentId);
    }
  }, [baseUrl, agentId]);

  // Connect to WebSocket
  useEffect(() => {
    // Skip WebSocket connection if disabled (for testing)
    if (typeof window !== 'undefined' && localStorage.getItem('disableWebSocket') === 'true') {
      console.log('[ElizaClient] WebSocket disabled by localStorage flag');
      return;
    }

    // Prevent multiple connections
    if (hasInitializedSocket.current) {
      console.log('[ElizaClient] WebSocket already initialized');
      return;
    }

    hasInitializedSocket.current = true;

    // Get the singleton instance
    socketManagerRef.current = WebSocketManager.getInstance();
    const socket = socketManagerRef.current;

    console.log('[ElizaClient] Initializing WebSocket connection');

    // Initialize the WebSocket connection
    socket.initialize(userIdRef.current);

    // Define event listeners with stored references
    const handleConnect = () => {
      console.log('[ElizaClient] Connected to WebSocket');
      connectionStateRef.current = 'connected';
      setIsConnected(true);
      onConnectionChange?.(true);
    };

    const handleDisconnect = () => {
      console.log('[ElizaClient] WebSocket disconnected');
      connectionStateRef.current = 'disconnected';
      setIsConnected(false);
      onConnectionChange?.(false);
    };

    const handleError = (error: any) => {
      console.error('[ElizaClient] WebSocket error:', error);
      connectionStateRef.current = 'disconnected';
      setError(error.toString());
    };

    const handleConnectError = (error: any) => {
      console.error('[ElizaClient] WebSocket connection error:', error.message);
      connectionStateRef.current = 'disconnected';
      setError(`Connection error: ${error.message}`);
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    socket.on('connect_error', handleConnectError);

    return () => {
      console.log('[ElizaClient] Cleaning up socket connection');
      connectionStateRef.current = 'disconnected';
      hasInitializedSocket.current = false;

      // Remove event listeners
      if (socketManagerRef.current) {
        socketManagerRef.current.off('connect', handleConnect);
        socketManagerRef.current.off('disconnect', handleDisconnect);
        socketManagerRef.current.off('error', handleError);
        socketManagerRef.current.off('connect_error', handleConnectError);
      }
    };
  }, []); // Empty dependency array - only run once

  // Get or create DM channel
  useEffect(() => {
    if (!serviceRef.current || !isConnected) {
      return;
    }

    const setupChannel = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const service = serviceRef.current!;

        // Add a delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get or create DM channel
        const channel = await service.getOrCreateDmChannel();

        console.log('[ElizaClient] Got DM channel:', channel);
        setDmChannel(channel);

        // Join the WebSocket room for real-time updates
        if (socketManagerRef.current) {
          console.log('[ElizaClient] Joining WebSocket channel:', channel.id);

          // Use the WebSocketManager's joinChannel method
          await socketManagerRef.current.joinChannel(channel.id);

          // Load message history
          console.log('[ElizaClient] Loading message history for channel:', channel.id);
          try {
            const history = await service.getChannelMessages(channel.id);
            console.log('[ElizaClient] Loaded message history:', history.length, 'messages');
            if (history.length > 0) {
              console.log('[ElizaClient] First message:', history[0]);
              console.log('[ElizaClient] Last message:', history[history.length - 1]);
            }
            setMessages(history);
          } catch (historyError) {
            console.error('[ElizaClient] Failed to load message history:', historyError);
            // Continue without history - don't fail the whole setup
            setMessages([]);
          }
        }
      } catch (err) {
        console.error('[ElizaClient] Failed to setup channel:', err);
        setError(err instanceof Error ? err.message : 'Failed to setup channel');
      } finally {
        setIsLoading(false);
      }
    };

    setupChannel();
  }, [isConnected]); // Remove onMessage from dependencies

  // Set up message broadcast listener
  useEffect(() => {
    if (!socketManagerRef.current || !dmChannel) {
      return;
    }

    const handleMessageBroadcast = (data: any) => {
      console.log('[ElizaClient] Received messageBroadcast:', data);
      console.log('[ElizaClient] Current channel ID:', dmChannel.id);
      console.log('[ElizaClient] Message channel ID:', data.channelId || data.roomId);

      // Only process messages for our channel
      const messageChannelId = data.channelId || data.roomId;
      if (messageChannelId === dmChannel.id) {
        const messageAuthorId = data.senderId || data.authorId || data.author_id;

        // Skip our own messages - we already add them when sending
        if (messageAuthorId === userIdRef.current) {
          console.log('[ElizaClient] Skipping our own message that came back via broadcast');
          return;
        }

        const message: ElizaMessage = {
          id: data.id || data.messageId,
          authorId: messageAuthorId,
          authorName: data.senderName || 'Unknown',
          content: data.text || data.content,
          timestamp: new Date(data.createdAt || data.timestamp || Date.now()),
          metadata: {
            ...data.metadata,
            channelId: messageChannelId,
            source: data.source,
            thought: data.thought,
            actions: data.actions,
          },
        };

        console.log('[ElizaClient] Adding message to state:', message);

        // Add to messages list - check for duplicates by ID
        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m.id === message.id)) {
            console.log('[ElizaClient] Message already exists, skipping duplicate:', message.id);
            return prev;
          }
          return [...prev, message];
        });

        // Call the onMessage callback
        onMessage?.(message);
      } else {
        console.log('[ElizaClient] Ignoring message for different channel');
      }
    };

    console.log('[ElizaClient] Setting up messageBroadcast listener for channel:', dmChannel.id);
    socketManagerRef.current.on('messageBroadcast', handleMessageBroadcast);

    return () => {
      console.log('[ElizaClient] Cleaning up messageBroadcast listener');
      socketManagerRef.current?.off('messageBroadcast', handleMessageBroadcast);
    };
  }, [dmChannel, onMessage]);

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

        // Add to local messages immediately - check for duplicates
        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m.id === message.id)) {
            console.log(
              '[ElizaClient] Message already exists in sendMessage, skipping duplicate:',
              message.id
            );
            return prev;
          }
          return [...prev, message];
        });

        console.log('[ElizaClient] Message sent:', message);

        // The WebSocket broadcast will handle adding the agent's response
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        console.error('[ElizaClient] Failed to send message:', errorMessage);
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
