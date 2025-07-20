import { useEffect, useRef, useState, useCallback } from 'react';
import { ElizaService, ElizaMessage, ElizaChannel } from '../services/ElizaService';
import { v4 as uuidv4 } from 'uuid';
import io, { Socket } from 'socket.io-client';

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
  baseUrl = 'http://localhost:3000',
  userId,
  agentId = '00000000-0000-0000-0000-000000000001',
  onMessage,
  onConnectionChange,
}: UseElizaClientOptions): UseElizaClientReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [dmChannel, setDmChannel] = useState<ElizaChannel | null>(null);
  const [messages, setMessages] = useState<ElizaMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const serviceRef = useRef<ElizaService | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string>(userId || uuidv4());
  const connectionStateRef = useRef<'disconnected' | 'connecting' | 'connected'>('disconnected');

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

    // Add a debounce delay to prevent rapid connect/disconnect cycles
    let connectTimeout: NodeJS.Timeout;
    let isCleanedUp = false;

    // Prevent multiple connections
    if (socketRef.current) {
      console.log('[ElizaClient] Socket already exists, cleaning up first');
      socketRef.current.disconnect();
      socketRef.current = null;
      connectionStateRef.current = 'disconnected';
    }

    // Check if we're already in the process of connecting
    if (connectionStateRef.current === 'connecting') {
      console.log('[ElizaClient] Connection already in progress, skipping');
      return;
    }

    connectionStateRef.current = 'connecting';

    // Debounce connection attempts to avoid rapid cycling
    connectTimeout = setTimeout(() => {
      if (isCleanedUp || connectionStateRef.current !== 'connecting') return;

      console.log('[ElizaClient] Creating new socket connection');
      
      // Connect to WebSocket with rate limit-friendly settings
      const socket = io(baseUrl, {
        reconnection: true,
        reconnectionDelay: 5000, // Increased from 2000 to avoid rate limiting
        reconnectionDelayMax: 30000, // Max delay between reconnection attempts
        reconnectionAttempts: 5, // Increased from 3
        timeout: 20000, // Increased from 10000
        forceNew: true, // Force new connection to avoid reusing stale connections
        transports: ['websocket'], // Use only websocket transport
      });

      socketRef.current = socket;

      // Add debugging for all socket events
      socket.onAny((eventName, ...args) => {
        console.log(`[ElizaClient] Socket event: ${eventName}`, args);
        
        // Check if this is a SEND_MESSAGE event
        if (eventName === 'SEND_MESSAGE') {
          console.error('[ElizaClient] SEND_MESSAGE event detected!');
          console.trace();
        }
      });

      socket.on('connect', () => {
        console.log('[ElizaClient] Connected to WebSocket');
        connectionStateRef.current = 'connected';
        setIsConnected(true);
        onConnectionChange?.(true);
      });

      socket.on('disconnect', () => {
        console.log('[ElizaClient] WebSocket disconnected');
        connectionStateRef.current = 'disconnected';
        setIsConnected(false);
        onConnectionChange?.(false);
      });

      socket.on('error', (error) => {
        console.error('[ElizaClient] WebSocket error:', error);
        connectionStateRef.current = 'disconnected';
        setError(error.toString());
      });

      // Add connection error handler
      socket.on('connect_error', (error) => {
        console.error('[ElizaClient] WebSocket connection error:', error.message);
        connectionStateRef.current = 'disconnected';
        setError(`Connection error: ${error.message}`);
      });
    }, 2000); // Increased debounce delay to 2 seconds

    return () => {
      console.log('[ElizaClient] Cleaning up socket connection');
      isCleanedUp = true;
      clearTimeout(connectTimeout);
      connectionStateRef.current = 'disconnected';
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [baseUrl, onConnectionChange]);

  // Get or create DM channel
  useEffect(() => {
    if (!serviceRef.current || !isConnected) return;

    const setupChannel = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const service = serviceRef.current!;
        
        // Add a delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get or create DM channel
        const channel = await service.getOrCreateDmChannel();

        console.log('[ElizaClient] Got DM channel:', channel);
        setDmChannel(channel);

        // Join the WebSocket room for real-time updates
        if (socketRef.current) {
          console.log('[ElizaClient] Joining WebSocket room for channel:', channel.id);
          
          // Emit the room joining event using the correct format
          socketRef.current.emit('message', {
            type: 1, // SOCKET_MESSAGE_TYPE.ROOM_JOINING
            payload: {
              channelId: channel.id,
              roomId: channel.id, // Keep for backward compatibility
              entityId: service.getUserId(),
            },
          });

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
  }, [isConnected, onMessage]);

  // Set up message broadcast listener
  useEffect(() => {
    if (!socketRef.current || !dmChannel) return;

    const handleMessageBroadcast = (data: any) => {
      console.log('[ElizaClient] Received messageBroadcast:', data);
      console.log('[ElizaClient] Current channel ID:', dmChannel.id);
      console.log('[ElizaClient] Message channel ID:', data.channelId || data.roomId);
      
      // Only process messages for our channel
      const messageChannelId = data.channelId || data.roomId;
      if (messageChannelId === dmChannel.id) {
        const messageAuthorId = data.senderId || data.authorId || data.author_id;
        
        // Skip our own messages - we already add them when sending
        if (messageAuthorId === serviceRef.current?.getUserId()) {
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
          if (prev.some(m => m.id === message.id)) {
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
    socketRef.current.on('messageBroadcast', handleMessageBroadcast);

    // Also listen for debug events
    socketRef.current.on('messageAck', (data: any) => {
      console.log('[ElizaClient] Received messageAck:', data);
    });

    socketRef.current.on('messageError', (data: any) => {
      console.error('[ElizaClient] Received messageError:', data);
    });

    return () => {
      console.log('[ElizaClient] Cleaning up messageBroadcast listener');
      socketRef.current?.off('messageBroadcast', handleMessageBroadcast);
      socketRef.current?.off('messageAck');
      socketRef.current?.off('messageError');
    };
  }, [dmChannel, onMessage]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
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
        if (prev.some(m => m.id === message.id)) {
          console.log('[ElizaClient] Message already exists in sendMessage, skipping duplicate:', message.id);
          return prev;
        }
        return [...prev, message];
      });
      
      console.log('[ElizaClient] Message sent:', message);
    } catch (err) {
      console.error('[ElizaClient] Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      throw err;
    }
  }, [dmChannel]);

  return {
    isConnected,
    dmChannel,
    sendMessage,
    messages,
    error,
    isLoading,
  };
}
