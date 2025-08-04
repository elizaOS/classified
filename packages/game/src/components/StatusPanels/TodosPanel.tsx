/**
 * Todos Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Displays and manages the todos/tasks list
 */

import React from 'react';

export interface Todo {
  id: string;
  name: string;
  type: 'daily' | 'one-off' | 'aspirational';
  isCompleted: boolean;
  priority?: number;
}

interface TodosPanelProps {
  todos: Todo[];
}

export const TodosPanel: React.FC<TodosPanelProps> = ({ todos }) => {
  const getTypeColor = (type: Todo['type']) => {
    switch (type) {
      case 'daily':
        return '#00ffff';
      case 'one-off':
        return '#ffff00';
      case 'aspirational':
        return '#ff00ff';
      default:
        return '#ccc';
    }
  };

  const getPriorityColor = (priority?: number) => {
    if (!priority) return '#888';
    if (priority === 1) return '#ff0000';
    if (priority === 2) return '#ff8800';
    if (priority === 3) return '#ffff00';
    return '#00ff00';
  };

  return (
    <>
      <style>{`
        .todos-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #000;
          color: #00ff00;
          font-family: 'Courier New', monospace;
        }
        
        .todos-header {
          padding: 15px;
          border-bottom: 1px solid #00ff00;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .todos-title {
          font-weight: bold;
          color: #00ff00;
        }
        
        .todos-count {
          background: rgba(0, 255, 0, 0.2);
          padding: 2px 8px;
          border: 1px solid #00ff00;
          border-radius: 12px;
          font-size: 11px;
        }
        
        .todos-content {
          flex: 1;
          padding: 15px;
          overflow-y: auto;
          min-height: 0;
        }
        
        .todo-item {
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
        
        .todo-item:hover {
          background: rgba(0, 255, 0, 0.1);
          border-color: rgba(0, 255, 0, 0.5);
        }
        
        .todo-indicator {
          font-size: 16px;
          font-weight: bold;
          width: 20px;
          text-align: center;
          margin-top: 2px;
        }
        
        .todo-indicator.completed {
          color: #00ff00;
        }
        
        .todo-indicator.pending {
          color: #888;
        }
        
        .todo-content {
          flex: 1;
          min-width: 0;
        }
        
        .todo-name {
          font-weight: bold;
          color: #00ff00;
          margin-bottom: 4px;
          font-size: 14px;
        }
        
        .todo-meta {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 11px;
          margin-top: 4px;
        }
        
        .todo-type {
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: bold;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid;
        }
        
        .todo-priority {
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: bold;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid;
        }
        
        .todos-empty {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 40px 20px;
        }
      `}</style>

      <div className="todos-panel" data-testid="todos-content">
        <div className="todos-header">
          <span className="todos-title">✓ TASKS</span>
          <span className="todos-count">{todos.length}</span>
        </div>

        <div className="todos-content">
          {todos.length === 0 ? (
            <div className="todos-empty">
              No pending tasks.
              <br />
              Tasks will appear here when the agent creates them.
            </div>
          ) : (
            todos.map((todo) => (
              <div key={todo.id} className="todo-item">
                <div className={`todo-indicator ${todo.isCompleted ? 'completed' : 'pending'}`}>
                  {todo.isCompleted ? '✓' : '○'}
                </div>
                <div className="todo-content">
                  <div className="todo-name">{todo.name}</div>
                  <div className="todo-meta">
                    <span
                      className="todo-type"
                      style={{
                        color: getTypeColor(todo.type),
                        borderColor: getTypeColor(todo.type),
                      }}
                    >
                      {todo.type}
                    </span>
                    {todo.priority && (
                      <span
                        className="todo-priority"
                        style={{
                          color: getPriorityColor(todo.priority),
                          borderColor: getPriorityColor(todo.priority),
                        }}
                      >
                        P{todo.priority}
                      </span>
                    )}
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

export default TodosPanel;
