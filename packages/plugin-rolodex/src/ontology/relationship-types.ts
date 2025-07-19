/**
 * Comprehensive Relationship Ontology for ElizaOS Rolodex Plugin
 *
 * This ontology defines all possible relationship dimensions between entities,
 * supporting multi-dimensional relationships where entities can have multiple
 * concurrent relationship types with varying strengths.
 */

import { UUID } from '@elizaos/core';

/**
 * Core relationship categories that group related relationship types
 */
export enum RelationshipCategory {
  PROFESSIONAL = 'professional',
  PERSONAL = 'personal',
  SOCIAL = 'social',
  ADVERSARIAL = 'adversarial',
  TRANSACTIONAL = 'transactional',
  EDUCATIONAL = 'educational',
  CREATIVE = 'creative',
  COMMUNITY = 'community',
}

/**
 * Evidence types that support relationship dimension calculations
 */
export enum EvidenceType {
  DIRECT_STATEMENT = 'direct_statement', // "She's my manager"
  INTERACTION_PATTERN = 'interaction_pattern', // Frequency and quality of interactions
  CONTEXTUAL_CLUE = 'contextual_clue', // "We work on the same team"
  BEHAVIORAL_INDICATOR = 'behavioral_indicator', // How they interact
  THIRD_PARTY = 'third_party', // Someone else mentioned the relationship
  HISTORICAL = 'historical', // Past interactions
  INFERRED = 'inferred', // System inference from patterns
}

/**
 * Source of relationship evidence
 */
export interface EvidenceSource {
  type: 'message' | 'action' | 'external' | 'system';
  id: UUID;
  timestamp: Date;
  confidence: number;
}

/**
 * Individual piece of evidence supporting a relationship dimension
 */
export interface RelationshipEvidence {
  type: EvidenceType;
  content: string;
  weight: number; // 0-1, how much this evidence contributes
  source: EvidenceSource;
  timestamp: Date;
}

/**
 * A single dimension of a multi-dimensional relationship
 */
export interface RelationshipDimension {
  category: RelationshipCategory;
  type: string; // Specific type within category
  strength: number; // 0-1, computed from evidence
  confidence: number; // 0-1, how confident we are in this dimension
  evidence: RelationshipEvidence[];
  firstDetected: Date;
  lastUpdated: Date;
  trajectory: 'strengthening' | 'weakening' | 'stable' | 'volatile';
}

/**
 * Metadata for tracking relationship changes over time
 */
export interface RelationshipMetadata {
  totalInteractions: number;
  lastInteractionAt: Date;
  establishedAt: Date;
  peakStrength: number;
  peakStrengthAt: Date;
  volatility: number; // How much the relationship fluctuates
  healthScore: number; // Overall relationship health
  nextFollowUpAt?: Date;
  notes?: string[];
  tags?: string[];
  customDimensions?: Record<string, any>;
}

/**
 * Composite view of a multi-dimensional relationship
 */
export interface CompositeRelationship {
  overallStrength: number; // Weighted average across dimensions
  primaryDimension: RelationshipDimension | null;
  secondaryDimensions: RelationshipDimension[];
  complexity: number; // How many significant dimensions exist
  trajectory: 'improving' | 'declining' | 'stable' | 'turbulent';
  narrativeSummary?: string; // Natural language description
}

/**
 * Complete multi-dimensional relationship between two entities
 */
