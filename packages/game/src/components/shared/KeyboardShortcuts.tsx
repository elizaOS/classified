/**
 * Keyboard Shortcuts Help Component
 * Shows available keyboard shortcuts in an overlay
 */

import React, { useEffect } from 'react';

interface KeyboardShortcutsProps {
  isVisible: boolean;
  onClose: () => void;
}

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  { key: 'Esc', description: 'Return to terminal/chat', category: 'Navigation' },
  { key: 'Alt + 1', description: 'Switch to Terminal tab', category: 'Navigation' },
  { key: 'Alt + 2', description: 'Switch to Config tab', category: 'Navigation' },
  { key: 'Alt + 3', description: 'Switch to Logs tab', category: 'Navigation' },
  { key: 'Alt + 4', description: 'Switch to Screen tab', category: 'Navigation' },
  { key: 'Alt + F', description: 'Focus chat input', category: 'Navigation' },
  { key: 'Enter', description: 'Send message (in chat input)', category: 'Chat' },
  { key: 'Ctrl + L', description: 'Clear terminal output', category: 'Chat' },
  { key: '?', description: 'Show/hide this help', category: 'Help' },
];

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ isVisible, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, Shortcut[]>
  );

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 bg-black/90 backdrop-blur-lg z-[2000] flex items-center justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="bg-gradient-to-br from-gray-900 to-black border border-terminal-green-border p-8 max-w-[600px] w-[90%] max-h-[80vh] overflow-y-auto text-white font-mono shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_24px_rgba(0,255,0,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-8 pb-4 border-b border-terminal-green-border">
          <h2
            id="shortcuts-title"
            className="text-2xl font-bold text-terminal-green mb-2 uppercase tracking-[2px]"
          >
            ⌨️ Keyboard Shortcuts
          </h2>
          <p className="text-sm text-terminal-green/70 m-0">
            Navigate ElizaOS interface efficiently
          </p>
        </div>

        {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
          <div key={category} className="mb-7 last:mb-0">
            <h3 className="text-base font-bold text-terminal-green mb-3 uppercase tracking-wider flex items-center gap-2 before:content-[''] before:w-5 before:h-px before:bg-terminal-green">
              {category}
            </h3>
            <div className="grid gap-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-2 px-3 bg-terminal-green/5 border border-terminal-green/10 transition-all duration-200 hover:bg-terminal-green/10 hover:border-terminal-green/20"
                >
                  <kbd className="bg-black/60 border border-terminal-green/40 px-2 py-1 text-xs font-bold text-terminal-green min-w-[80px] text-center shrink-0">
                    {shortcut.key}
                  </kbd>
                  <span className="flex-1 text-[13px] text-white/90 leading-relaxed">
                    {shortcut.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-center mt-6 pt-4 border-t border-terminal-green/20">
          <button
            className="bg-terminal-green/10 border border-terminal-green-border px-5 py-2.5 text-terminal-green font-mono text-xs font-bold uppercase cursor-pointer transition-all duration-200 hover:bg-terminal-green/20 hover:border-terminal-green hover:shadow-[0_0_12px_rgba(0,255,0,0.3)]"
            onClick={onClose}
            autoFocus
          >
            Close (Esc)
          </button>
          <div className="text-[11px] text-terminal-green/60 mt-3 italic">
            Press ? anywhere to toggle this help
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
