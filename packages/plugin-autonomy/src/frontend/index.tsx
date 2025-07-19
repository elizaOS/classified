import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

interface AutonomyStatus {
  enabled: boolean;
  interval: number;
  agentId: string;
  characterName: string;
}

function AutonomyPanel() {
  const [status, setStatus] = useState<AutonomyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<string>('30000');

  // Fetch status on mount and periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/autonomy/status');
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json();
        if (data.success) {
          setStatus(data.data);
          setInterval(data.data.interval.toString());
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    fetchStatus();
    const intervalId = window.setInterval(fetchStatus, 5000); // Poll every 5 seconds

    return () => window.clearInterval(intervalId);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = status?.enabled ? '/api/autonomy/disable' : '/api/autonomy/enable';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle autonomy');
      }

      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleIntervalChange = async () => {
    const intervalMs = parseInt(interval);
    if (isNaN(intervalMs) || intervalMs < 1000) {
      setError('Interval must be at least 1000ms');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/autonomy/interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: intervalMs }),
      });

      if (!response.ok) {
        throw new Error('Failed to update interval');
      }

      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!status) {
    return <div className="loading">Loading autonomy status...</div>;
  }

  return (
    <div className="autonomy-panel">
      <h1>Autonomy Control Panel</h1>

      <div className="status-card">
        <h2>Agent Information</h2>
        <p>
          <strong>Agent ID:</strong> {status.agentId}
        </p>
        <p>
          <strong>Character:</strong> {status.characterName}
        </p>
      </div>

      <div className="control-card">
        <h2>Autonomy Status</h2>
        <div className="status-indicator">
          <span className={`status-dot ${status.enabled ? 'enabled' : 'disabled'}`}></span>
          <span>{status.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`toggle-button ${status.enabled ? 'disable' : 'enable'}`}
          data-testid="toggle-autonomy-btn"
        >
          {loading ? 'Processing...' : status.enabled ? 'Disable Autonomy' : 'Enable Autonomy'}
        </button>
      </div>

      <div className="interval-card">
        <h2>Loop Interval</h2>
        <div className="interval-control">
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            min="1000"
            step="1000"
            data-testid="interval-input"
          />
          <span>ms</span>
          <button
            onClick={handleIntervalChange}
            disabled={loading}
            data-testid="update-interval-btn"
          >
            Update
          </button>
        </div>
        <p className="help-text">
          Current: {status.interval}ms ({Math.round(status.interval / 1000)}s)
        </p>
      </div>

      {error && (
        <div className="error-message" data-testid="error-message">
          {error}
        </div>
      )}
    </div>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AutonomyPanel />);
}
