/**
 * Logs Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Displays agent and container logs with subtab navigation
 */

import React from 'react';
import { AgentLogs } from '../AgentLogs';
import { ContainerLogs } from '../ContainerLogs';

interface LogsPanelProps {
  activeSubTab: 'agent' | 'container';
  onSubTabChange: (subTab: 'agent' | 'container') => void;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ activeSubTab, onSubTabChange }) => {
  return (
    <div className="h-full flex flex-col bg-black" data-testid="logs-content">
      <div className="flex gap-0 p-0 bg-black/80 border-b border-terminal-green/30 overflow-hidden">
        <button
          className={`flex-1 py-3 px-5 bg-black/60 border-0 border-r border-terminal-green/20 text-terminal-green/60 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-none outline-none relative ${
            activeSubTab === 'agent'
              ? 'bg-terminal-green/10 text-terminal-green pb-2.5 after:content-[""] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-terminal-green after:shadow-[0_0_8px_rgba(0,255,0,0.5)]'
              : 'hover:bg-terminal-green/5 hover:text-terminal-green/80'
          }`}
          onClick={() => onSubTabChange('agent')}
        >
          Agent Logs
        </button>
        <button
          className={`flex-1 py-3 px-5 bg-black/60 border-0 text-terminal-green/60 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-none outline-none relative ${
            activeSubTab === 'container'
              ? 'bg-terminal-green/10 text-terminal-green pb-2.5 after:content-[""] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-terminal-green after:shadow-[0_0_8px_rgba(0,255,0,0.5)]'
              : 'hover:bg-terminal-green/5 hover:text-terminal-green/80'
          }`}
          onClick={() => onSubTabChange('container')}
        >
          Container Logs
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden bg-black/40">
        {activeSubTab === 'agent' ? <AgentLogs /> : <ContainerLogs />}
      </div>
    </div>
  );
};

export default LogsPanel;
