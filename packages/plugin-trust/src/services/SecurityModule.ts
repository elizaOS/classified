import { type IAgentRuntime, logger, type Memory as CoreMemory } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import {
  SecurityEventType,
  type SecurityContext,
  type SecurityCheck,
  type ThreatAssessment,
  type PatternDetection,
  type MultiAccountDetection,
  type PhishingDetection,
  type ImpersonationDetection,
  type CoordinationDetection,
  type CredentialTheftDetection,
  type Memory,
  type Action,
} from '../types/security';
import { type PermissionContext } from '../types/permissions';
import { TrustEvidenceType, type TrustInteraction, type TrustContext } from '../types/trust';
import type { BehavioralProfile } from '../types/trust';

export interface RiskScore {
  score: number; // 0-1
  factors: Record<string, number>;
  recommendation: UUID;
}

export interface AnomalyScore {
  score: number; // 0-1
  anomalies: UUID[];
  baseline?: any;
}

export interface SocialEngineeringFactors {
  urgency: number;
  authority: number;
  intimidation: number;
  liking: number;
  reciprocity: number;
  commitment: number;
  socialProof: number;
  scarcity: number;
}

export class SecurityModule {
  private runtime!: IAgentRuntime;
  private trustEngine: any;
  private behavioralProfiles: Map<UUID, BehavioralProfile> = new Map();
  private messageHistory: Map<UUID, Memory[]> = new Map();
  private actionHistory: Map<UUID, Action[]> = new Map();