export interface RelationshipMatrix {
  id: UUID;
  sourceEntityId: UUID;
  targetEntityId: UUID;
  dimensions: RelationshipDimension[];
  composite: CompositeRelationship;
  metadata: RelationshipMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuration for relationship analysis
 */
export interface RelationshipAnalysisConfig {
  minConfidence: number; // Minimum confidence to establish a dimension
  evidenceDecayRate: number; // How quickly old evidence loses weight
  dimensionThreshold: number; // Minimum strength to maintain a dimension
  maxDimensions: number; // Maximum concurrent dimensions to track
  enableInference: boolean; // Whether to infer relationships from patterns
}

/**
 * Default configuration values
 */
export const DEFAULT_ANALYSIS_CONFIG: RelationshipAnalysisConfig = {
  minConfidence: 0.3,
  evidenceDecayRate: 0.1, // 10% decay per month
  dimensionThreshold: 0.1,
  maxDimensions: 10,
  enableInference: true,
};

/**
 * Factors that influence relationship strength calculations
 */
export interface StrengthFactors {
  interactionFrequency: number; // How often they interact
  interactionQuality: number; // Quality/depth of interactions
  reciprocity: number; // How balanced the relationship is
  consistency: number; // How consistent the interactions are
  duration: number; // How long the relationship has existed
  recentActivity: number; // Recent interaction weight
  sentiment: number; // Overall emotional tone
  contextAlignment: number; // How well contexts align (work, personal, etc)
}

/**
 * Detailed relationship types within each category
 */
export const RELATIONSHIP_TYPES = {
  // Professional Relationships
  [RelationshipCategory.PROFESSIONAL]: {
    COLLEAGUE: {
      id: 'colleague',
      label: 'Colleague',
      description: 'Works at the same organization',
      patterns: ['colleague', 'coworker', 'work together', 'same team', 'same company'],
      strengthFactors: ['interaction_frequency', 'project_collaboration', 'communication_quality'],
    },
    MANAGER: {
      id: 'manager',
      label: 'Manager',
      description: 'Direct reporting relationship (manager)',
      patterns: ['my manager', 'reports to me', 'my direct report', 'supervise', 'manage'],
      strengthFactors: ['meeting_frequency', 'feedback_quality', 'trust_level'],
    },
    REPORT: {
      id: 'report',
      label: 'Direct Report',
      description: 'Direct reporting relationship (report)',
      patterns: ['my report', 'report to', 'work for', 'my boss'],
      strengthFactors: ['guidance_frequency', 'performance_discussions', 'career_development'],
    },
    MENTOR: {
      id: 'mentor',
      label: 'Mentor',
      description: 'Provides professional guidance and advice',
      patterns: ['mentor', 'guide', 'advisor', 'coach', 'teaches me'],
      strengthFactors: ['advice_quality', 'meeting_regularity', 'career_impact'],
    },
    MENTEE: {
      id: 'mentee',
      label: 'Mentee',
      description: 'Receives professional guidance',
      patterns: ['mentee', 'I mentor', 'I guide', 'I advise', 'I coach'],
      strengthFactors: ['receptiveness', 'progress', 'engagement'],
    },
    CLIENT: {
      id: 'client',
      label: 'Client',
      description: 'Business client relationship',
      patterns: ['client', 'customer', 'buyer', 'purchaser', 'account'],
      strengthFactors: ['contract_value', 'satisfaction', 'relationship_duration'],
    },
    VENDOR: {
      id: 'vendor',
      label: 'Vendor/Supplier',
      description: 'Provides services or products',
      patterns: ['vendor', 'supplier', 'provider', 'contractor', 'consultant'],
      strengthFactors: ['reliability', 'quality', 'communication'],
    },
    PARTNER: {
      id: 'partner',
      label: 'Business Partner',
      description: 'Strategic business partnership',
      patterns: ['partner', 'co-founder', 'business partner', 'joint venture'],
      strengthFactors: ['trust', 'shared_goals', 'contribution_balance'],
    },
    INVESTOR: {
      id: 'investor',
      label: 'Investor',
      description: 'Financial investment relationship',
      patterns: ['investor', 'invested in', 'backer', 'funder', 'LP', 'VC'],
      strengthFactors: ['investment_size', 'involvement', 'trust'],
    },
    ADVISOR: {
      id: 'advisor',
      label: 'Advisor',
      description: 'Provides strategic advice',
      patterns: ['advisor', 'board member', 'advisory board', 'counselor'],
      strengthFactors: ['advice_frequency', 'impact', 'expertise_relevance'],
    },
  },

  // Personal Relationships
  [RelationshipCategory.PERSONAL]: {
    FRIEND: {
      id: 'friend',
      label: 'Friend',
      description: 'Personal friendship',
      patterns: ['friend', 'buddy', 'pal', 'bestie', 'close friend', 'good friend'],
      strengthFactors: [
        'interaction_frequency',
        'emotional_support',
        'shared_experiences',
        'trust',
      ],
    },
    CLOSE_FRIEND: {
      id: 'close_friend',
      label: 'Close Friend',
      description: 'Deep personal friendship',
      patterns: ['best friend', 'close friend', 'dear friend', 'BFF'],
      strengthFactors: ['intimacy', 'loyalty', 'shared_history', 'emotional_bond'],
    },
    FAMILY: {
      id: 'family',
      label: 'Family',
      description: 'Family relationship',
      patterns: ['family', 'relative', 'sibling', 'parent', 'child', 'cousin', 'aunt', 'uncle'],
      strengthFactors: ['blood_relation', 'emotional_closeness', 'support', 'contact_frequency'],
    },
    ROMANTIC_PARTNER: {
      id: 'romantic_partner',
      label: 'Romantic Partner',
      description: 'Current romantic relationship',
      patterns: [
        'partner',
        'boyfriend',
        'girlfriend',
        'spouse',
        'husband',
        'wife',
        'significant other',
      ],
      strengthFactors: ['commitment', 'intimacy', 'shared_life', 'future_plans'],
    },
    EX_PARTNER: {
      id: 'ex_partner',
      label: 'Ex-Partner',
      description: 'Former romantic relationship',
      patterns: ['ex', 'former partner', 'ex-boyfriend', 'ex-girlfriend', 'ex-spouse'],
      strengthFactors: ['amicability', 'time_since_split', 'remaining_connection'],
    },
    DATING: {
      id: 'dating',
      label: 'Dating',
      description: 'Casual romantic relationship',
      patterns: ['dating', 'seeing', 'going out with', 'romantic interest'],
      strengthFactors: ['attraction', 'compatibility', 'time_together', 'exclusivity'],
    },
  },

  // Social Relationships
  [RelationshipCategory.SOCIAL]: {
    ACQUAINTANCE: {
      id: 'acquaintance',
      label: 'Acquaintance',
      description: 'Casual social connection',
      patterns: ['know', 'met', 'acquaintance', 'familiar with'],
      strengthFactors: ['recognition', 'interaction_count', 'context_overlap'],
    },
    NEIGHBOR: {
      id: 'neighbor',
      label: 'Neighbor',
      description: 'Lives nearby',
      patterns: ['neighbor', 'lives next door', 'lives nearby', 'in my building'],
      strengthFactors: ['proximity', 'interaction_frequency', 'helpfulness'],
    },
    COMMUNITY_MEMBER: {
      id: 'community_member',
      label: 'Community Member',
      description: 'Part of same community or group',
      patterns: ['community', 'group member', 'club', 'organization', 'association'],
      strengthFactors: ['participation', 'contribution', 'shared_values'],
    },
    FOLLOWER: {
      id: 'follower',
      label: 'Follower',
      description: 'Follows on social media or platforms',
      patterns: ['follower', 'follows me', 'subscriber', 'fan'],
      strengthFactors: ['engagement', 'loyalty', 'interaction_quality'],
    },
    FOLLOWING: {
      id: 'following',
      label: 'Following',
      description: 'Someone you follow',
      patterns: ['I follow', 'following', 'subscribed to', 'fan of'],
      strengthFactors: ['interest_level', 'engagement', 'value_received'],
    },
  },

  // Adversarial Relationships
  [RelationshipCategory.ADVERSARIAL]: {
    COMPETITOR: {
      id: 'competitor',
      label: 'Competitor',
      description: 'Business or professional competitor',
      patterns: ['competitor', 'rival', 'competition', 'competing with'],
      strengthFactors: ['market_overlap', 'rivalry_intensity', 'respect_level'],
    },
    RIVAL: {
      id: 'rival',
      label: 'Personal Rival',
      description: 'Personal rivalry or competition',
      patterns: ['rival', 'nemesis', 'adversary', 'opponent'],
      strengthFactors: ['conflict_intensity', 'history', 'stakes'],
    },
    BLOCKED: {
      id: 'blocked',
      label: 'Blocked',
      description: 'Blocked or avoiding contact',
      patterns: ['blocked', 'no contact', 'avoiding', 'cut off'],
      strengthFactors: ['severity', 'duration', 'reason'],
    },
    LEGAL_DISPUTE: {
      id: 'legal_dispute',
      label: 'Legal Dispute',
      description: 'Involved in legal proceedings',
      patterns: ['lawsuit', 'legal dispute', 'court case', 'litigation'],
      strengthFactors: ['case_severity', 'financial_impact', 'resolution_likelihood'],
    },
  },

  // Transactional Relationships
  [RelationshipCategory.TRANSACTIONAL]: {
    BUYER: {
      id: 'buyer',
      label: 'Buyer',
      description: 'Has purchased from',
      patterns: ['bought from', 'purchased', 'customer of'],
      strengthFactors: ['transaction_volume', 'frequency', 'satisfaction'],
    },
    SELLER: {
      id: 'seller',
      label: 'Seller',
      description: 'Has sold to',
      patterns: ['sold to', 'merchant', 'vendor to'],
      strengthFactors: ['sales_volume', 'customer_satisfaction', 'repeat_business'],
    },
    SERVICE_PROVIDER: {
      id: 'service_provider',
      label: 'Service Provider',
      description: 'Provides professional services',
      patterns: ['service provider', 'contractor', 'freelancer', 'consultant for'],
      strengthFactors: ['service_quality', 'reliability', 'expertise'],
    },
  },

  // Educational Relationships
  [RelationshipCategory.EDUCATIONAL]: {
    TEACHER: {
      id: 'teacher',
      label: 'Teacher',
      description: 'Educational instructor',
      patterns: ['teacher', 'professor', 'instructor', 'educator'],
      strengthFactors: ['teaching_quality', 'impact', 'engagement'],
    },
    STUDENT: {
      id: 'student',
      label: 'Student',
      description: 'Learning from',
      patterns: ['student', 'pupil', 'learner', 'studying under'],
      strengthFactors: ['progress', 'engagement', 'potential'],
    },
    CLASSMATE: {
      id: 'classmate',
      label: 'Classmate',
      description: 'Studies together',
      patterns: ['classmate', 'fellow student', 'study together', 'same class'],
      strengthFactors: ['collaboration', 'mutual_support', 'shared_learning'],
    },
  },

  // Creative Relationships
  [RelationshipCategory.CREATIVE]: {
    COLLABORATOR: {
      id: 'collaborator',
      label: 'Creative Collaborator',
      description: 'Works together on creative projects',
      patterns: ['collaborator', 'creative partner', 'co-creator', 'work together on'],
      strengthFactors: ['creative_synergy', 'output_quality', 'idea_exchange'],
    },
    CO_AUTHOR: {
      id: 'co_author',
      label: 'Co-Author',
      description: 'Writes or creates content together',
      patterns: ['co-author', 'co-writer', 'writing partner', 'author with'],
      strengthFactors: ['contribution_balance', 'creative_harmony', 'output_success'],
    },
    BANDMATE: {
      id: 'bandmate',
      label: 'Bandmate',
      description: 'Musical collaboration',
      patterns: ['bandmate', 'band member', 'musical partner', 'play music with'],
      strengthFactors: ['musical_chemistry', 'commitment', 'creative_alignment'],
    },
  },

  // Community Relationships
  [RelationshipCategory.COMMUNITY]: {
    VOLUNTEER: {
      id: 'volunteer',
      label: 'Fellow Volunteer',
      description: 'Volunteers together',
      patterns: ['volunteer with', 'volunteer together', 'community service'],
      strengthFactors: ['shared_values', 'commitment', 'impact'],
    },
    ORGANIZER: {
      id: 'organizer',
      label: 'Community Organizer',
      description: 'Organizes community events or initiatives',
      patterns: ['organizer', 'community leader', 'coordinator', 'runs'],
      strengthFactors: ['leadership', 'impact', 'community_trust'],
    },
    SUPPORTER: {
      id: 'supporter',
      label: 'Supporter',
      description: 'Supports initiatives or causes',
      patterns: ['supporter', 'backer', 'advocate', 'champion'],
      strengthFactors: ['commitment_level', 'contribution', 'advocacy'],
    },
  },
} as const;

/**
 * Helper to get all relationship types across categories
 */
export function getAllRelationshipTypes(): Array<{
  category: RelationshipCategory;
  type: string;
  label: string;
  patterns: string[];
}> {
  const types: Array<{
    category: RelationshipCategory;
    type: string;
    label: string;
    patterns: string[];
  }> = [];

  for (const [category, categoryTypes] of Object.entries(RELATIONSHIP_TYPES)) {
    for (const [, typeInfo] of Object.entries(categoryTypes)) {
      types.push({
        category: category as RelationshipCategory,
        type: typeInfo.id,
        label: typeInfo.label,
        patterns: typeInfo.patterns,
      });
    }
  }

  return types;
}

/**
 * Check if a text matches any relationship pattern
 */
export function matchRelationshipPattern(text: string): Array<{
  category: RelationshipCategory;
  type: string;
  confidence: number;
}> {
  const matches: Array<{
    category: RelationshipCategory;
    type: string;
    confidence: number;
  }> = [];

  const lowerText = text.toLowerCase();

  for (const [category, categoryTypes] of Object.entries(RELATIONSHIP_TYPES)) {
    for (const [, typeInfo] of Object.entries(categoryTypes)) {
      for (const pattern of typeInfo.patterns) {
        if (lowerText.includes(pattern)) {
          matches.push({
            category: category as RelationshipCategory,
            type: typeInfo.id,
            confidence: 0.7 + pattern.split(' ').length * 0.1, // Longer patterns = higher confidence
          });
          break; // Only match once per type
        }
      }
    }
  }

  return matches;
}
