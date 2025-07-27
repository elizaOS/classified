import { useState, useRef, useEffect } from 'react';

interface InputLineProps {
  onSendMessage: (message: string) => void;
  onHistoryNavigation: (direction: 'up' | 'down') => string;
  disabled?: boolean;
}

export function InputLine({
  onSendMessage,
  onHistoryNavigation,
  disabled = false,
}: InputLineProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !disabled) {
        onSendMessage(input);
        setInput('');
      }
    } else if (e.key === 'ArrowUp' && input === '') {
      e.preventDefault();
      const historyValue = onHistoryNavigation('up');
      setInput(historyValue);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const historyValue = onHistoryNavigation('down');
      setInput(historyValue);
    }
  };

  return (
    <div className="input-area">
      <span className="input-prefix">$</span>
      <textarea
        ref={textareaRef}
        className="terminal-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Connecting...' : 'Type your message...'}
        disabled={disabled}
        rows={1}
        autoFocus
      />
    </div>
  );
}
