import type { UUID } from '@elizaos/core';

/**
 * Trust score with dimensional breakdown
 */
export interface TrustScore {
  overall: number;
  dimensions: TrustDimensions;
  confidence: number;
  lastUpdated: number;
  trend: 'improving' | 'declining' | 'stable';
  reputation: 'untrusted' | 'poor' | 'fair' | 'good' | 'excellent' | 'exceptional';
}

/**
 * Core trust dimensions based on interpersonal trust theory
 */
export interface TrustDimensions {
  /** Consistency in behavior and promise keeping (0-100) */
  reliability: number;

  /** Ability to perform tasks and provide value (0-100) */
  competence: number;

  /** Adherence to ethical principles (0-100) */
  integrity: number;

  /** Good intentions towards others (0-100) */
  benevolence: number;

  /** Open and honest communication (0-100) */
  transparency: number;
}

/**
 * Semantic trust evidence - analyzed by LLM instead of hardcoded types
 */
export interface SemanticTrustEvidence {
  /** Natural language description of the evidence */
  description: string;

  /** LLM-determined impact on trust (-100 to +100) */
  impact: number;

  /** LLM-determined category (positive, negative, neutral) */
  sentiment: 'positive' | 'negative' | 'neutral';

  /** Which trust dimensions this evidence affects */
  affectedDimensions: Partial<TrustDimensions>;

  /** Confidence in the analysis (0-1) */
  analysisConfidence: number;

  /** Original context/message that generated this evidence */
  sourceContent?: string;

  timestamp: number;
  reportedBy: UUID;
  context: TrustContext;
}

/**
 * @deprecated Use SemanticTrustEvidence instead. This will be removed in a future version.
 */
export enum TrustEvidenceType {
  // Positive evidence
  PROMISE_KEPT = 'PROMISE_KEPT',
  HELPFUL_ACTION = 'HELPFUL_ACTION',
  CONSISTENT_BEHAVIOR = 'CONSISTENT_BEHAVIOR',
  VERIFIED_IDENTITY = 'VERIFIED_IDENTITY',
  COMMUNITY_CONTRIBUTION = 'COMMUNITY_CONTRIBUTION',
  SUCCESSFUL_TRANSACTION = 'SUCCESSFUL_TRANSACTION',
  IDENTITY_CLAIMED = 'IDENTITY_CLAIMED',
  IDENTITY_CORROBORATED = 'IDENTITY_CORROBORATED',
  TRUST_RECOVERY = 'TRUST_RECOVERY',

  // Negative evidence
  PROMISE_BROKEN = 'PROMISE_BROKEN',
  HARMFUL_ACTION = 'HARMFUL_ACTION',
  INCONSISTENT_BEHAVIOR = 'INCONSISTENT_BEHAVIOR',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  FAILED_VERIFICATION = 'FAILED_VERIFICATION',
  SPAM_BEHAVIOR = 'SPAM_BEHAVIOR',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  TRUST_DECAY = 'TRUST_DECAY',

  // Neutral evidence
  IDENTITY_CHANGE = 'IDENTITY_CHANGE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  CONTEXT_SWITCH = 'CONTEXT_SWITCH',

  // LLM-analyzed evidence
  SEMANTIC_ANALYSIS = 'SEMANTIC_ANALYSIS',
}

/**
 * A piece of evidence that affects trust
 */
export interface TrustEvidence {
  type: TrustEvidenceType;
  timestamp: number;
  /** Impact on trust score (-100 to +100) */
  impact: number;
  /** Weight/importance of this evidence (0-1) */
  weight: number;
  /** Optional description of the evidence */
  description: string;
  /** Entity who reported/created this evidence */
  reportedBy: UUID;
  /** Whether this evidence has been verified */
  verified: boolean;
  /** Context where this evidence occurred */
  context: TrustContext;
  targetEntityId: UUID;
  evaluatorId: UUID;
  metadata?: any;
}

/**
 * Trust profile for an entity
 */
export interface TrustProfile {
  /** Entity this profile belongs to */
  entityId: UUID;

  /** Core trust dimensions */
  dimensions: TrustDimensions;

  /** Overall trust score (0-100) */
  overallTrust: number;

  /** Confidence in the trust score (0-1) */
  confidence: number;

  /** Number of interactions used to calculate trust */
  interactionCount: number;

  /** Evidence supporting this trust profile */
  evidence: TrustEvidence[];

