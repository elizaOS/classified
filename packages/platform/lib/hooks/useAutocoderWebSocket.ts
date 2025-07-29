'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '@/components/autocoder/AgentChat';
import { BuildLog } from '@/components/autocoder/AutocoderWorkspace';

interface WebSocketMessage {
  type: string;
  event?: string;
  projectId?: string;
  message?: string;
  timestamp?: number;
  data?: any;
  id?: string;
  engineerId?: string;
  phase?: string;
  agentStatus?: string;
}

interface ProjectUpdate {
  projectId: string;
  updates: {
    status?: string;
    specification?: any;
    result?: any;
    [key: string]: any;
  };
}

interface UseAutocoderWebSocketReturn {
  isConnected: boolean;
  messages: ChatMessage[];
  sendMessage: (message: WebSocketMessage) => void;
  projectUpdates: ProjectUpdate[];
  buildLogs: BuildLog[];
  subscribe: (projectId: string) => void;
  unsubscribe: (projectId: string) => void;
  clearMessages: () => void;
}

export function useAutocoderWebSocket(
  userId: string,
): UseAutocoderWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>([]);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [subscribedProjects, setSubscribedProjects] = useState<Set<string>>(
    new Set(),
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelayMs = 3000;

  const connect = useCallback(() => {
    try {
      // Use wss:// for production, ws:// for development
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/autocoder/ws?userId=${userId}`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('AutoCoder WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Resubscribe to projects
        subscribedProjects.forEach((projectId) => {
          wsRef.current?.send(
            JSON.stringify({
              type: 'SUBSCRIBE_PROJECT',
              projectId,
            }),
          );
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log(
          'AutoCoder WebSocket disconnected:',
          event.code,
          event.reason,
        );
        setIsConnected(false);

        // Attempt to reconnect if not intentionally closed
        if (
          event.code !== 1000 &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          reconnectAttempts.current += 1;
          console.log(
            `Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelayMs * reconnectAttempts.current);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('AutoCoder WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to AutoCoder WebSocket:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, subscribedProjects]);

  const handleMessage = useCallback((data: WebSocketMessage) => {
    switch (data.type) {
      case 'AGENT_MESSAGE':
        if (data.projectId && data.message) {
          const newMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            projectId: data.projectId,
            type: 'agent',
            message: data.message,
            timestamp: data.timestamp || Date.now(),
            metadata: data.data?.metadata,
          };
          setMessages((prev) => [...prev, newMessage]);
        }
        break;

      case 'USER_MESSAGE':
        if (data.projectId && data.message) {
          const newMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            projectId: data.projectId,
            type: 'user',
            message: data.message,
            timestamp: data.timestamp || Date.now(),
          };
          setMessages((prev) => [...prev, newMessage]);
        }
        break;

      case 'SYSTEM_MESSAGE':
        if (data.projectId && data.message) {
          const newMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random()}`,
            projectId: data.projectId,
            type: 'system',
            message: data.message,
            timestamp: data.timestamp || Date.now(),
          };
          setMessages((prev) => [...prev, newMessage]);
        }
        break;

      case 'PROJECT_UPDATE':
        if (data.projectId && data.data?.updates) {
          const update: ProjectUpdate = {
            projectId: data.projectId,
            updates: data.data.updates,
          };
          setProjectUpdates((prev) => [...prev, update]);
        }
        break;

      case 'BUILD_LOG':
        if (data.data?.log) {
          const log: BuildLog = {
            id: data.data.log.id || `log-${Date.now()}-${Math.random()}`,
            projectId: data.projectId || '',
            timestamp: data.data.log.timestamp
              ? new Date(data.data.log.timestamp)
              : new Date(),
            level: data.data.log.level || 'info',
            message: data.data.log.message || '',
            source: data.data.log.source || 'autocoder',
          };
          setBuildLogs((prev) => [...prev, log]);
        }
        break;

      case 'PING':
        // Respond to server ping with pong
        wsRef.current?.send(JSON.stringify({ type: 'PONG' }));
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));

      // Add user messages to local state immediately
      if (
        message.type === 'AGENT_MESSAGE' &&
        message.projectId &&
        message.message
      ) {
        const userMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          projectId: message.projectId,
          type: 'user',
          message: message.message,
          timestamp: message.timestamp || Date.now(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }, []);

  const subscribe = useCallback((projectId: string) => {
    setSubscribedProjects((prev) => new Set([...prev, projectId]));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SUBSCRIBE_PROJECT',
          projectId,
        }),
      );
    }
  }, []);

  const unsubscribe = useCallback((projectId: string) => {
    setSubscribedProjects((prev) => {
      const newSet = new Set(prev);
      newSet.delete(projectId);
      return newSet;
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'UNSUBSCRIBE_PROJECT',
          projectId,
        }),
      );
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setProjectUpdates([]);
    setBuildLogs([]);
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setSubscribedProjects(new Set());
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Heartbeat to maintain connection
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const heartbeatInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000); // Send ping every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [isConnected]);

  // Log connection state changes
  useEffect(() => {
    console.log(
      `AutoCoder WebSocket ${isConnected ? 'connected' : 'disconnected'}`,
    );
  }, [isConnected]);

  return {
    isConnected,
    messages,
    sendMessage,
    projectUpdates,
    buildLogs,
    subscribe,
    unsubscribe,
    clearMessages,
  };
}
