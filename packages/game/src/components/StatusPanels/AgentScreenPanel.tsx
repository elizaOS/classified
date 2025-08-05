/**
 * Agent Screen Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Handles agent screen sharing and capture functionality
 */

import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AgentScreenPanel');

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
      logger.error('Failed to toggle agent screen capture', error);
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
        logger.error('Screen sharing failed', error);
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
    <div className="flex flex-col h-full bg-black text-terminal-green font-mono" data-testid="agent-screen-content">
      <div className="p-4 border-b border-terminal-green bg-black/90 flex justify-between items-center">
        <span className="font-bold text-terminal-green uppercase tracking-wider">◎ SCREEN SHARING</span>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 text-xs font-bold uppercase transition-all duration-200 border ${
              agentScreenActive
                ? 'bg-terminal-red border-terminal-red text-white hover:bg-terminal-red/80'
                : 'bg-terminal-green border-terminal-green text-black hover:bg-terminal-green/80'
            }`}
            onClick={handleAgentScreenToggle}
            title="View agent's screen"
          >
            {agentScreenActive ? '🔴 Agent Screen' : '👁️ Agent Screen'}
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-bold uppercase transition-all duration-200 border ${
              streamingState.screen
                ? 'bg-terminal-red border-terminal-red text-white hover:bg-terminal-red/80'
                : 'bg-terminal-green border-terminal-green text-black hover:bg-terminal-green/80'
            }`}
            onClick={handleScreenShareToggle}
            title="Share your screen with agent"
          >
            {streamingState.screen ? '🔴 Stop Sharing' : '📺 Share Screen'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <canvas
          id="agent-screen-canvas"
          className="w-full h-auto bg-black mb-4"
          style={{
            imageRendering: 'pixelated',
          }}
        />
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {agentScreenActive && (
              <span className="px-2 py-1 bg-terminal-red/20 border border-terminal-red text-terminal-red text-xs font-bold uppercase">
                🔴 Agent Screen Active
              </span>
            )}
            {streamingState.screen && (
              <span className="px-2 py-1 bg-terminal-blue/20 border border-terminal-blue text-terminal-blue text-xs font-bold uppercase">
                🖥️ Screen Sharing
              </span>
            )}
          </div>

          <div className="p-4 bg-black/60 border border-terminal-green-border">
            <h4 className="text-sm font-bold text-terminal-green mb-2 uppercase tracking-wider">👁️ Agent's View</h4>
            <p className="text-xs text-gray-400 mb-2">When enabled, you can see what the agent is viewing on their screen.</p>
            <div className="text-xs font-mono">
              Status: <span className={agentScreenActive ? 'text-terminal-red' : 'text-gray-500'}>
                {agentScreenActive ? '🔴 Active' : '⚫ Inactive'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-black/60 border border-terminal-green-border">
            <h4 className="text-sm font-bold text-terminal-green mb-2 uppercase tracking-wider">📺 Your Screen</h4>
            <p className="text-xs text-gray-400 mb-2">Share your screen with the agent so it can see what you're working on.</p>
            <div className="text-xs font-mono">
              Status: <span className={streamingState.screen ? 'text-terminal-blue' : 'text-gray-500'}>
                {streamingState.screen ? '🔴 Sharing' : '⚫ Not Sharing'}
              </span>
            </div>
          </div>

          {(agentScreenActive || streamingState.screen) && (
            <div className="p-3 bg-terminal-yellow/10 border border-terminal-yellow text-terminal-yellow text-xs">
              <strong>⚠️ Privacy Notice:</strong> Screen sharing is active. Be mindful of sensitive information.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentScreenPanel;