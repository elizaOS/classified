import { useState, useRef, KeyboardEvent, useEffect } from 'react';

interface MessageInputProps {
    onSendMessage: (text: string) => void;
    disabled?: boolean;
}

export default function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory('down');
    }
  };

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || disabled) {return;}

    // Add to history
    setCommandHistory(prev => [...prev, trimmedInput]);
    setHistoryIndex(-1);

    // Send message
    onSendMessage(trimmedInput);

    // Clear input
    setInput('');
  };

  const navigateHistory = (direction: 'up' | 'down') => {
    if (commandHistory.length === 0) {return;}

    let newIndex = historyIndex;
    if (direction === 'up') {
      newIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1);
    } else {
      newIndex = historyIndex >= commandHistory.length - 1
        ? -1
        : historyIndex + 1;
    }

    setHistoryIndex(newIndex);
    setInput(newIndex === -1 ? '' : commandHistory[newIndex]);
  };

  return (
    <div className="input-area" style={{
      display: 'flex',
      alignItems: 'flex-start',
      borderTop: '1px solid var(--terminal-border)',
      paddingTop: '12px'
    }}>
      <span className="input-prefix glow" style={{
        marginRight: '8px',
        marginTop: '2px',
        color: disabled ? 'var(--terminal-red)' : 'var(--terminal-green)'
      }}>
                $
      </span>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Connecting...' : 'Enter command...'}
        className="terminal-input"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: 'var(--terminal-green)',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          lineHeight: '1.4',
          resize: 'none',
          minHeight: '20px',
          maxHeight: '100px',
          padding: 0,
          margin: 0,
          outline: 'none'
        }}
        rows={1}
      />
      {input && (
        <div className="cursor" style={{ marginLeft: '2px' }}></div>
      )}
    </div>
  );
}
