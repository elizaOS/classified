/**
 * Security Warning Component
 * Displays security warnings when enabling potentially dangerous capabilities
 */

import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('SecurityWarning');

interface SecurityWarningProps {
  capability: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  risks: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isVisible: boolean;
}

export const SecurityWarning: React.FC<SecurityWarningProps> = ({
  capability,
  riskLevel,
  description,
  risks,
  onConfirm,
  onCancel,
  isVisible,
}) => {
  const [acknowledged, setAcknowledged] = useState({
    understand: false,
    accept: false,
    noProduction: false,
  });

  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!isVisible) {
      // Reset state when dialog is closed
      setAcknowledged({ understand: false, accept: false, noProduction: false });
      setConfirmText('');
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const riskColors = {
    low: 'terminal-green',
    medium: 'terminal-yellow',
    high: 'terminal-orange',
    critical: 'terminal-red',
  };

  const riskBorderColors = {
    low: 'border-terminal-green',
    medium: 'border-terminal-yellow',
    high: 'border-terminal-orange',
    critical: 'border-terminal-red',
  };

  const riskBgColors = {
    low: 'bg-terminal-green',
    medium: 'bg-terminal-yellow',
    high: 'bg-terminal-orange',
    critical: 'bg-terminal-red',
  };

  const riskIcons = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  const handleConfirm = () => {
    const isAcknowledged = Object.values(acknowledged).every((v) => v);
    const isConfirmed = riskLevel === 'critical' ? confirmText === 'ENABLE ANYWAY' : true;

    if (isAcknowledged && isConfirmed) {
      logger.warn(`User confirmed enabling ${capability} (${riskLevel} risk)`);
      onConfirm();
    }
  };

  const canProceed = () => {
    const isAcknowledged = Object.values(acknowledged).every((v) => v);
    const isConfirmed = riskLevel === 'critical' ? confirmText === 'ENABLE ANYWAY' : true;
    return isAcknowledged && isConfirmed;
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1000] flex items-center justify-center p-8 animate-fade-in">
      <div className="max-w-2xl w-full bg-gradient-to-br from-gray-900 to-black border border-terminal-green-border max-h-[90vh] overflow-y-auto">
        <div className={`p-6 border-b-2 ${riskBorderColors[riskLevel]} flex items-center gap-4`}>
          <span className="text-4xl">{riskIcons[riskLevel]}</span>
          <h2 className="text-2xl font-bold text-terminal-green flex-1">Security Warning: {capability}</h2>
          <div className={`px-3 py-1 ${riskBgColors[riskLevel]} text-black text-xs font-bold uppercase`}>
            {riskLevel} RISK
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-terminal-green mb-2 uppercase tracking-wider">Capability Description:</h3>
            <p className="text-sm text-gray-300">{description}</p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-terminal-green mb-2 uppercase tracking-wider">Security Risks:</h3>
            <ul className="space-y-2">
              {risks.map((risk, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-terminal-yellow">⚠️</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>

          {riskLevel === 'critical' && (
            <div className="p-4 bg-terminal-red/20 border border-terminal-red">
              <h3 className="text-sm font-bold text-terminal-red mb-2 uppercase tracking-wider">🔴 CRITICAL WARNING:</h3>
              <p className="text-sm text-terminal-red">
                This capability can completely compromise your system security. It provides
                unrestricted access to your computer and should only be enabled in isolated,
                non-production environments.
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-terminal-green mb-2 uppercase tracking-wider">Security Recommendations:</h3>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Only enable this capability if you fully understand the risks</li>
              <li>• Use in an isolated environment (virtual machine, container)</li>
              <li>• Monitor all activity when this capability is enabled</li>
              <li>• Disable immediately after use</li>
              {riskLevel === 'critical' && (
                <>
                  <li className="font-bold text-terminal-red">• Do not use on production systems</li>
                  <li className="font-bold text-terminal-red">• Ensure no sensitive data is accessible</li>
                </>
              )}
            </ul>
          </div>

          <div className="space-y-3 p-4 bg-black/60 border border-terminal-green/20">
            <h3 className="text-sm font-bold text-terminal-green uppercase tracking-wider">Please acknowledge:</h3>
            
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged.understand}
                onChange={(e) => setAcknowledged({ ...acknowledged, understand: e.target.checked })}
                className="mt-1 w-4 h-4 accent-terminal-green cursor-pointer"
              />
              <span className="text-sm text-gray-300">
                I understand the security risks associated with enabling the <strong>{capability}</strong> capability
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged.accept}
                onChange={(e) => setAcknowledged({ ...acknowledged, accept: e.target.checked })}
                className="mt-1 w-4 h-4 accent-terminal-green cursor-pointer"
              />
              <span className="text-sm text-gray-300">
                I accept full responsibility for any consequences of enabling this capability
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged.noProduction}
                onChange={(e) => setAcknowledged({ ...acknowledged, noProduction: e.target.checked })}
                className="mt-1 w-4 h-4 accent-terminal-green cursor-pointer"
              />
              <span className="text-sm text-gray-300">
                I confirm this is NOT a production environment with sensitive data
              </span>
            </label>

            {riskLevel === 'critical' && (
              <div className="mt-4 pt-4 border-t border-terminal-red/30">
                <label className="block text-sm text-terminal-red mb-2">
                  Type "ENABLE ANYWAY" to proceed with critical risk capability:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type here to confirm"
                  className="w-full py-2 px-3 bg-black/60 border border-terminal-red/30 text-terminal-red font-mono text-sm outline-none transition-none placeholder:text-gray-500 focus:border-terminal-red focus:bg-black/80"
                />
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-end pt-4 border-t border-terminal-green/20">
            <button
              onClick={onCancel}
              className="py-2 px-6 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-sm uppercase hover:bg-terminal-green/10 hover:border-terminal-green transition-none"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canProceed()}
              className={`py-2 px-6 font-mono text-sm uppercase transition-none ${
                riskLevel === 'critical'
                  ? 'bg-terminal-red/30 border border-terminal-red text-terminal-red hover:bg-terminal-red/40 hover:border-terminal-red disabled:opacity-50 disabled:cursor-not-allowed'
                  : `bg-${riskColors[riskLevel]}/30 border border-${riskColors[riskLevel]} text-${riskColors[riskLevel]} hover:bg-${riskColors[riskLevel]}/40 hover:border-${riskColors[riskLevel]} disabled:opacity-50 disabled:cursor-not-allowed`
              }`}
            >
              Enable {capability}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Security risk configurations for different capabilities
export const CAPABILITY_RISKS = {
  shell: {
    level: 'critical' as const,
    description: 'Grants full shell/terminal access to execute arbitrary system commands',
    risks: [
      'Can execute ANY command on your system with full privileges',
      'Can access, modify, or delete any file on your computer',
      'Can install malware or backdoors',
      'Can exfiltrate sensitive data',
      'Can modify system settings and configurations',
      'Can access network resources and make external connections',
    ],
  },
  browser: {
    level: 'high' as const,
    description: 'Allows automated browser control and web interaction',
    risks: [
      'Can access any website and read page content',
      'Can interact with forms and submit data',
      'Can access cookies and local storage',
      'Can potentially access saved passwords if browser is logged in',
      'Can make purchases or transactions if payment info is saved',
    ],
  },
  microphone: {
    level: 'medium' as const,
    description: 'Enables audio recording from your microphone',
    risks: [
      'Can record all audio from your environment',
      'Can capture private conversations',
      'May transmit audio data to external services',
      'Could be used for unauthorized surveillance',
    ],
  },
  camera: {
    level: 'medium' as const,
    description: 'Enables video capture from your camera',
    risks: [
      'Can capture video/images from your camera',
      'Can record your physical environment',
      'May transmit visual data to external services',
      'Could be used for unauthorized surveillance',
    ],
  },
  screen: {
    level: 'high' as const,
    description: 'Allows screen capture and monitoring',
    risks: [
      'Can see everything on your screen',
      'Can capture sensitive information like passwords, emails, documents',
      'Can monitor all your computer activity',
      'May transmit screen data to external services',
    ],
  },
  autonomy: {
    level: 'medium' as const,
    description: 'Enables autonomous agent actions and decision-making',
    risks: [
      'Agent can take actions without explicit approval',
      'May perform unexpected operations',
      'Could make decisions that conflict with user intent',
      'Behavior may be unpredictable based on AI reasoning',
    ],
  },
  speakers: {
    level: 'low' as const,
    description: 'Allows audio playback through system speakers',
    risks: [
      'Can play audio at any volume',
      'May play unexpected or inappropriate content',
      'Could be disruptive in quiet environments',
    ],
  },
};

export default SecurityWarning;