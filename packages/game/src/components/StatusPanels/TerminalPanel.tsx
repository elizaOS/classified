/**
 * Terminal Panel Component
 * Handles the main terminal output and messaging interface
 */

import React from 'react';
import type { OutputLine } from './AgentScreenPanel';

interface TerminalPanelProps {
  output: OutputLine[];
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ output }) => {
  return (
    <>
      <style>{`
        .terminal-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #000;
          color: #00ff00;
          font-family: 'Courier New', monospace;
        }
        
        .terminal-header {
          padding: 10px;
          border-bottom: 1px solid #00ff00;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .terminal-title {
          font-weight: bold;
          color: #00ff00;
        }
        
        .terminal-output {
          flex: 1;
          padding: 15px;
          overflow-y: auto;
          min-height: 0;
          background: #000;
        }
        
        .chat-line {
          margin-bottom: 8px;
          padding: 4px 0;
          line-height: 1.4;
        }
        
        .chat-user {
          color: #ffff00;
        }
        
        .chat-agent {
          color: #00ffff;
        }
        
        .chat-system {
          color: #ff00ff;
        }
        
        .chat-error {
          color: #ff0000;
        }
        
        .timestamp {
          color: #666;
          font-size: 11px;
        }
        
        .empty-state {
          color: #888;
          font-style: italic;
          text-align: center;
          padding: 40px 20px;
        }
      `}</style>

      <div className="terminal-panel">
        <div className="terminal-header" data-testid="terminal-header">
          <div className="terminal-title">⚡ ELIZA GAME INTERFACE</div>
        </div>

        <div className="terminal-output" data-testid="terminal-output">
          {output.length === 0 ? (
            <div className="empty-state">System ready. Type a message to begin...</div>
          ) : (
            output.map((line, index) => (
              <div key={index} className={`chat-line chat-${line.type}`}>
                <span className="timestamp">[{new Date(line.timestamp).toLocaleTimeString()}]</span>{' '}
                {line.content}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default TerminalPanel;
