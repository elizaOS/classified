/**
 * Connection Status Component
 * Shows the current connection state to the agent
 */

import React from 'react';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  return (
    <div
      className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}
      data-testid="connection-status"
    >
              <span className="status-indicator">{isConnected ? '◉' : '◯'}</span>
      {isConnected ? 'ONLINE' : 'OFFLINE'}
    </div>
  );
};

export default ConnectionStatus;
