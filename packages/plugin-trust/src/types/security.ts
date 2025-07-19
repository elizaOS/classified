import type { UUID } from '@elizaos/core';
import type { PermissionContext } from './permissions';

export interface SecurityContext extends PermissionContext {
  entityId?: UUID;
  requestedAction?: string;
  messageHistory?: UUID[];
}

export interface SecurityCheck {
  detected: boolean;
  confidence: number;
  type: 'prompt_injection' | 'social_engineering' | 'credential_theft' | 'anomaly' | 'none';
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'block' | 'require_verification' | 'allow' | 'log_only';
  details?: string;
}

export interface ThreatAssessment extends SecurityCheck {
  recommendation?: string;
}

export interface SecurityEvent {
  id?: UUID;
  type: SecurityEventType;
  entityId: UUID;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: PermissionContext;
  details: any;
  timestamp?: number;
  handled?: boolean;
}

export enum SecurityEventType {
  PROMPT_INJECTION_ATTEMPT = 'prompt_injection_attempt',
  SOCIAL_ENGINEERING_ATTEMPT = 'social_engineering_attempt',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  ANOMALOUS_REQUEST = 'anomalous_request',
  TRUST_MANIPULATION = 'trust_manipulation',
  IDENTITY_SPOOFING = 'identity_spoofing',
  MULTI_ACCOUNT_ABUSE = 'multi_account_abuse',
  CREDENTIAL_THEFT_ATTEMPT = 'credential_theft_attempt',
  PHISHING_ATTEMPT = 'phishing_attempt',
  IMPERSONATION_ATTEMPT = 'impersonation_attempt',
  COORDINATED_ATTACK = 'coordinated_attack',
  MALICIOUS_LINK_CAMPAIGN = 'malicious_link_campaign',
}

export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ThreatType {
  PROMPT_INJECTION = 'prompt_injection',
  SOCIAL_ENGINEERING = 'social_engineering',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  IDENTITY_SPOOFING = 'identity_spoofing',
  MULTI_ACCOUNT_ABUSE = 'multi_account_abuse',
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',
  MALICIOUS_CONTENT = 'malicious_content',
  CREDENTIAL_THEFT = 'credential_theft',
  PHISHING = 'phishing',
  IMPERSONATION = 'impersonation',
  COORDINATION = 'coordination',
  SPAM = 'spam',
  COORDINATED_ATTACK = 'coordinated_attack',
  TRUST_MANIPULATION = 'trust_manipulation',
  SYSTEM_PROBE = 'system_probe',
  SYBIL_ATTACK = 'sybil_attack',
  MULTI_STAGE_ATTACK = 'multi_stage_attack',
  UNKNOWN = 'unknown',
}

export interface SecurityThreat {
  id?: UUID;
  type: ThreatType;
  severity: ThreatSeverity;
  confidence: number;
  description: UUID;
  evidence?: any[];
  mitigation?: UUID;
}

export interface PatternDetection {
  type: 'multi_account' | 'phishing' | 'impersonation' | 'coordination' | 'credential_theft';
  confidence: number;
  evidence: UUID[];
  relatedEntities?: UUID[];
  recommendation: UUID;
}

export interface MultiAccountDetection extends PatternDetection {
  type: 'multi_account';
  primaryAccount: UUID;
  linkedAccounts: UUID[];
  linkageEvidence: {
    typingPattern: number;
    timingPattern: number;
    vocabularyPattern: number;
    behaviorPattern: number;
  };
}

export interface PhishingDetection extends PatternDetection {
  type: 'phishing';
  maliciousLinks?: UUID[];
  targetedEntities: UUID[];
  campaignId?: UUID;
}

export interface ImpersonationDetection extends PatternDetection {
  type: 'impersonation';
  impersonator: UUID;
  impersonated: UUID;
  visualSimilarity: number;
  timingCoincidence: number;
}

export interface CoordinationDetection extends PatternDetection {
  type: 'coordination';
  coordinatedEntities: UUID[];
  timeWindow: number;
  correlationScore: number;
}

export interface CredentialTheftDetection extends PatternDetection {
  type: 'credential_theft';
  sensitivePatterns: UUID[];
  attemptedTheft: UUID[];
  potentialVictims: UUID[];
}

// BehavioralProfile is defined in trust.ts, import from there if needed

export interface Memory {
  id: UUID;
  entityId: UUID;
  content: UUID;
  timestamp: number;
  roomId?: UUID;
  replyTo?: UUID;
}

export interface Action {
  id: UUID;
  entityId: UUID;
  type: UUID;
  timestamp: number;
  target?: UUID;
  result?: 'success' | 'failure';
}
