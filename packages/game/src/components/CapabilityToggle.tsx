/**
 * Capability Toggle Component
 * Professional capability management with proper state handling
 * Handles the capability buttons (autonomy, camera, screen, microphone, etc.)
 */

import React, { useState } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('CapabilityToggle');

export interface PluginToggleState {
  autonomy: boolean;
  camera: boolean;
  screen: boolean;
  microphone: boolean;
  speakers: boolean;
  shell: boolean;
  browser: boolean;
}

export interface ProgressionStatus {
  unlockedCapabilities?: string[];
  mode?: string;
  progressionReady?: boolean;
  [key: string]: unknown;
}

export interface CapabilityUsageState {
  [capability: string]: {
    hasBeenUsed: boolean;
    warningAcknowledged: boolean;
    firstSeenAt?: Date;
  };
}

interface CapabilityToggleProps {
  states: PluginToggleState;
  onToggle: (capability: string, newState: boolean) => Promise<void>;
  progressionStatus?: ProgressionStatus;
  capabilityUsage: CapabilityUsageState;
  disabled?: boolean;
}

export const CapabilityToggle: React.FC<CapabilityToggleProps> = ({
  states,
  onToggle,
  progressionStatus,
  capabilityUsage,
  disabled = false,
}) => {
  const [isTogglingState, setIsTogglingState] = useState({
    autonomy: false,
    camera: false,
    screen: false,
    microphone: false,
    speakers: false,
    shell: false,
    browser: false,
  });

  // Check if a capability is unlocked based on progression
  const isCapabilityUnlocked = (capability: string): boolean => {
    if (!progressionStatus?.unlockedCapabilities) {
      // Fallback: if no progression data, allow basic capabilities
      const basicCapabilities = ['shell', 'autonomy'];
      return basicCapabilities.includes(capability);
    }

    // Map UI capability names to progression capability names
    const capabilityMap: Record<string, string[]> = {
      shell: ['shell', 'naming'],
      browser: ['browser', 'stagehand'],
      camera: ['camera', 'advanced_vision'],
      screen: ['vision', 'screen_capture'],
      microphone: ['microphone', 'sam', 'audio'],
      speakers: ['microphone', 'sam', 'audio'], // Speakers use same capabilities as microphone
      autonomy: ['autonomy'],
      goals: ['goals'],
      todo: ['todo'],
    };

    const progressionCapabilities = capabilityMap[capability] || [capability];
    return progressionCapabilities.some((cap) =>
      progressionStatus.unlockedCapabilities?.includes(cap)
    );
  };

  const getButtonClass = (isActive: boolean, isToggling: boolean, isUnlocked: boolean): string => {
    const baseClasses =
      'flex-1 h-12 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 font-mono text-[10px] font-bold uppercase cursor-pointer select-none relative min-w-0 border';

    if (disabled || !isUnlocked) {
      return `${baseClasses} bg-gradient-to-br from-gray-800 to-gray-700 border-gray-600 text-gray-500 cursor-not-allowed opacity-60`;
    } else if (isToggling) {
      return `${baseClasses} bg-gradient-to-br from-gray-600 to-gray-500 border-gray-400 text-gray-300 cursor-wait opacity-80 animate-pulse`;
    } else if (isActive) {
      return `${baseClasses} bg-gradient-to-br from-green-700 to-terminal-green border-terminal-green text-black shadow-[0_0_12px_rgba(0,255,0,0.4)] hover:bg-gradient-to-br hover:from-green-600 hover:to-terminal-green hover:transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,255,0,0.6)]`;
    } else {
      return `${baseClasses} bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 text-gray-400 hover:bg-gradient-to-br hover:from-gray-800 hover:to-gray-700 hover:border-gray-600 hover:text-gray-300 hover:transform hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.3)]`;
    }
  };

  const handleClick = async (capability: string) => {
    if (disabled || isTogglingState[capability as keyof typeof isTogglingState]) {
      return;
    }

    // Check if capability is unlocked
    if (!isCapabilityUnlocked(capability)) {
      logger.warn(`Capability ${capability} is locked. Progression required.`);
      return;
    }

    const currentState = states[capability as keyof PluginToggleState];
    const newState = !currentState;

    setIsTogglingState((prev) => ({ ...prev, [capability]: true }));
    try {
      await onToggle(capability, newState);
      logger.info(`Capability ${capability} toggled to ${newState ? 'ON' : 'OFF'}`);
    } catch (error) {
      logger.error(`Failed to toggle ${capability}:`, error);
    } finally {
      setIsTogglingState((prev) => ({ ...prev, [capability]: false }));
    }
  };

  const capabilities = [
    { key: 'autonomy', label: 'AUTO', testId: 'autonomy-toggle', icon: '🤖' },
    { key: 'camera', label: 'CAM', testId: 'camera-toggle', icon: '📷' },
    { key: 'screen', label: 'SCR', testId: 'screen-toggle', icon: '🖥️' },
    { key: 'microphone', label: 'MIC', testId: 'microphone-toggle', icon: '🎤' },
    { key: 'speakers', label: 'SPK', testId: 'speakers-toggle', icon: '🔊' },
    { key: 'shell', label: 'SH', testId: 'shell-toggle', icon: '⚡' },
    { key: 'browser', label: 'WWW', testId: 'browser-toggle', icon: '🌐' },
  ] as const;

  return (
    <div className="flex gap-1 w-full p-2 bg-black/60 border border-terminal-green-border mb-3">
      {capabilities.map(({ key, label, testId }) => {
        const isUnlocked = isCapabilityUnlocked(key);
        const isNew = isUnlocked && !capabilityUsage[key]?.hasBeenUsed;
        const isActive = states[key as keyof PluginToggleState];
        const isToggling = isTogglingState[key as keyof typeof isTogglingState];

        return (
          <button
            key={key}
            className={`${getButtonClass(isActive, isToggling, isUnlocked)} ${
              isNew && isUnlocked ? 'animate-[glow_2s_ease-in-out_infinite]' : ''
            } ${!isUnlocked && disabled ? 'after:content-["🔒"] after:absolute after:top-0.5 after:right-0.5 after:text-[8px] after:opacity-70' : ''}`}
            onClick={() => handleClick(key)}
            data-testid={testId}
            disabled={disabled || !isUnlocked}
            aria-label={`Toggle ${key} capability`}
          >
            <div className="text-sm leading-none" data-testid={`${testId}-status`}>
              {isToggling ? '⏳' : isActive ? '●' : '○'}
            </div>
            <div className="text-[9px] leading-none opacity-90">{isToggling ? 'WAIT' : label}</div>
          </button>
        );
      })}
    </div>
  );
};

export default CapabilityToggle;
