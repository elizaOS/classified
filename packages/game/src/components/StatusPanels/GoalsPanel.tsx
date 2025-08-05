/**
 * Goals Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Displays and manages the goals list
 */

import React from 'react';

export interface Goal {
  id: string;
  name: string;
  description: string;
  isCompleted: boolean;
  createdAt: string;
}

interface GoalsPanelProps {
  goals: Goal[];
}

export const GoalsPanel: React.FC<GoalsPanelProps> = ({ goals }) => {
  return (
    <div
      className="flex flex-col h-full bg-black text-terminal-green font-mono"
      data-testid="goals-content"
    >
      <div className="p-4 border-b border-terminal-green bg-black/90 flex justify-between items-center">
        <span className="font-bold text-terminal-green">🎯 GOALS</span>
        <span className="bg-terminal-green/20 px-2 py-0.5 border border-terminal-green text-xs">
          {goals.length}
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {goals.length === 0 ? (
          <div className="text-center text-gray-400 italic py-10 px-5">
            No active goals set.
            <br />
            Goals will appear here when the agent creates them.
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-start gap-3 p-3 mb-2.5 border border-terminal-green-border bg-terminal-green-subtle transition-all duration-200 hover:bg-terminal-green/10 hover:border-terminal-green/50"
            >
              <div
                className={`text-base font-bold w-5 text-center mt-0.5 ${goal.isCompleted ? 'text-terminal-green' : 'text-gray-400'}`}
              >
                {goal.isCompleted ? '✓' : '○'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-terminal-green mb-1 text-sm">{goal.name}</div>
                <div className="text-gray-300 text-xs leading-relaxed break-words">
                  {goal.description}
                </div>
                <div className="text-gray-500 text-[10px] mt-1.5">
                  Created: {new Date(goal.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GoalsPanel;
