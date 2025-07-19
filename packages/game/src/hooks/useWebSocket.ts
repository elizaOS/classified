import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SERVER_ID = '00000000-0000-0000-0000-000000000000';
const AGENT_ID = '00000000-0000-0000-0000-000000000001';
const SERVER_URL = 'http://localhost:3000';

export interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    isAgent: boolean;
}

export function useWebSocket() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [channelId, setChannelId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [shouldSendInitialMessage, setShouldSendInitialMessage] = useState(false);
    
    const userId = useRef(uuidv4()).current;
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const sendMessage = useCallback((text: string) => {
        if (!socket || !isConnected) {
            console.error('[WebSocket] Cannot send message: not connected');
            return;
        }

        const messageId = uuidv4();
        const dmChannelId = channelId || `dm_${userId}_${AGENT_ID}`;

        // Add user message to local state immediately
        const userMessage: Message = {
            id: messageId,
            text,
            senderId: userId,
            senderName: 'User',
            timestamp: new Date(),
            isAgent: false
        };
        setMessages(prev => [...prev, userMessage]);

        // Send message via socket
        socket.emit('2', { // SEND_MESSAGE = 2
            channelId: dmChannelId,
            serverId: DEFAULT_SERVER_ID,
            senderId: userId,
            senderName: 'User',
            message: text,
            messageId,
            source: 'terminal_gui',
            metadata: {
                isDm: true,
                channelType: 'dm',
                userDisplayName: 'User'
            }
        });

        console.log('[WebSocket] Message sent:', messageId);
        setIsLoading(true);
    }, [socket, isConnected, channelId, userId]);

    // Send initial message when ready
    useEffect(() => {
        if (shouldSendInitialMessage && socket && isConnected) {
            // Small delay to ensure everything is ready
            setTimeout(() => {
                sendMessage('The admin has opened the terminal');
                setShouldSendInitialMessage(false);
            }, 1000);
        }
    }, [shouldSendInitialMessage, socket, isConnected, sendMessage]);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io(SERVER_URL, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity,
        });

        newSocket.on('connect', async () => {
            console.log('[WebSocket] Connected to server');
            setIsConnected(true);

            // Clear any existing reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }

            // Create a simple DM channel ID
            const dmChannelId = `dm_${userId}_${AGENT_ID}`;
            setChannelId(dmChannelId);

            // Join the channel via socket
            newSocket.emit('1', { // ROOM_JOINING = 1
                channelId: dmChannelId,
                entityId: userId,
                serverId: DEFAULT_SERVER_ID,
                metadata: {
                    isDm: true,
                    channelType: 'dm',
                    userDisplayName: 'User'
                }
            });

            console.log('[WebSocket] Joined DM channel:', dmChannelId);

            // Schedule initial message
            setShouldSendInitialMessage(true);
        });

        newSocket.on('disconnect', () => {
            console.log('[WebSocket] Disconnected from server');
            setIsConnected(false);

            // Set a timeout to check if still disconnected after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                if (!newSocket.connected) {
                    console.log('[WebSocket] Still disconnected, attempting manual reconnect...');
                    newSocket.connect();
                }
            }, 5000);
        });

        newSocket.on('error', (error) => {
            console.error('[WebSocket] Socket error:', error);
        });

        newSocket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error.message);
        });

        // Handle channel joined confirmation
        newSocket.on('channel_joined', (data) => {
            console.log('[WebSocket] Channel joined confirmed:', data);
        });

        // Handle message acknowledgment
        newSocket.on('messageAck', (data) => {
            console.log('[WebSocket] Message acknowledged:', data);
        });

        // Handle incoming messages
        newSocket.on('message', (data) => {
            console.log('[WebSocket] Message received:', data);
            
            // Handle error messages
            if (data.type === 'error') {
                console.error('[WebSocket] Error message received:', data.payload);
                setIsLoading(false);
                // Optionally show error to user
                if (data.payload?.message) {
                    const errorMessage: Message = {
                        id: uuidv4(),
                        text: `Error: ${data.payload.message}`,
                        senderId: 'system',
                        senderName: 'System',
                        timestamp: new Date(),
                        isAgent: false
                    };
                    setMessages(prev => [...prev, errorMessage]);
                }
                return;
            }
            
            // Handle different message formats
            let messageText = '';
            let messageSenderId = data.senderId || data.userId;
            let messageSenderName = data.senderName || 'Unknown';
            
            if (typeof data.message === 'string') {
                messageText = data.message;
            } else if (data.text) {
                messageText = data.text;
            } else if (data.content?.text) {
                messageText = data.content.text;
            }

            if (!messageText) {
                console.warn('[WebSocket] Received message with no text:', data);
                return;
            }

            const newMessage: Message = {
                id: data.messageId || data.id || uuidv4(),
                text: messageText,
                senderId: messageSenderId,
                senderName: messageSenderName,
                timestamp: new Date(data.timestamp || Date.now()),
                isAgent: messageSenderId === AGENT_ID || messageSenderName === 'Terminal'
            };

            setMessages(prev => [...prev, newMessage]);
            
            if (newMessage.isAgent) {
                setIsLoading(false);
            }
        });

        // Also listen for messageBroadcast event (alternative event name)
        newSocket.on('messageBroadcast', (data) => {
            console.log('[WebSocket] Message broadcast received:', data);
            newSocket.emit('message', data); // Re-emit as 'message' to use same handler
        });

        // Handle errors
        newSocket.on('messageError', (error) => {
            console.error('[WebSocket] Message error:', error);
            setIsLoading(false);
        });

        setSocket(newSocket);

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            newSocket.disconnect();
        };
    }, [userId]);

    return {
        isConnected,
        messages,
        sendMessage,
        isLoading,
        channelId,
        userId,
        agentId: AGENT_ID,
        socket
    };
} 