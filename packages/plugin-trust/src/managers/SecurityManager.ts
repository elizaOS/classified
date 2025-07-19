import { type IAgentRuntime, logger } from '@elizaos/core';
import type { UUID } from '../types/common';
import { TrustEngine } from './TrustEngine';
import type {
  SecurityContext,
  SecurityCheck,
  ThreatAssessment,
  Memory,
  Action,
} from '../types/security';

/**
 * Security Manager - Handles threat detection and behavioral analysis
 * Consolidates SecurityModule, CredentialProtector, and basic behavioral analysis
 */
export class SecurityManager {
  private runtime!: IAgentRuntime;
  private trustEngine!: TrustEngine;
  private messageHistory = new Map<UUID, Memory[]>();
  private actionHistory = new Map<UUID, Action[]>();

  // Patterns for security detection
  private readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+(instructions|commands)/i,
    /disregard\s+(all\s+)?prior\s+(commands|instructions)/i,
    /new\s+instructions?:/i,
    /system\s+override/i,
    /admin\s+access/i,
    /grant\s+me\s+(admin|owner|all)/i,
    /bypass\s+security/i,
  ];

  private readonly CREDENTIAL_PATTERNS = [
    /password/i,
    /api[_\s]?key/i,
    /token/i,
    /secret/i,
    /private[_\s]?key/i,
    /seed[_\s]?phrase/i,
  ];

  private readonly URGENCY_KEYWORDS = [
    'urgent',
    'immediately',
    'right now',
    'asap',
    'emergency',
    'critical',
  ];

  async initialize(runtime: IAgentRuntime, trustEngine: TrustEngine): Promise<void> {
    this.runtime = runtime;
    this.trustEngine = trustEngine;
    logger.info('[SecurityManager] Initialized');
  }

  /**
   * Analyze content for security threats
   */
  async analyzeContent(
    content: string,
    entityId: UUID,
    context: SecurityContext
  ): Promise<SecurityCheck> {
    // Check for prompt injection
    const injectionCheck = this.detectPromptInjection(content);
    if (injectionCheck.detected) {
      return injectionCheck;
    }

    // Check for credential theft
    const credentialCheck = this.detectCredentialTheft(content);
    if (credentialCheck.detected) {
      return credentialCheck;
    }

    // Check for social engineering
    const socialCheck = this.detectSocialEngineering(content);
    if (socialCheck.detected) {
      return socialCheck;
    }

    return {
      detected: false,
      confidence: 0,
      type: 'none',
      severity: 'low',
      action: 'allow',
      details: 'No threats detected',
    };
  }

  /**
   * Assess overall threat level for an entity
   */
  async assessThreatLevel(context: SecurityContext): Promise<ThreatAssessment> {
    if (!context.entityId) {
      return {
        detected: false,
        confidence: 0.8,
        type: 'anomaly',
        severity: 'low',
        action: 'log_only',
        details: 'No entity ID provided',
        recommendation: 'Continue normal monitoring',
      };
    }

    const messages = this.messageHistory.get(context.entityId) || [];
    const recentMessages = messages.filter(
      (m) => Date.now() - m.timestamp < 3600000 // Last hour
    );

    // Simple threat scoring
    let threatScore = 0;

    // High message volume
    if (recentMessages.length > 20) {
      threatScore += 0.3;
    }

    // Check for patterns in recent messages
    for (const msg of recentMessages) {
      if (this.CREDENTIAL_PATTERNS.some((p) => p.test(msg.content))) {
        threatScore += 0.2;
      }
      if (this.URGENCY_KEYWORDS.some((k) => msg.content.toLowerCase().includes(k))) {
        threatScore += 0.1;
      }
    }

    threatScore = Math.min(threatScore, 1.0);

    const severity: 'low' | 'medium' | 'high' | 'critical' =
      threatScore >= 0.8
        ? 'critical'
        : threatScore >= 0.6
          ? 'high'
          : threatScore >= 0.3
            ? 'medium'
            : 'low';

    return {
      detected: threatScore >= 0.5,
      confidence: 0.8,
      type: 'anomaly',
      severity,
      action: threatScore >= 0.5 ? 'require_verification' : 'log_only',
      details: `Threat score: ${(threatScore * 100).toFixed(0)}%`,
      recommendation: this.getRecommendation(severity),
    };
  }

  /**
   * Store message for analysis
   */
  async storeMemory(message: Memory): Promise<void> {
    const entityId = message.entityId as UUID;
    const messages = this.messageHistory.get(entityId) || [];
    messages.push({
      id: message.id || (`msg_${Date.now()}` as UUID),
      entityId,
      content: (message.content as any)?.text || '',
      timestamp: (message as any).createdAt || Date.now(),
      roomId: message.roomId,
    });

    // Keep last 100 messages
    if (messages.length > 100) {
      messages.shift();
    }

    this.messageHistory.set(entityId, messages);
  }

  /**
   * Store action for analysis
   */
  async storeAction(action: any): Promise<void> {
    const entityId = action.entityId as UUID;
    const actions = this.actionHistory.get(entityId) || [];
    actions.push({
      id: action.id || `action_${Date.now()}`,
      entityId,
      type: action.type,
      timestamp: action.timestamp || Date.now(),
      result: action.result,
    });

    // Keep last 50 actions
    if (actions.length > 50) {
      actions.shift();
    }

    this.actionHistory.set(entityId, actions);
  }

  private detectPromptInjection(content: string): SecurityCheck {
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        return {
          detected: true,
          confidence: 0.85,
          type: 'prompt_injection',
          severity: 'high',
          action: 'block',
          details: 'Prompt injection attempt detected',
        };
      }
    }

    return {
      detected: false,
      confidence: 0,
      type: 'none',
      severity: 'low',
      action: 'allow',
      details: '',
    };
  }

  private detectCredentialTheft(content: string): SecurityCheck {
    const hasCredentialPattern = this.CREDENTIAL_PATTERNS.some((p) => p.test(content));
    const hasRequestPattern = /give|send|share|provide|tell|show/i.test(content);

    if (hasCredentialPattern && hasRequestPattern) {
      return {
        detected: true,
        confidence: 0.9,
        type: 'credential_theft',
        severity: 'critical',
        action: 'block',
        details: 'Credential theft attempt detected',
      };
    }

    return {
      detected: false,
      confidence: 0,
      type: 'none',
      severity: 'low',
      action: 'allow',
      details: '',
    };
  }

  private detectSocialEngineering(content: string): SecurityCheck {
    const lowerContent = content.toLowerCase();
    let indicators = 0;

    // Check for urgency
    if (this.URGENCY_KEYWORDS.some((k) => lowerContent.includes(k))) {
      indicators++;
    }

    // Check for authority claims
    if (/admin|manager|supervisor|official/i.test(content)) {
      indicators++;
    }

    // Check for threats
    if (/consequences|trouble|fired|suspended/i.test(content)) {
      indicators++;
    }

    if (indicators >= 2) {
      return {
        detected: true,
        confidence: 0.7,
        type: 'social_engineering',
        severity: 'high',
        action: 'require_verification',
        details: 'Social engineering indicators detected',
      };
    }

    return {
      detected: false,
      confidence: 0,
      type: 'none',
      severity: 'low',
      action: 'allow',
      details: '',
    };
  }

  private getRecommendation(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'Immediate action required - suspend and investigate';
      case 'high':
        return 'Enhanced monitoring and restrict privileges';
      case 'medium':
        return 'Increase verification requirements';
      default:
        return 'Continue normal monitoring';
    }
  }

  async stop(): Promise<void> {
    this.messageHistory.clear();
    this.actionHistory.clear();
    logger.info('[SecurityManager] Stopped');
  }
}
