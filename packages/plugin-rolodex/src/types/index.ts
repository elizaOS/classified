import { type UUID, type Memory as _Memory } from '@elizaos/core';

// Simple, flexible types that let the LLM determine categorization
export interface EntityProfile {
  entityId: UUID;
  agentId: UUID;
  type: string; // LLM-determined: person, organization, bot, etc
  names: string[];
  summary: string; // LLM-generated summary
  tags: string[]; // LLM-extracted tags
  platforms: { [platform: string]: string | any }; // platform -> identifier or platform data object
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;

  // Legacy properties for backward compatibility
  id?: UUID;
  entityType?: EntityType;
  classification?: EntityClassification;
  trustScore?: number;
  trustMetrics?: TrustMetrics;
  trustHistory?: TrustEvent[];
  behaviorProfile?: BehaviorProfile;
  platformIdentities?: PlatformIdentity[];
  privacyLevel?: PrivacyLevel;
  lastInteractionAt?: string;
}

export interface Relationship {
  id: UUID;
  sourceEntityId: UUID;
  targetEntityId: UUID;
  type: string; // LLM-determined type
  strength: number; // 0-100
  sentiment: number; // -100 to 100
  lastInteraction: string;
  metadata: Record<string, any>;
}

export interface EntitySearchResult {
  entity: EntityProfile;
  relevanceScore: number;
  matchReason: string;
}

export interface FollowUp {
  id: UUID;
  entityId: UUID;
  message: string;
  scheduledFor: string;
  completed: boolean;
  metadata?: Record<string, any>;
}

// Action result types
export interface StandardActionResult<T = any> {
  success: boolean;
  actionName: string;
  entityId: UUID;
  data: T;
  metadata: {
    executedAt: string;
    executionTime: number;
    error?: string;
  };
}

// Error classes - re-exported from errors module
export { EntityNotFoundError, WorldNotFoundError } from '../errors';

// Enum definitions
export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  BOT = 'bot',
  SYSTEM = 'system',
}

export enum EntityClassification {
  PUBLIC = 'public',
  PRIVATE = 'private',
  INTERNAL = 'internal',
  ALLY = 'ally',
  ENEMY = 'enemy',
  NEUTRAL = 'neutral',
  UNKNOWN = 'unknown',
}

export enum RelationshipType {
  COLLEAGUE = 'colleague',
  FRIEND = 'friend',
  FAMILY = 'family',
  BUSINESS = 'business',
  REPORTS_TO = 'reports-to',
  COLLABORATES_WITH = 'collaborates-with',
  CO_AUTHOR = 'co-author',
  ACQUAINTANCE = 'acquaintance',
  COMPETITOR = 'competitor',
  ADVERSARY = 'adversary',
  UNKNOWN = 'unknown',
}

export enum PrivacyLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
  CONFIDENTIAL = 'confidential',
}

// Legacy types for EntityRelationshipService compatibility
export interface EntityRelationship extends Relationship {
  relationshipType: RelationshipType;
  dimensions?: RelationshipDimensions;
  history?: InteractionHistory;
}

export interface RelationshipDimensions {
  trust: number;
  affinity: number;
  influence: number;
  reciprocity: number;
  stability: number;
}

export interface SearchQuery {
  text?: string;
  entityTypes?: EntityType[];
  classifications?: EntityClassification[];
  trustRange?: { min: number; max: number };
  tags?: string[];
  platforms?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResults {
  matches: EntityMatch[];
  total: number;
  query: SearchQuery;
  executionTime: number;
}

export interface EntityMatch {
  entity: EntityProfile;
  score: number;
  matchedOn: string[];
  distance?: number;
}

export interface NetworkSearchResult {
  nodes: any[];
  edges: any[];
  clusters: UUID[][];
  metrics: {
    density: number;
    avgPathLength: number;
    clusteringCoefficient: number;
  };
}

export interface MergeSuggestion {
  entities: UUID[];
  confidence: number;
  reasons: string[];
  conflicts: Array<{
    field: string;
    values: any[];
  }>;
  suggestedResolution: Partial<EntityProfile>;
}

export interface ThreatIndicator {
  type: 'spam' | 'phishing' | 'manipulation' | 'impersonation' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: string[];
  detectedAt: string;
}

export interface TrustMetrics {
  baseScore: number;
  confidence: number;
  lastEvaluated: Date;
  factors: any[];
  trend: string;
}

export interface TrustEvent {
  id: UUID;
  entityId: UUID;
  eventType: string;
  impact: number;
  reason: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface BehaviorProfile {
  reliability: number;
  consistency: number;
  reciprocity: number;
  transparency: number;
  responsiveness: number;
}

export interface TrustContext {
  entityId: UUID;
  context: string;
}

export interface PlatformIdentity {
  platform: string;
  handle: string;
  userId?: string;
  verified: boolean;
  confidence: number;
}

export interface EntityMetadata {
  bio?: string;
  location?: string;
  timezone?: string;
  language?: string;
  interests?: string[];
  skills?: string[];
  notes?: string;
}

export interface InteractionEvent {
  sourceEntityId: UUID;
  targetEntityId: UUID;
  roomId: UUID;
  messageId?: UUID;
  type: string;
  content?: string;
  sentiment?: number;
  metadata?: Record<string, any>;
}

export interface InteractionHistory {
  events: InteractionEvent[];
  totalCount: number;
  firstInteraction: string;
  lastInteraction: string;
  averageSentiment: number;
}

export interface RelationshipMetadata extends Record<string, any> {
  establishedAt: string;
  establishedBy: string;
  confidence: number;
  notes?: string;
  tags?: string[];
}