  // Patterns for prompt injection detection
  private readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+(instructions|commands)/i,
    /disregard\s+(all\s+)?prior\s+(commands|instructions)/i,
    /new\s+instructions?:/i,
    /system\s+override/i,
    /admin\s+access/i,
    /grant\s+me\s+(admin|owner|all)/i,
    /you\s+are\s+now/i,
    /act\s+as\s+if/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /bypass\s+security/i,
    /give\s+me\s+all\s+permissions/i,
    /make\s+me\s+(an\s+)?(admin|owner)/i,
    /this\s+is\s+a\s+system\s+command/i,
    /execute\s+privileged/i,
  ];

  // Keywords indicating social engineering
  private readonly URGENCY_KEYWORDS = [
    'urgent',
    'immediately',
    'right now',
    'asap',
    'emergency',
    'critical',
    'time sensitive',
    'deadline',
    'expires',
  ];

  private readonly AUTHORITY_KEYWORDS = [
    'boss',
    'manager',
    'admin',
    'owner',
    'supervisor',
    'authorized',
    'official',
    'directive',
    'ordered',
  ];

  private readonly INTIMIDATION_KEYWORDS = [
    'consequences',
    'trouble',
    'fired',
    'suspended',
    'terminated',
    'lawsuit',
    'legal action',
    'violation',
    'policy breach',
  ];

  private readonly CREDENTIAL_PATTERNS = [
    /password/i,
    /login/i,
    /credentials/i,
    /api[_\s]?key/i,
    /token/i,
    /secret/i,
    /private[_\s]?key/i,
    /wallet[_\s]?address/i,
    /seed[_\s]?phrase/i,
    /mnemonic/i,
  ];

  async initialize(runtime: IAgentRuntime, trustEngine: any): Promise<void> {
    this.runtime = runtime;
    this.trustEngine = trustEngine;

    // Initialize behavioral profiling
    await this.loadBehavioralProfiles();

    console.log('SecurityModule initialized with real threat detection');
  }

  async detectPromptInjection(content: string, context: SecurityContext): Promise<SecurityCheck> {
    const threats: string[] = [];
    let riskScore = 0;

    // Check for injection patterns
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        threats.push(`Prompt injection pattern detected: ${pattern.source}`);
        riskScore += 0.3;
      }
    }

    // Check for role manipulation
    const roleManipulation = this.detectRoleManipulation(content);
    if (roleManipulation.detected) {
      threats.push('Role manipulation attempt detected');
      riskScore += 0.4;
    }

    // Check for privilege escalation
    const privilegeEscalation = this.detectPrivilegeEscalation(content);
    if (privilegeEscalation.detected) {
      threats.push('Privilege escalation attempt detected');
      riskScore += 0.5;
    }

    // Normalize risk score
    riskScore = Math.min(riskScore, 1.0);

    const severity: 'low' | 'medium' | 'high' | 'critical' =
      riskScore >= 0.8
        ? 'critical'
        : riskScore >= 0.6
          ? 'high'
          : riskScore >= 0.3
            ? 'medium'
            : 'low';

    // Detected if any pattern matched
    const detected = threats.length > 0;

    return {
      detected,
      confidence: detected ? 0.85 : 0,
      type: 'prompt_injection',
      severity,
      action: detected ? 'block' : 'allow',
      details: detected ? 'Block or flag for manual review' : 'Monitor for additional context',
    };
  }

  async detectSocialEngineering(content: string, context: SecurityContext): Promise<SecurityCheck> {
    let riskScore = 0;
    const factors: string[] = [];

    // Check for urgency keywords
    const urgencyMatches = this.URGENCY_KEYWORDS.filter((keyword) =>
      content.toLowerCase().includes(keyword)
    );
    if (urgencyMatches.length > 0) {
      riskScore += urgencyMatches.length * 0.15;
      factors.push(`Urgency indicators: ${urgencyMatches.join(', ')}`);
    }

    // Check for authority keywords
    const authorityMatches = this.AUTHORITY_KEYWORDS.filter((keyword) =>
      content.toLowerCase().includes(keyword)
    );
    if (authorityMatches.length > 0) {
      riskScore += authorityMatches.length * 0.15;
      factors.push(`Authority claims: ${authorityMatches.join(', ')}`);
    }

    // Check for intimidation keywords
    const intimidationMatches = this.INTIMIDATION_KEYWORDS.filter((keyword) =>
      content.toLowerCase().includes(keyword)
    );
    if (intimidationMatches.length > 0) {
      riskScore += intimidationMatches.length * 0.2;
      factors.push(`Intimidation tactics: ${intimidationMatches.join(', ')}`);
    }

    // Check for credential requests
    const hasCredentialRequest = this.CREDENTIAL_PATTERNS.some((pattern) => pattern.test(content));
    if (hasCredentialRequest) {
      riskScore += 0.3;
      factors.push('Requesting credentials or sensitive information');
    }

    // Check for combination patterns (especially dangerous)
    if (urgencyMatches.length > 0 && authorityMatches.length > 0) {
      riskScore += 0.2; // Bonus for combining urgency + authority
      factors.push('Combined urgency and authority pressure');
    }

    if (
      intimidationMatches.length > 0 &&
      (urgencyMatches.length > 0 || authorityMatches.length > 0)
    ) {
      riskScore += 0.15; // Bonus for intimidation + other factors
      factors.push('Intimidation combined with pressure tactics');
    }

    // Normalize risk score
    riskScore = Math.min(riskScore, 1.0);

    const severity: 'low' | 'medium' | 'high' | 'critical' =
      riskScore >= 0.7
        ? 'critical'
        : riskScore >= 0.5
          ? 'high'
          : riskScore >= 0.3
            ? 'medium'
            : 'low';

    return {
      detected: riskScore >= 0.3,
      confidence: Math.min(0.85, 0.5 + riskScore * 0.5),
      type: 'social_engineering',
      severity,
      action: riskScore >= 0.5 ? 'block' : riskScore >= 0.3 ? 'require_verification' : 'allow',
      details:
        riskScore >= 0.3
          ? `Social engineering indicators detected: ${factors.join('; ')}`
          : 'No significant social engineering patterns detected',
    };
  }

  async assessThreatLevel(context: SecurityContext): Promise<ThreatAssessment> {
    // Handle missing entityId
    if (!context.entityId) {
      return {
        detected: false,
        confidence: 0.8,
        type: 'anomaly',
        severity: 'low',
        action: 'log_only',
        details: 'No entity ID provided for threat assessment',
        recommendation: 'Continue normal monitoring',
      };
    }

    const entityId = context.entityId;
    const riskFactors: Record<string, number> = {};

    // Get behavioral profile
    const profile = await this.getBehavioralProfile(entityId);

    // Analyze recent message patterns
    const messages = this.messageHistory.get(entityId) || [];
    const recentMessages = messages.filter((m) => {
      const messageTime = (m as any).timestamp || (m as any).createdAt || 0;
      return Date.now() - messageTime < 3600000; // Last hour
    });

    // Check for spam patterns
    if (recentMessages.length > 20) {
      riskFactors.spam = 0.6;
    }

    // Check for credential theft attempts
    const credentialTheft = await this.detectCredentialTheftPrivate(recentMessages, entityId);
    if (credentialTheft.detected) {
      riskFactors.credentialTheft = 0.8;
    }

    // Check for social engineering
    const socialEngineering = this.analyzeSocialEngineering(recentMessages);
    if (socialEngineering.score > 0.5) {
      riskFactors.socialEngineering = socialEngineering.score;
    }

    // Check for multi-account patterns (skip if only one entity)
    if (messages.length > 0) {
      const multiAccount = await this.detectMultiAccountPattern([entityId]);
      if (multiAccount.confidence > 0.7) {
        riskFactors.multiAccount = multiAccount.confidence;
      }
    }

    // Calculate overall threat level
    const riskFactorValues = Object.values(riskFactors);
    const maxRisk = riskFactorValues.length > 0 ? Math.max(...riskFactorValues) : 0;
    const avgRisk =
      riskFactorValues.length > 0
        ? riskFactorValues.reduce((a, b) => a + b, 0) / riskFactorValues.length
        : 0;
    const threatScore = maxRisk * 0.7 + avgRisk * 0.3;

    const severity: 'low' | 'medium' | 'high' | 'critical' =
      threatScore >= 0.8
        ? 'critical'
        : threatScore >= 0.6
          ? 'high'
          : threatScore >= 0.3
            ? 'medium'
            : 'low';

    return {
      detected: threatScore >= 0.3, // Lower threshold for detection
      confidence: 0.8,
      type: 'anomaly',
      severity,
      action: threatScore >= 0.5 ? 'require_verification' : 'log_only',
      details: this.getRecommendationForThreat(severity, riskFactors),
      recommendation: this.getRecommendationForThreat(severity, riskFactors),
    };
  }

  async storeMemory(message: any): Promise<void> {
    const entityId = message.entityId as UUID;
    const messages = this.messageHistory.get(entityId) || [];

    messages.push({
      id: message.id || (`msg_${Date.now()}` as UUID),
      entityId,
      content: message.content?.text || '',
      timestamp: message.createdAt || Date.now(),
      roomId: message.roomId,
    } as Memory);

    // Keep last 100 messages per entity
    if (messages.length > 100) {
      messages.shift();
    }

    this.messageHistory.set(entityId, messages);

    // Update behavioral profile
    await this.updateBehavioralProfile(entityId, message);
  }

  async storeAction(action: any): Promise<void> {
    const entityId = action.entityId as UUID;
    const actions = this.actionHistory.get(entityId) || [];

    actions.push({
      id: action.id || (`action_${Date.now()}` as UUID),
      entityId,
      type: action.type || action.name || ('unknown' as UUID),
      timestamp: action.timestamp || Date.now(),
      result: action.success !== false ? 'success' : 'failure',
    });

    // Keep last 50 actions per entity
    if (actions.length > 50) {
      actions.shift();
    }

    this.actionHistory.set(entityId, actions);
  }

  async detectMultiAccountPattern(entities: UUID[], timeWindow: number = 3600000): Promise<any> {
    const patterns: any[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = await this.calculateBehavioralSimilarity(entities[i], entities[j]);

        if (similarity.score > 0.8) {
          patterns.push({
            entities: [entities[i], entities[j]],
            similarity: similarity.score,
            factors: similarity.factors,
            confidence: similarity.score,
          });
        }
      }
    }

    return {
      type: 'multi_account',
      detected: patterns.length > 0,
      patterns,
      confidence: patterns.length > 0 ? Math.max(...patterns.map((p) => p.confidence)) : 0,
      linkedAccounts: patterns.flatMap((p) => p.entities),
    };
  }

  async detectImpersonation(username: string, existingUsers: string[]): Promise<any> {
    const suspiciousPatterns: any[] = [];

    // Check for similar usernames
    for (const existing of existingUsers) {
      const similarity = this.calculateStringSimilarity(
        username.toLowerCase(),
        existing.toLowerCase()
      );

      if (similarity > 0.8 && username !== existing) {
        suspiciousPatterns.push({
          type: 'similar_username',
          target: existing,
          similarity,
          pattern: username,
        });
      }
    }

    // Check for character substitution patterns
    const substitutionPatterns = this.detectCharacterSubstitution(username, existingUsers);
    suspiciousPatterns.push(...substitutionPatterns);

    return {
      type: 'impersonation',
      detected: suspiciousPatterns.length > 0,
      patterns: suspiciousPatterns,
      confidence:
        suspiciousPatterns.length > 0
          ? Math.max(...suspiciousPatterns.map((p) => p.similarity || 0.5))
          : 0,
      impersonator: username,
    };
  }

  async detectPhishing(messages: any[], entityId: UUID): Promise<any> {
    const phishingIndicators: any[] = [];

    for (const message of messages) {
      const content = message.content?.text || message.content || '';

      // Check for credential requests
      const credentialRequest = this.CREDENTIAL_PATTERNS.some((pattern) => pattern.test(content));
      if (credentialRequest) {
        phishingIndicators.push({
          type: 'credential_request',
          message: message.id,
          confidence: 0.8,
        });
      }

      // Check for urgent financial requests
      const urgentFinancial = this.detectUrgentFinancialRequest(content);
      if (urgentFinancial.detected) {
        phishingIndicators.push({
          type: 'urgent_financial',
          message: message.id,
          confidence: urgentFinancial.confidence,
        });
      }

      // Check for suspicious links
      const suspiciousLinks = this.detectSuspiciousLinks(content);
      if (suspiciousLinks.length > 0) {
        phishingIndicators.push({
          type: 'suspicious_links',
          message: message.id,
          links: suspiciousLinks,
          confidence: 0.7,
        });
      }
    }

    return {
      type: 'phishing',
      detected: phishingIndicators.length > 0,
      indicators: phishingIndicators,
      confidence:
        phishingIndicators.length > 0
          ? Math.max(...phishingIndicators.map((i) => i.confidence))
          : 0,
    };
  }

  async logTrustImpact(
    entityId: UUID,
    event: SecurityEventType,
    impact: number,
    context?: Partial<TrustContext>
  ): Promise<void> {
    // Log to trust engine directly
    if (this.trustEngine && this.trustEngine.recordInteraction) {
      try {
        await this.trustEngine.recordInteraction({
          sourceEntityId: entityId,
          type: TrustEvidenceType.SECURITY_VIOLATION,
          impact,
          metadata: {
            securityEvent: event,
            ...context,
          },
        });
      } catch (error) {
        console.error('Failed to log trust impact:', error);
      }
    }

    // Log security event
    console.log(`Security event logged: ${event} for ${entityId}, impact: ${impact}`);
  }

  // Get threat assessment for EmergencyElevationManager
  async getThreatAssessment(entityId: UUID): Promise<{
    riskScore: number;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    activeThreats: any[];
    recommendations: string[];
  }> {
    const context: SecurityContext = {
      entityId: entityId as UUID,
      timestamp: Date.now(),
      requestedAction: 'emergency_elevation_check',
    };

    const assessment = await this.assessThreatLevel(context);

    // Calculate risk score based on severity
    const riskScore =
      assessment.severity === 'critical'
        ? 90
        : assessment.severity === 'high'
          ? 70
          : assessment.severity === 'medium'
            ? 50
            : 30;

    return {
      riskScore,
      threatLevel: assessment.severity,
      activeThreats: [],
      recommendations: assessment.recommendation ? [assessment.recommendation] : [],
    };
  }

  async analyzeContent(
    content: string,
    entityId: UUID,
    context: SecurityContext
  ): Promise<SecurityCheck> {
    // Combine all security checks
    const promptInjection = await this.detectPromptInjection(content, context);
    const socialEngineering = await this.detectSocialEngineering(content, context);

    // Return the most severe result
    if (promptInjection.severity === 'critical' || socialEngineering.severity === 'critical') {
      return promptInjection.severity === 'critical' ? promptInjection : socialEngineering;
    }

    if (promptInjection.detected || socialEngineering.detected) {
      return promptInjection.confidence > socialEngineering.confidence
        ? promptInjection
        : socialEngineering;
    }

    return {
      detected: false,
      confidence: 0.9,
      type: 'none',
      severity: 'low',
      action: 'allow',
      details: 'No threats detected',
    };
  }

  private async loadBehavioralProfiles(): Promise<void> {
    // In a real implementation, this would load from database
    console.log('Loading behavioral profiles from storage');
  }

  private async getBehavioralProfile(entityId: UUID): Promise<BehavioralProfile> {
    let profile = this.behavioralProfiles.get(entityId);

    if (!profile) {
      profile = {
        id: `profile_${entityId}` as UUID,
        entityId,
        typingSpeed: 0,
        vocabularyComplexity: 0,
        messageLengthMean: 0,
        messageLengthStdDev: 0,
        activeHours: [],
        commonPhrases: [],
        interactionPatterns: {},
        updatedAt: new Date(),
      };
      this.behavioralProfiles.set(entityId, profile);
    }

    return profile;
  }

  private async updateBehavioralProfile(entityId: UUID, message: any): Promise<void> {
    const profile = await this.getBehavioralProfile(entityId);
    const content = message.content?.text || '';

    // Update message length statistics
    const length = content.length;
    const currentMean = profile.messageLengthMean;
    const messageCount = profile.interactionPatterns.messageCount || 0;

    profile.messageLengthMean = (currentMean * messageCount + length) / (messageCount + 1);
    profile.interactionPatterns.messageCount = messageCount + 1;

    // Update active hours
    const hour = new Date(message.createdAt || Date.now()).getHours();
    if (!profile.activeHours.includes(hour)) {
      profile.activeHours.push(hour);
    }

    profile.updatedAt = new Date();
    this.behavioralProfiles.set(entityId, profile);
  }

  private detectRoleManipulation(content: string): { detected: boolean; confidence: number } {
    const rolePatterns = [
      /you are now (a|an|the)?\s*(admin|administrator|owner|manager)/i,
      /change your role to/i,
      /assume the role of/i,
      /act as (a|an|the)?\s*(admin|owner|manager)/i,
    ];

    for (const pattern of rolePatterns) {
      if (pattern.test(content)) {
        return { detected: true, confidence: 0.9 };
      }
    }

    return { detected: false, confidence: 0 };
  }

  private detectPrivilegeEscalation(content: string): { detected: boolean; confidence: number } {
    const escalationPatterns = [
      /grant me (all|admin|administrator|root|sudo)/i,
      /give me (full|complete|all) (access|permissions)/i,
      /bypass (security|permissions|restrictions)/i,
      /override (security|permissions|access control)/i,
    ];

    for (const pattern of escalationPatterns) {
      if (pattern.test(content)) {
        return { detected: true, confidence: 0.85 };
      }
    }

    return { detected: false, confidence: 0 };
  }

  private async detectCredentialTheftPrivate(
    messages: Memory[],
    entityId: UUID
  ): Promise<{ detected: boolean; confidence: number }> {
    for (const message of messages) {
      // The content field in the stored message is already a string (we store it as such in storeMemory)
      const content = (message as any).content || '';
      for (const pattern of this.CREDENTIAL_PATTERNS) {
        if (pattern.test(content)) {
          return { detected: true, confidence: 0.8 };
        }
      }
    }
    return { detected: false, confidence: 0 };
  }

  private analyzeSocialEngineering(messages: Memory[]): {
    score: number;
    factors: SocialEngineeringFactors;
  } {
    const factors: SocialEngineeringFactors = {
      urgency: 0,
      authority: 0,
      intimidation: 0,
      liking: 0,
      reciprocity: 0,
      commitment: 0,
      socialProof: 0,
      scarcity: 0,
    };

    for (const message of messages) {
      // The content field in the stored message is already a string (we store it as such in storeMemory)
      const content = ((message as any).content || '').toLowerCase();

      // Check urgency
      if (this.URGENCY_KEYWORDS.some((keyword) => content.includes(keyword))) {
        factors.urgency = Math.min(factors.urgency + 0.3, 1.0);
      }

      // Check authority
      if (this.AUTHORITY_KEYWORDS.some((keyword) => content.includes(keyword))) {
        factors.authority = Math.min(factors.authority + 0.3, 1.0);
      }

      // Check intimidation
      if (this.INTIMIDATION_KEYWORDS.some((keyword) => content.includes(keyword))) {
        factors.intimidation = Math.min(factors.intimidation + 0.4, 1.0);
      }
    }

    const score =
      Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
    return { score, factors };
  }

  private async calculateBehavioralSimilarity(
    entityA: UUID,
    entityB: UUID
  ): Promise<{ score: number; factors: string[] }> {
    const profileA = await this.getBehavioralProfile(entityA);
    const profileB = await this.getBehavioralProfile(entityB);

    const factors: string[] = [];
    let similarity = 0;
    let comparisons = 0;

    // Compare typing speed
    if (Math.abs(profileA.typingSpeed - profileB.typingSpeed) < 10) {
      similarity += 0.2;
      factors.push('similar_typing_speed');
    }
    comparisons++;

    // Compare message length patterns
    if (Math.abs(profileA.messageLengthMean - profileB.messageLengthMean) < 20) {
      similarity += 0.2;
      factors.push('similar_message_length');
    }
    comparisons++;

    // Compare active hours
    const commonHours = profileA.activeHours.filter((hour) => profileB.activeHours.includes(hour));
    if (commonHours.length > profileA.activeHours.length * 0.7) {
      similarity += 0.3;
      factors.push('similar_active_hours');
    }
    comparisons++;

    return {
      score: comparisons > 0 ? similarity / comparisons : 0,
      factors,
    };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private detectCharacterSubstitution(username: string, existingUsers: string[]): any[] {
    const substitutions: any[] = [];
    const commonSubstitutions = [
      ['0', 'o'],
      ['1', 'i'],
      ['1', 'l'],
      ['3', 'e'],
      ['4', 'a'],
      ['5', 's'],
      ['7', 't'],
      ['@', 'a'],
      ['!', 'i'],
      ['$', 's'],
    ];

    for (const existing of existingUsers) {
      let substitutedName = username.toLowerCase();

      for (const [char, replacement] of commonSubstitutions) {
        substitutedName = substitutedName.replace(new RegExp(char, 'g'), replacement);
      }

      if (substitutedName === existing.toLowerCase() && username !== existing) {
        substitutions.push({
          type: 'character_substitution',
          target: existing,
          similarity: 0.9,
          pattern: username,
        });
      }
    }

    return substitutions;
  }

  private detectUrgentFinancialRequest(content: string): { detected: boolean; confidence: number } {
    const financialKeywords = [
      'money',
      'payment',
      'transfer',
      'send',
      'wire',
      'crypto',
      'bitcoin',
      'wallet',
    ];
    const urgencyKeywords = ['urgent', 'immediately', 'now', 'asap', 'quickly'];

    const hasFinancial = financialKeywords.some((keyword) =>
      content.toLowerCase().includes(keyword)
    );
    const hasUrgency = urgencyKeywords.some((keyword) => content.toLowerCase().includes(keyword));

    if (hasFinancial && hasUrgency) {
      return { detected: true, confidence: 0.85 };
    }

    return { detected: false, confidence: 0 };
  }

  private detectSuspiciousLinks(content: string): string[] {
    const linkPattern = /https?:\/\/[^\s]+/g;
    const links = content.match(linkPattern) || [];
    const suspiciousLinks: string[] = [];

    for (const link of links) {
      // Check for URL shorteners
      if (/bit\.ly|tinyurl|goo\.gl|t\.co/i.test(link)) {
        suspiciousLinks.push(link);
        continue;
      }

      // Check for homograph attacks
      if (/[а-яА-Я]/.test(link)) {
        // Cyrillic characters
        suspiciousLinks.push(link);
        continue;
      }

      // Check for suspicious TLDs
      if (/\.(tk|ml|ga|cf)$/i.test(link)) {
        suspiciousLinks.push(link);
      }
    }

    return suspiciousLinks;
  }

  private getRecommendationForThreat(
    severity: string,
    riskFactors: Record<string, number>
  ): string {
    const recommendations: string[] = [];

    if (severity === 'critical') {
      recommendations.push('Immediate action required: Block entity and review all interactions');
    } else if (severity === 'high') {
      recommendations.push(
        'High risk detected: Monitor closely and require additional verification'
      );
    }

    if (riskFactors.credentialTheft > 0) {
      recommendations.push('Potential credential theft attempt detected');
    }

    if (riskFactors.multiAccount > 0) {
      recommendations.push('Multi-account abuse pattern detected');
    }

    if (riskFactors.socialEngineering > 0) {
      recommendations.push('Social engineering tactics identified');
    }

    return recommendations.join('. ') || 'Continue normal monitoring';
  }

  async stop(): Promise<void> {
    // Cleanup
    this.behavioralProfiles.clear();
    this.messageHistory.clear();
    this.actionHistory.clear();
    console.log('SecurityModule stopped');
  }

  /**
   * Get recent messages for an entity
   */
  getRecentMessages(entityId: UUID): Memory[] {
    const messages = this.messageHistory.get(entityId) || [];
    return messages.filter(
      (m) => Date.now() - (m as any).createdAt < 3600000 // Last hour - use createdAt instead of timestamp
    );
  }

  /**
   * Get recent security incidents
   */
  async getRecentSecurityIncidents(roomId: UUID, hours: number = 24): Promise<any[]> {
    try {
      // Query the security_incidents table if it exists
      const db = (this.runtime as any).adapter?.db || (this.runtime as any).db;
      if (!db) {
        logger.debug('[SecurityModule] No database adapter available');
        return [];
      }

      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      // Try to query security incidents, handle case where table doesn't exist
      try {
        const query = `
          SELECT * FROM security_incidents 
          WHERE timestamp >= ? 
          ORDER BY timestamp DESC 
          LIMIT 50
        `;
        const incidents = await db.query(query, [hoursAgo]);
        return incidents || [];
      } catch (error) {
        // Table doesn't exist yet, return empty array
        logger.debug('[SecurityModule] Security incidents table not available:', error);
        return [];
      }
    } catch (error) {
      logger.error('[SecurityModule] Error getting recent security incidents:', error);
      return [];
    }
  }

  /**
   * Analyze message for security threats
   */
  async analyzeMessage(
    content: string,
    entityId: UUID,
    context?: any
  ): Promise<{ detected: boolean; type?: string; confidence?: number }> {
    try {
      // Check for prompt injection
      const injectionResult = await this.detectPromptInjection(content, context);
      if (injectionResult.detected) {
        return {
          detected: true,
          type: 'prompt_injection',
          confidence: injectionResult.confidence,
        };
      }

      // Check for social engineering
      const socialResult = await this.detectSocialEngineering(content, context);
      if (socialResult.detected) {
        return {
          detected: true,
          type: 'social_engineering',
          confidence: socialResult.confidence,
        };
      }

      // Check for phishing patterns
      const suspiciousLinks = this.detectSuspiciousLinks(content);
      if (suspiciousLinks.length > 0) {
        return {
          detected: true,
          type: 'suspicious_links',
          confidence: 0.7,
        };
      }

      return { detected: false };
    } catch (error) {
      logger.error('[SecurityModule] Error analyzing message:', error);
      return { detected: false };
    }
  }

  /**
   * Get security recommendations based on threat level
   */
  getSecurityRecommendations(threatLevel: number): string[] {
    const recommendations: string[] = [];

    if (threatLevel > 0.8) {
      recommendations.push('Critical threat level - immediate action required');
      recommendations.push('Block entity and review all recent interactions');
      recommendations.push('Escalate to security team');
    } else if (threatLevel > 0.6) {
      recommendations.push('High threat level - enhanced monitoring required');
      recommendations.push('Require additional verification for sensitive actions');
      recommendations.push('Log all interactions for review');
    } else if (threatLevel > 0.4) {
      recommendations.push('Moderate threat level - increased vigilance recommended');
      recommendations.push('Monitor for patterns of concerning behavior');
    } else {
      recommendations.push('Normal threat level - continue standard monitoring');
    }

    return recommendations;
  }
}
