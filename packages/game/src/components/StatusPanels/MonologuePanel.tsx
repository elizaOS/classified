/**
 * Monologue Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Displays agent thoughts and internal monologue
 */

import React from 'react';

export interface MonologueItem {
  text: string;
  timestamp: number;
  isFromAgent: boolean;
}

interface MonologuePanelProps {
  agentMonologue: MonologueItem[];
}

export const MonologuePanel: React.FC<MonologuePanelProps> = ({ agentMonologue }) => {
  return (
    <div className="status-content">
      <div className="status-header">
        <span>◎ THOUGHTS</span>
      </div>
      <div className="scrollable-content">
        {agentMonologue.length === 0 ? (
          <div className="empty-state">Agent is quiet...</div>
        ) : (
          agentMonologue.map((thought, index) => (
            <div key={index} className="monologue-item" data-testid="monologue-content">
              <div className="monologue-timestamp">
                {thought.timestamp ? new Date(thought.timestamp).toLocaleTimeString() : '--:--:--'}
              </div>
              <div className="monologue-text">
                <span className={`monologue-sender ${thought.isFromAgent ? 'agent' : 'system'}`}>
                  {thought.isFromAgent ? '🤖 ' : '⚙️ '}
                </span>
                {typeof thought === 'string' ? thought : thought.text}
              </div>
              <div className="monologue-type">{thought.isFromAgent ? '[Agent]' : '[System]'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MonologuePanel;
