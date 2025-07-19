import { useEffect, useRef, useState, useCallback } from 'react';
import { ElizaClient } from '@elizaos/api-client';
import { UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import io, { Socket } from 'socket.io-client';

// Define types based on what the API returns
interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

interface MessageChannel {
  id: string;
  messageServerId: string;
  name: string;
  type: string;
  metadata?: Record<string, any>;
}

interface UseElizaClientOptions {
  baseUrl?: string;
  userId?: string;
  agentId?: string;
  onMessage?: (message: Message) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseElizaClientReturn {
  isConnected: boolean;
  dmChannel: MessageChannel | null;
  sendMessage: (content: string) => Promise<void>;
  messages: Message[];
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
  const [dmChannel, setDmChannel] = useState<MessageChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clientRef = useRef<ElizaClient | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string>(userId || uuidv4());

  // Initialize API client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = ElizaClient.create({ baseUrl });
    }
  }, [baseUrl]);

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
    if (!clientRef.current || !isConnected) return;

    const setupChannel = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const client = clientRef.current!;

        // Get or create DM channel using the proper API
        const channel = await client.messaging.getOrCreateDmChannel({
          participantIds: [userIdRef.current, agentId] as [UUID, UUID],
        });

        console.log('[ElizaClient] Got DM channel:', channel);
        setDmChannel(channel);

        // Join the WebSocket room for real-time updates
        if (socketRef.current) {
          socketRef.current.emit('ROOM_JOINING', {
            channelId: channel.id,
            entityId: userIdRef.current,
            agentId,
            serverId: channel.messageServerId,
            metadata: {
              isDm: true,
              channelType: 'dm',
            },
          });

          // Listen for messages on this channel
          socketRef.current.on('MESSAGE', (message: any) => {
            if (message.channelId === channel.id || message.roomId === channel.id) {
              console.log('[ElizaClient] Received message:', message);

              const formattedMessage: Message = {
                id: message.id || message.messageId,
                channelId: channel.id,
                authorId: message.senderId || message.authorId,
                content: message.text || message.content,
                createdAt: new Date(message.createdAt || message.timestamp),
                updatedAt: new Date(message.createdAt || message.timestamp),
                metadata: {
                  ...message.metadata,
                  senderName: message.senderName,
                  source: message.source,
                },
              };

              setMessages((prev) => [...prev, formattedMessage]);
              onMessage?.(formattedMessage);
            }
          });

          // Load message history
          const history = await client.messaging.getChannelMessages(channel.id);
          setMessages(history.messages);
        }
      } catch (err) {
        console.error('[ElizaClient] Failed to setup channel:', err);
        setError(err instanceof Error ? err.message : 'Failed to setup channel');
      } finally {
        setIsLoading(false);
      }
    };

    setupChannel();
  }, [isConnected, agentId, onMessage]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!clientRef.current || !dmChannel) {
        throw new Error('Not connected or no channel available');
      }

      try {
        setError(null);

        // Send via API
        const message = await clientRef.current.messaging.postMessage(
          dmChannel.id as UUID,
          content,
          {
            source: 'terminal_gui',
            userDisplayName: 'User',
          }
        );

        // Add to local messages immediately
        setMessages((prev) => [...prev, message]);

        console.log('[ElizaClient] Message sent:', message);
      } catch (err) {
        console.error('[ElizaClient] Failed to send message:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');
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
