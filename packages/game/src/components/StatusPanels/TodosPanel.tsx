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
  const getTypeStyles = (type: Todo['type']) => {
    switch (type) {
      case 'daily':
        return 'text-terminal-cyan border-terminal-cyan';
      case 'one-off':
        return 'text-terminal-yellow border-terminal-yellow';
      case 'aspirational':
        return 'text-terminal-magenta border-terminal-magenta';
      default:
        return 'text-gray-300 border-gray-300';
    }
  };

  const getPriorityStyles = (priority?: number) => {
    if (!priority) return 'text-gray-400 border-gray-400';
    if (priority === 1) return 'text-terminal-red border-terminal-red';
    if (priority === 2) return 'text-terminal-orange border-terminal-orange';
    if (priority === 3) return 'text-terminal-yellow border-terminal-yellow';
    return 'text-terminal-green border-terminal-green';
  };

  return (
    <div
      className="flex flex-col h-full bg-black text-terminal-green font-mono"
      data-testid="todos-content"
    >
      <div className="p-4 border-b border-terminal-green bg-black/90 flex justify-between items-center">
        <span className="font-bold text-terminal-green">✓ TASKS</span>
        <span className="bg-terminal-green/20 px-2 py-0.5 border border-terminal-green text-xs">
          {todos.length}
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {todos.length === 0 ? (
          <div className="text-center text-gray-400 italic py-10 px-5">
            No pending tasks.
            <br />
            Tasks will appear here when the agent creates them.
          </div>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-start gap-3 p-3 mb-2.5 border border-terminal-green-border bg-terminal-green-subtle transition-all duration-200 hover:bg-terminal-green/10 hover:border-terminal-green/50"
            >
              <div
                className={`text-base font-bold w-5 text-center mt-0.5 ${todo.isCompleted ? 'text-terminal-green' : 'text-gray-400'}`}
              >
                {todo.isCompleted ? '✓' : '○'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-terminal-green mb-1 text-sm">{todo.name}</div>
                <div className="flex gap-3 items-center text-[11px] mt-1">
                  <span
                    className={`px-1.5 py-0.5 font-bold bg-black/50 border ${getTypeStyles(todo.type)}`}
                  >
                    {todo.type}
                  </span>
                  {todo.priority && (
                    <span
                      className={`px-1.5 py-0.5 font-bold bg-black/50 border ${getPriorityStyles(todo.priority)}`}
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
  );
};

export default TodosPanel;
