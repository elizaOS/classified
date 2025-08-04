/**
 * Agent Screen Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Handles agent screen sharing and capture functionality
 */

import React from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface OutputLine {
  type: 'user' | 'agent' | 'system' | 'error';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface AgentScreenPanelProps {
  agentScreenActive: boolean;
  setAgentScreenActive: (active: boolean) => void;
  streamingState: { screen: boolean };
  startMediaCapture: (type: 'screen') => Promise<MediaStream | null>;
  stopMediaStream: (type: 'screen') => void;
  processVideoStream: (stream: MediaStream, type: string) => Promise<void>;
  setOutput: React.Dispatch<React.SetStateAction<OutputLine[]>>;
}

export const AgentScreenPanel: React.FC<AgentScreenPanelProps> = ({
  agentScreenActive,
  setAgentScreenActive,
  streamingState,
  startMediaCapture,
  stopMediaStream,
  processVideoStream,
  setOutput,
}) => {
  const handleAgentScreenToggle = async () => {
    try {
      if (agentScreenActive) {
        await invoke('stop_agent_screen_capture');
        setAgentScreenActive(false);
      } else {
        await invoke('start_agent_screen_capture');
        setAgentScreenActive(true);
      }
    } catch (error) {
      console.error('Failed to toggle agent screen capture:', error);
      setOutput((prev) => [
        ...prev,
        {
          type: 'error',
          content: `Agent screen capture failed: ${error}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleScreenShareToggle = async () => {
    if (streamingState.screen) {
      stopMediaStream('screen');
      setOutput((prev) => [
        ...prev,
        {
          type: 'system',
          content: 'Screen sharing stopped',
          timestamp: new Date(),
        },
      ]);
    } else {
      try {
        const stream = await startMediaCapture('screen');
        if (stream) {
          // Start capturing frames
          await processVideoStream(stream, 'screen');
          setOutput((prev) => [
            ...prev,
            {
              type: 'system',
              content: '📺 Screen sharing started - agent can see your screen',
              timestamp: new Date(),
            },
          ]);
        }
      } catch (error) {
        console.error('Screen sharing failed:', error);
        setOutput((prev) => [
          ...prev,
          {
            type: 'error',
            content: `Screen sharing failed: ${error}`,
            timestamp: new Date(),
          },
        ]);
      }
    }
  };

  return (
    <div className="status-content agent-screen-content" data-testid="agent-screen-content">
      <div className="status-header">
        <span>◎ SCREEN SHARING</span>
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button
            className={`agent-screen-toggle ${agentScreenActive ? 'active' : ''}`}
            onClick={handleAgentScreenToggle}
            style={{
              padding: '4px 12px',
              backgroundColor: agentScreenActive ? '#dc2626' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="View agent's screen"
          >
            {agentScreenActive ? '🔴 Agent Screen' : '👁️ Agent Screen'}
          </button>
          <button
            className={`screen-share-toggle ${streamingState.screen ? 'active' : ''}`}
            onClick={handleScreenShareToggle}
            style={{
              padding: '4px 12px',
              backgroundColor: streamingState.screen ? '#dc2626' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Share your screen with agent"
          >
            {streamingState.screen ? '🔴 Stop Sharing' : '📺 Share Screen'}
          </button>
        </div>
      </div>

      <div className="agent-screen-container">
        <canvas
          id="agent-screen-canvas"
          className="agent-screen-canvas"
          style={{
            width: '100%',
            height: 'auto',
            backgroundColor: '#000',
            imageRendering: 'pixelated',
          }}
        />
        <div className="agent-screen-info">
          {agentScreenActive && <span className="stream-indicator">🔴 Agent Screen Active</span>}
          {streamingState.screen && <span className="stream-indicator">🖥️ Screen Sharing</span>}

          <div className="screen-section">
            <h4>👁️ Agent's View</h4>
            <p>When enabled, you can see what the agent is viewing on their screen.</p>
            <div className="screen-status">
              Status: {agentScreenActive ? '🔴 Active' : '⚫ Inactive'}
            </div>
          </div>

          <div className="screen-section">
            <h4>📺 Your Screen</h4>
            <p>Share your screen with the agent so it can see what you're working on.</p>
            <div className="screen-status">
              Status: {streamingState.screen ? '🔴 Sharing' : '⚫ Not Sharing'}
            </div>
          </div>

          {(agentScreenActive || streamingState.screen) && (
            <div className="screen-warning">
              <strong>⚠️ Privacy Notice:</strong> Screen sharing is active. Be mindful of sensitive
              information.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentScreenPanel;
