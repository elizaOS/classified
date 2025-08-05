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
    <div className="flex flex-col h-full bg-black text-terminal-green font-mono">
      <div className="p-4 border-b border-terminal-green bg-black/90">
        <span className="font-bold text-terminal-green">◎ THOUGHTS</span>
      </div>
      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {agentMonologue.length === 0 ? (
          <div className="text-center text-gray-400 italic py-10 px-5">Agent is quiet...</div>
        ) : (
          agentMonologue.map((thought, index) => (
            <div
              key={index}
              className="flex flex-col gap-1 p-3 mb-2 border border-terminal-green-border bg-terminal-green-subtle hover:bg-terminal-green/10 hover:border-terminal-green/50 transition-all duration-200"
              data-testid="monologue-content"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span
                    className={`text-base ${thought.isFromAgent ? 'text-terminal-green' : 'text-terminal-blue'}`}
                  >
                    {thought.isFromAgent ? '🤖' : '⚙️'}
                  </span>
                  <div className="text-gray-300 text-xs leading-relaxed break-words flex-1">
                    {typeof thought === 'string' ? thought : thought.text}
                  </div>
                </div>
                <div className="text-gray-500 text-[10px] shrink-0">
                  {thought.isFromAgent ? '[Agent]' : '[System]'}
                </div>
              </div>
              <div className="text-gray-500 text-[10px]">
                {thought.timestamp ? new Date(thought.timestamp).toLocaleTimeString() : '--:--:--'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MonologuePanel;
