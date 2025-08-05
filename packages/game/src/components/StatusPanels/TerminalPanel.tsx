/**
 * Terminal Panel Component
 * Handles the main terminal output and messaging interface with chat input
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTauriChat } from '../../hooks/useTauriChat';
import { createLogger } from '../../utils/logger';
import type { OutputLine } from './AgentScreenPanel';

const logger = createLogger('TerminalPanel');

interface TerminalPanelProps {
  output: OutputLine[];
  onNewMessage?: (message: OutputLine) => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ output, onNewMessage }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const { sendMessage, messages, isConnected, isLoading, error } = useTauriChat();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, messages]);

  // Focus input on mount and when clicking terminal
  useEffect(() => {
    if (inputRef.current && isConnected) {
      inputRef.current.focus();
    }
  }, [isConnected]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !isConnected) {
      return;
    }

    // Prevent sending if already loading
    if (isLoading) {
      logger.warn('Message send already in progress');
      return;
    }

    const userMessage: OutputLine = {
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      metadata: { source: 'terminal_input' },
    };

    // Add user message to output immediately
    if (onNewMessage) {
      onNewMessage(userMessage);
    }

    const messageText = inputValue.trim();
    setInputValue(''); // Clear input immediately for better UX

    try {
      // Send to Tauri backend
      await sendMessage(messageText);
      logger.info('Message sent successfully', { message: messageText });
    } catch (error) {
      logger.error('Failed to send message', { error, message: messageText });

      // Restore the input value on error
      setInputValue(messageText);

      const errorMessage: OutputLine = {
        type: 'error',
        content: `Failed to send message: ${error}`,
        timestamp: new Date(),
      };

      if (onNewMessage) {
        onNewMessage(errorMessage);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Convert Tauri messages to output format and merge with existing output
  const allMessages = React.useMemo(() => {
    const tauriMessages: OutputLine[] = messages.map((msg) => ({
      type: msg.type,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      metadata: { source: 'tauri_chat', messageId: msg.id },
    }));

    // Merge and sort by timestamp
    return [...output, ...tauriMessages].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [output, messages]);
  return (
    <>
      <div
        className="flex flex-col h-full bg-black text-terminal-green font-mono border border-terminal-green-border overflow-hidden"
        onClick={() => inputRef.current?.focus()}
      >
        <div
          className="py-3 px-4 border-b border-terminal-green-border bg-black/90 flex justify-between items-center"
          data-testid="terminal-header"
        >
          <div className="font-bold text-terminal-green uppercase tracking-wider">
            ⚡ ELIZA CHAT INTERFACE
          </div>
        </div>

        {error && (
          <div className="bg-terminal-red/10 border-x border-terminal-red/30 text-terminal-red py-2 px-4 text-xs">
            ⚠️ Connection Error: {error}
          </div>
        )}

        <div
          className="flex-1 p-4 overflow-y-auto min-h-0 bg-black cursor-text hover:bg-terminal-green/[0.02]"
          ref={outputRef}
          data-testid="terminal-output"
        >
          {allMessages.length === 0 ? (
            <div className="text-center italic py-16 px-5 flex flex-col items-center gap-3">
              <div className="text-gray-400">🤖 System ready. Start chatting with Eliza!</div>
              <div className="text-xs text-gray-500">
                {isConnected
                  ? 'Type your message below and press Enter'
                  : 'Waiting for connection...'}
              </div>
            </div>
          ) : (
            allMessages.map((line, index) => {
              const typeStyles =
                {
                  user: 'text-terminal-yellow border-l-terminal-yellow/30',
                  agent: 'text-terminal-cyan border-l-terminal-cyan/30',
                  system: 'text-terminal-magenta border-l-terminal-magenta/30',
                  error: 'text-terminal-red border-l-terminal-red/50 bg-terminal-red/10',
                }[line.type] || 'text-gray-300 border-l-gray-300/30';

              return (
                <div
                  key={index}
                  className={`mb-3 py-1.5 leading-relaxed border-l-[3px] pl-3 transition-all duration-200 hover:bg-terminal-green/[0.05] hover:border-l-terminal-green/30 ${typeStyles}`}
                >
                  <span className="text-gray-500 text-[11px] mr-2">
                    [{line.timestamp.toLocaleTimeString()}]
                  </span>
                  {line.content}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-terminal-green-border py-3 px-4 bg-black/80 flex gap-3 items-center">
          <div className="text-terminal-green font-bold shrink-0">{'>'}</div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-terminal-green font-mono text-sm outline-none py-2 placeholder:text-gray-500 placeholder:italic focus:bg-terminal-green/[0.05]"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? 'Type your message here...' : 'Connecting...'}
            disabled={!isConnected || isLoading}
            data-testid="chat-input"
          />
          <button
            className="bg-terminal-green/10 border border-terminal-green-border text-terminal-green py-2 px-4 cursor-pointer font-mono text-xs uppercase transition-all duration-200 hover:bg-terminal-green/20 hover:border-terminal-green hover:shadow-[0_0_8px_rgba(0,255,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!isConnected || isLoading || !inputValue.trim()}
            data-testid="send-button"
          >
            {isLoading ? 'SENDING...' : 'SEND'}
          </button>
        </div>
      </div>
    </>
  );
};

export default TerminalPanel;
