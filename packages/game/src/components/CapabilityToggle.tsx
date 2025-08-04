/**
 * Capability Toggle Component
 * Extracted from the monolithic GameInterface.tsx for better maintainability
 * Handles the capability buttons (autonomy, camera, screen, microphone, etc.)
 */

import React, { useState } from 'react';

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
  onToggle: (capability: string) => Promise<void>;
  progressionStatus?: ProgressionStatus;
  capabilityUsage: CapabilityUsageState;
}

export const CapabilityToggle: React.FC<CapabilityToggleProps> = ({
  states,
  onToggle,
  progressionStatus,
  capabilityUsage,
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
      // Fallback: if no progression data, allow all capabilities
      return true;
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

  const buttonStyle = (
    isActive: boolean,
    isToggling: boolean,
    isUnlocked: boolean,
    isNew: boolean
  ) => ({
    flex: '1 1 0',
    height: '40px',
    backgroundColor: !isUnlocked ? '#333333' : isActive ? '#00ff00' : '#1a1a1a',
    color: !isUnlocked ? '#666666' : isActive ? '#000000' : '#00ff00',
    cursor: !isUnlocked ? 'not-allowed' : isToggling ? 'wait' : 'pointer',
    textAlign: 'center' as const,
    border: `1px solid ${!isUnlocked ? '#555555' : isActive ? '#00ff00' : '#333333'}`,
    fontSize: '9px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
    opacity: !isUnlocked ? 0.5 : isToggling ? 0.7 : 1,
    position: 'relative' as const,
    animation: isNew && isUnlocked ? 'glow 2s ease-in-out infinite' : 'none',
    boxShadow: isNew && isUnlocked ? '0 0 10px #00ff00' : 'none',
  });

  const handleClick = async (capability: string) => {
    if (isTogglingState[capability as keyof typeof isTogglingState]) {
      return;
    } // Prevent double clicks

    // Check if capability is unlocked
    if (!isCapabilityUnlocked(capability)) {
      console.log(`Capability ${capability} is locked. Progression required.`);
      return;
    }

    setIsTogglingState((prev) => ({ ...prev, [capability]: true }));
    try {
      await onToggle(capability);
    } catch (error) {
      console.error(`Failed to toggle ${capability}:`, error);
    } finally {
      setIsTogglingState((prev) => ({ ...prev, [capability]: false }));
    }
  };

  const capabilities = [
    { key: 'autonomy', label: 'AUTO', testId: 'autonomy-toggle' },
    { key: 'camera', label: 'CAM', testId: 'camera-toggle' },
    { key: 'screen', label: 'SCR', testId: 'screen-toggle' },
    { key: 'microphone', label: 'MIC', testId: 'microphone-toggle' },
    { key: 'speakers', label: 'SPK', testId: 'speakers-toggle' },
    { key: 'shell', label: 'SH', testId: 'shell-toggle' },
    { key: 'browser', label: 'WWW', testId: 'browser-toggle' },
  ] as const;

  return (
    <>
      <style>{`
        @keyframes glow {
          0% {
            box-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 15px #00ff00;
          }
          50% {
            box-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00;
          }
          100% {
            box-shadow: 0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 15px #00ff00;
          }
        }
      `}</style>
      <div style={{ display: 'flex', gap: '2px', width: '100%' }}>
        {capabilities.map(({ key, label, testId }) => {
          const isUnlocked = isCapabilityUnlocked(key);
          const isNew = isUnlocked && !capabilityUsage[key]?.hasBeenUsed;
          const isActive = states[key as keyof PluginToggleState];
          const isToggling = isTogglingState[key as keyof typeof isTogglingState];

          return (
            <div
              key={key}
              style={buttonStyle(isActive, isToggling, isUnlocked, isNew)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`CLICKED: ${key}`);
                handleClick(key);
              }}
              data-testid={testId}
              title={
                !isUnlocked
                  ? '🔒 Locked - Complete progression to unlock'
                  : isNew
                    ? '✨ NEW! Click to try this feature'
                    : undefined
              }
            >
              <span data-testid={`${testId}-status`}>{isActive ? '●' : '○'}</span>
              <span>{isToggling ? '...' : label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default CapabilityToggle;
