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

  // Initialize service
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new ElizaService(baseUrl, userIdRef.current, agentId);
    }
  }, [baseUrl, agentId]);

  // Connect to WebSocket
  useEffect(() => {
    // Prevent multiple connections
    if (socketRef.current?.connected) {
      console.log('[ElizaClient] Socket already connected, skipping');
      return;
    }

    // Connect to WebSocket
    const socket = io(baseUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
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
      setIsConnected(true);
      onConnectionChange?.(true);
    });

    socket.on('disconnect', () => {
      console.log('[ElizaClient] WebSocket disconnected');
      setIsConnected(false);
      onConnectionChange?.(false);
    });

    socket.on('error', (error) => {
      console.error('[ElizaClient] WebSocket error:', error);
      setError(error.toString());
    });

    // Add connection error handler
    socket.on('connect_error', (error) => {
      console.error('[ElizaClient] WebSocket connection error:', error.message);
      setError(`Connection error: ${error.message}`);
    });

    return () => {
      console.log('[ElizaClient] Cleaning up socket connection');
      socket.disconnect();
      socketRef.current = null;
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
          const history = await service.getChannelMessages(channel.id);
          console.log('[ElizaClient] Loaded message history:', history.length, 'messages');
          setMessages(history);
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
        const message: ElizaMessage = {
          id: data.id || data.messageId,
          authorId: data.senderId || data.authorId || data.author_id,
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
        
        // Add to messages list
        setMessages((prev) => [...prev, message]);
        
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

      // Add to local messages immediately
      setMessages((prev) => [...prev, message]);
      
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
