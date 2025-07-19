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

  // Connect to WebSocket for real-time messages
  useEffect(() => {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ElizaClient] WebSocket connected');
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

    return () => {
      socket.disconnect();
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
          socketRef.current.emit('ROOM_JOINING', {
            channelId: channel.id,
            entityId: service.getUserId(),
            agentId: service.getAgentId(),
            serverId: channel.serverId,
            metadata: {
              isDm: true,
              channelType: 'dm',
            },
          });

          // Listen for messages on this channel
          socketRef.current.on('MESSAGE', (message: any) => {
            if (message.channelId === channel.id || message.roomId === channel.id) {
              console.log('[ElizaClient] Received message:', message);
              
              const formattedMessage: ElizaMessage = {
                id: message.id || message.messageId,
                content: message.text || message.content,
                authorId: message.senderId || message.authorId || message.author_id,
                authorName: message.senderName || 'Unknown',
                timestamp: new Date(message.createdAt || message.timestamp || message.created_at),
                metadata: {
                  ...message.metadata,
                  source: message.source,
                },
              };

              setMessages((prev) => [...prev, formattedMessage]);
              onMessage?.(formattedMessage);
            }
          });

          // Load message history
          const history = await service.getChannelMessages(channel.id);
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
