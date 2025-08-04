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
    <>
      <style>{`
        .goals-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #000;
          color: #00ff00;
          font-family: 'Courier New', monospace;
        }
        
        .goals-header {
          padding: 15px;
          border-bottom: 1px solid #00ff00;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .goals-title {
          font-weight: bold;
          color: #00ff00;
        }
        
        .goals-count {
          background: rgba(0, 255, 0, 0.2);
          padding: 2px 8px;
          border: 1px solid #00ff00;
          border-radius: 12px;
          font-size: 11px;
        }
        
        .goals-content {
          flex: 1;
          padding: 15px;
          overflow-y: auto;
          min-height: 0;
        }
        
        .goal-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          margin-bottom: 10px;
          border: 1px solid rgba(0, 255, 0, 0.3);
          background: rgba(0, 255, 0, 0.05);
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        
        .goal-item:hover {
          background: rgba(0, 255, 0, 0.1);
          border-color: rgba(0, 255, 0, 0.5);
        }
        
        .goal-indicator {
          font-size: 16px;
          font-weight: bold;
          width: 20px;
          text-align: center;
          margin-top: 2px;
        }
        
        .goal-indicator.completed {
          color: #00ff00;
        }
        
        .goal-indicator.pending {
          color: #888;
        }
        
        .goal-content {
          flex: 1;
          min-width: 0;
        }
        
        .goal-name {
          font-weight: bold;
          color: #00ff00;
          margin-bottom: 4px;
          font-size: 14px;
        }
        
        .goal-description {
          color: #ccc;
          font-size: 12px;
          line-height: 1.4;
          word-wrap: break-word;
        }
        
        .goal-meta {
          color: #666;
          font-size: 10px;
          margin-top: 6px;
        }
        
        .goals-empty {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 40px 20px;
        }
      `}</style>

      <div className="goals-panel" data-testid="goals-content">
        <div className="goals-header">
          <span className="goals-title">🎯 GOALS</span>
          <span className="goals-count">{goals.length}</span>
        </div>

        <div className="goals-content">
          {goals.length === 0 ? (
            <div className="goals-empty">
              No active goals set.
              <br />
              Goals will appear here when the agent creates them.
            </div>
          ) : (
            goals.map((goal) => (
              <div key={goal.id} className="goal-item">
                <div className={`goal-indicator ${goal.isCompleted ? 'completed' : 'pending'}`}>
                  {goal.isCompleted ? '✓' : '○'}
                </div>
                <div className="goal-content">
                  <div className="goal-name">{goal.name}</div>
                  <div className="goal-description">{goal.description}</div>
                  <div className="goal-meta">
                    Created: {new Date(goal.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default GoalsPanel;