  /** When this profile was last calculated */
  lastCalculated: number;

  /** Method used to calculate trust */
  calculationMethod: string;

  /** Trust trend over time */
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    changeRate: number; // Points per day
    lastChangeAt: number;
  };
  evaluatorId: UUID;
}

/**
 * Context for trust calculations
 */
export interface TrustContext {
  /** The entity whose trust is being evaluated */
  entityId: UUID;
  /** The entity performing the evaluation (e.g., the agent) */
  evaluatorId?: UUID;
  /** Specific context for evaluation */
  worldId?: UUID;
  roomId?: UUID;
  platform?: string;

  /** Type of action being considered */
  action?: string;

  /** Time window for evidence consideration */
  timeWindow?: {
    start: number;
    end: number;
  };
}

/**
 * Result of a trust-based decision
 */
export interface TrustDecision {
  approved: boolean;
  trustScore: number;
  confidence: number;
  /** Which dimensions were evaluated */
  dimensionsChecked?: Partial<TrustDimensions>;
  /** Reason for the decision */
  reason?: string;
  explanation?: string;
  /** Suggestions for building trust if denied */
  suggestions?: string[];
  requirements?: TrustRequirements;
  context?: any;
  timestamp?: number;
  metadata?: any;
}

/**
 * Configuration for trust requirements
 */
export interface TrustRequirements {
  /** Minimum overall trust score */
  minimumTrust: number;

  /** Required dimension scores */
  dimensions?: {
    reliability?: number;
    competence?: number;
    integrity?: number;
    benevolence?: number;
    transparency?: number;
  };

  /** Required evidence types */
  requiredEvidence?: TrustEvidenceType[];

  /** Minimum interaction count */
  minimumInteractions?: number;

  /** Required confidence level */
  minimumConfidence?: number;

  context?: any;
  evaluatorId?: UUID;
  timestamp?: number;
}

/**
 * Trust interaction to be recorded
 */
export interface TrustInteraction {
  sourceEntityId: UUID;
  targetEntityId: UUID;
  type: TrustEvidenceType;
  timestamp: number;
  impact: number;
  details?: {
    description?: string;
    messageId?: UUID;
    roomId?: UUID;
    [key: string]: any;
  };
  context?: TrustContext;
  metadata?: any;
}

/**
 * Trust calculation configuration
 */
export interface TrustCalculationConfig {
  /** How much recent evidence is weighted vs old */
  recencyBias: number; // 0-1

  /** How fast evidence decays over time */
  evidenceDecayRate: number; // Points per day

  /** Minimum evidence required for confidence */
  minimumEvidenceCount: number;

  /** How much to weight verified vs unverified evidence */
  verificationMultiplier: number;

  /** Dimension weights for overall score */
  dimensionWeights: {
    reliability: number;
    competence: number;
    integrity: number;
    benevolence: number;
    transparency: number;
  };
}

/**
 * Represents a trusted entity in the system
 */
export interface TrustEntity {
  id: UUID;
  name: string;
  type: 'user' | 'agent' | 'service' | 'unknown';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contextual role assignment for an entity
 */
export interface ContextualRole {
  id: UUID;
  entityId: UUID;
  role: string;
  assignedBy: UUID;
  context?: Record<string, any>;
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * Security incident record
 */
export interface SecurityIncident {
  id: UUID;
  entityId: UUID;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  details?: Record<string, any>;
  timestamp: Date;
  handled: 'pending' | 'resolved' | 'ignored';
}

/**
 * Behavioral profile for multi-account detection
 */
export interface BehavioralProfile {
  id: UUID;
  entityId: UUID;
  typingSpeed: number;
  vocabularyComplexity: number;
  messageLengthMean: number;
  messageLengthStdDev: number;
  activeHours: number[];
  commonPhrases: string[];
  interactionPatterns: Record<string, any>;
  updatedAt: Date;
}

/**
 * Identity link between entities across platforms
 */
export interface IdentityLink {
  id: UUID;
  entityIdA: UUID;
  entityIdB: UUID;
  confidence: number;
  evidence: any[];
  updatedAt: Date;
}

/**
 * Whistleblower report
 */
export interface WhistleblowerReport {
  id: UUID;
  reportedEntityId: UUID;
  evidence: Record<string, any>;
  status: 'pending' | 'investigating' | 'resolved';
  createdAt: Date;
}
