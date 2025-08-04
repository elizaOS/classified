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
    <div className="status-content logs-tab-content" data-testid="logs-content">
      <div className="logs-subtabs">
        <button
          className={`logs-subtab ${activeSubTab === 'agent' ? 'active' : ''}`}
          onClick={() => onSubTabChange('agent')}
        >
          Agent Logs
        </button>
        <button
          className={`logs-subtab ${activeSubTab === 'container' ? 'active' : ''}`}
          onClick={() => onSubTabChange('container')}
        >
          Container Logs
        </button>
      </div>
      <div className="logs-content">
        {activeSubTab === 'agent' ? <AgentLogs /> : <ContainerLogs />}
      </div>
    </div>
  );
};

export default LogsPanel;
