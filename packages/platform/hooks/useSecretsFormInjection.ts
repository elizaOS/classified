'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';

export interface SecretsFormRequest {
  id: string;
  title: string;
  description: string;
  secrets: Array<{
    key: string;
    name: string;
    description: string;
    required: boolean;
    type: 'text' | 'password' | 'url' | 'token';
    validation?: string;
    placeholder?: string;
  }>;
  projectId?: string;
  context: {
    action: string;
    details: string;
    priority: 'low' | 'medium' | 'high';
  };
}

interface SecretsFormMessage {
  type: 'INJECT_SECRETS_FORM' | 'FORM_COMPLETED' | 'FORM_CANCELLED';
  data: {
    formRequest?: SecretsFormRequest;
    formUrl?: string;
    formId?: string;
    secrets?: Record<string, string>;
    timestamp: string;
    projectId?: string;
  };
}

interface UseSecretsFormInjectionReturn {
  activeForm: SecretsFormRequest | null;
  isFormOpen: boolean;
  handleFormSubmit: (secrets: Record<string, string>) => Promise<void>;
  handleFormCancel: () => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  formHistory: SecretsFormRequest[];
}

export const useSecretsFormInjection = (
  projectId?: string,
  enableToasts: boolean = true,
): UseSecretsFormInjectionReturn => {
  const [activeForm, setActiveForm] = useState<SecretsFormRequest | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('disconnected');
  const [formHistory, setFormHistory] = useState<SecretsFormRequest[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: SecretsFormMessage) => {
      console.log('Received WebSocket message:', message);

      switch (message.type) {
        case 'INJECT_SECRETS_FORM':
          if (message.data.formRequest) {
            setActiveForm(message.data.formRequest);
            setIsFormOpen(true);
            setFormHistory((prev) => [
              message.data.formRequest!,
              ...prev.slice(0, 9),
            ]); // Keep last 10

            if (enableToasts) {
              toast('Configuration required', {
                icon: '🔐',
                duration: 4000,
                id: `form-${message.data.formRequest.id}`,
              });
            }
          }
          break;

        case 'FORM_COMPLETED':
          if (enableToasts) {
            toast.success('Configuration saved successfully!', {
              duration: 3000,
              id: 'form-completed',
            });
          }
          break;

        case 'FORM_CANCELLED':
          if (enableToasts) {
            toast('Configuration cancelled', {
              icon: '❌',
              duration: 2000,
              id: 'form-cancelled',
            });
          }
          break;

        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    },
    [enableToasts],
  );

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      setConnectionStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;

        if (enableToasts) {
          toast.success('Connected to real-time updates', {
            duration: 2000,
            id: 'ws-connected',
          });
        }

        // Send identification message if projectId is available
        if (projectId) {
          ws.send(
            JSON.stringify({
              type: 'IDENTIFY',
              data: { projectId, clientType: 'autocoder_workspace' },
            }),
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: SecretsFormMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');

        if (enableToasts) {
          toast.error('Connection error occurred', {
            id: 'ws-error',
          });
        }
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt to reconnect if not intentionally closed
        if (
          !event.wasClean &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000,
          );
          reconnectAttempts.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`,
            );
            initializeWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          if (enableToasts) {
            toast.error('Connection lost. Please refresh the page.', {
              duration: 0,
              id: 'ws-disconnected',
            });
          }
        }
      };
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      setConnectionStatus('error');
    }
  }, [projectId, enableToasts, handleWebSocketMessage]);

  // Handle form submission
  const handleFormSubmit = useCallback(
    async (secrets: Record<string, string>) => {
      if (!activeForm || !wsRef.current) {
        throw new Error('No active form or WebSocket connection');
      }

      try {
        // Send form completion message
        const message: SecretsFormMessage = {
          type: 'FORM_COMPLETED',
          data: {
            formId: activeForm.id,
            secrets,
            projectId: activeForm.projectId || projectId,
            timestamp: new Date().toISOString(),
          },
        };

        wsRef.current.send(JSON.stringify(message));

        // Close the form
        setIsFormOpen(false);

        // Clear active form after a delay to allow for success animation
        setTimeout(() => {
          setActiveForm(null);
        }, 2000);
      } catch (error) {
        console.error('Error submitting form:', error);
        throw error;
      }
    },
    [activeForm, projectId],
  );

  // Handle form cancellation
  const handleFormCancel = useCallback(() => {
    if (!activeForm || !wsRef.current) {
      setIsFormOpen(false);
      setActiveForm(null);
      return;
    }

    try {
      // Send form cancellation message
      const message: SecretsFormMessage = {
        type: 'FORM_CANCELLED',
        data: {
          formId: activeForm.id,
          projectId: activeForm.projectId || projectId,
          timestamp: new Date().toISOString(),
        },
      };

      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending cancellation message:', error);
    } finally {
      setIsFormOpen(false);
      setActiveForm(null);
    }
  }, [activeForm, projectId]);

  // Initialize WebSocket on mount
  useEffect(() => {
    initializeWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [initializeWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  return {
    activeForm,
    isFormOpen,
    handleFormSubmit,
    handleFormCancel,
    connectionStatus,
    formHistory,
  };
};
