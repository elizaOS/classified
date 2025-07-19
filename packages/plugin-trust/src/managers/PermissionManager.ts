import { type IAgentRuntime, logger } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { TrustEngine } from './TrustEngine';
import { SecurityManager } from './SecurityManager';
import type {
  Permission,
  PermissionContext,
  AccessRequest,
  AccessDecision,
  PermissionDecision,
} from '../types/permissions';

/**
 * Permission Manager - Handles permission checking with trust integration
 * Simplified from ContextualPermissionSystem
 */
export class PermissionManager {
  private runtime!: IAgentRuntime;
  private trustEngine!: TrustEngine;
  private securityManager!: SecurityManager;

  // Simple permission cache
  private permissionCache = new Map<string, { decision: AccessDecision; expiry: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  async initialize(
    runtime: IAgentRuntime,
    trustEngine: TrustEngine,
    securityManager: SecurityManager
  ): Promise<void> {
    this.runtime = runtime;
    this.trustEngine = trustEngine;
    this.securityManager = securityManager;
    logger.info('[PermissionManager] Initialized');
  }

  /**
   * Check if an entity has access to perform an action
   */
  async checkAccess(request: AccessRequest): Promise<AccessDecision> {
    const startTime = Date.now();
    const cacheKey = JSON.stringify(request);

    // Check cache
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiry > startTime) {
      return cached.decision;
    }

    // Security check first
    const content = request.metadata?.content || `${request.action} on ${request.resource}`;
    const securityCheck = await this.securityManager.analyzeContent(
      content,
      request.entityId,
      request.context
    );

    if (securityCheck.detected && securityCheck.action === 'block') {
      return this.createDecision(request, {
        allowed: false,
        method: 'denied',
        reason: `Security threat detected: ${securityCheck.type}`,
        securityChecks: {
          promptInjection: securityCheck.type === 'prompt_injection',
          socialEngineering: securityCheck.type === 'social_engineering',
          anomalyDetection: securityCheck.type === 'anomaly',
        },
      });
    }

    // Check role-based permissions
    const roleDecision = await this.checkRolePermissions(request);
    if (roleDecision.allowed) {
      return this.createDecision(request, roleDecision);
    }

    // Check trust-based permissions
    const trustDecision = await this.checkTrustPermissions(request);
    if (trustDecision.allowed) {
      return this.createDecision(request, trustDecision);
    }

    // Default deny
    const reason = this.generateDenialReason(roleDecision, trustDecision);
    return this.createDecision(request, { allowed: false, method: 'denied', reason });
  }

  /**
   * Check if entity has permission based on role
   */
  private async checkRolePermissions(request: AccessRequest): Promise<PermissionDecision> {
    // Simple role check - in production would integrate with proper role system
    const isAdmin = await this.isAdmin(request.entityId);
    const isOwner = await this.isOwner(request.entityId);

    if (isOwner || isAdmin) {
      return {
        allowed: true,
        method: 'role-based',
        reason: `Allowed by role: ${isOwner ? 'owner' : 'admin'}`,
      };
    }

    // Check specific action permissions
    const hasPermission = await this.hasRolePermission(request.entityId, request.action);
    if (hasPermission) {
      return {
        allowed: true,
        method: 'role-based',
        reason: 'Allowed by role permission',
      };
    }

    return {
      allowed: false,
      method: 'denied',
      reason: 'No matching role permission',
    };
  }

  /**
   * Check if entity has permission based on trust level
   */
  private async checkTrustPermissions(request: AccessRequest): Promise<PermissionDecision> {
    const trustProfile = await this.trustEngine.calculateTrust(request.entityId, {
      entityId: request.entityId,
      evaluatorId: this.runtime.agentId,
      ...request.context,
    });

    // Define trust requirements for different actions
    const trustRequirements = this.getTrustRequirements(request.action);

    if (trustProfile.overallTrust >= trustRequirements.minimumTrust) {
      // Check dimension requirements if any
      if (trustRequirements.dimensions) {
        for (const [dimension, required] of Object.entries(trustRequirements.dimensions)) {
          const actual = trustProfile.dimensions[dimension as keyof typeof trustProfile.dimensions];
          if (actual < required!) {
            return {
              allowed: false,
              method: 'denied',
              reason: `${dimension} trust (${actual}) below required (${required})`,
            };
          }
        }
      }

      return {
        allowed: true,
        method: 'trust-based',
        reason: `Allowed by trust score: ${trustProfile.overallTrust.toFixed(0)}`,
      };
    }

    return {
      allowed: false,
      method: 'denied',
      reason: `Insufficient trust: ${trustProfile.overallTrust.toFixed(0)} < ${trustRequirements.minimumTrust}`,
    };
  }

  /**
   * Get trust requirements for an action
   */
  private getTrustRequirements(action: string): {
    minimumTrust: number;
    dimensions?: Partial<Record<string, number>>;
  } {
    // Define trust requirements for different action types
    const requirements: Record<string, any> = {
      // Read actions - low trust
      read: { minimumTrust: 20 },
      view: { minimumTrust: 20 },
      list: { minimumTrust: 20 },

      // Write actions - medium trust
      create: { minimumTrust: 40 },
      update: { minimumTrust: 50, dimensions: { reliability: 40 } },
      write: { minimumTrust: 50, dimensions: { reliability: 40 } },

      // Delete actions - high trust
      delete: { minimumTrust: 70, dimensions: { integrity: 60, reliability: 50 } },
      remove: { minimumTrust: 70, dimensions: { integrity: 60, reliability: 50 } },

      // Admin actions - very high trust
      admin: { minimumTrust: 85, dimensions: { integrity: 80, reliability: 70 } },
      manage: { minimumTrust: 80, dimensions: { integrity: 70, competence: 60 } },
      configure: { minimumTrust: 75, dimensions: { competence: 70 } },
    };

    // Find matching requirement or use default
    const requirement = requirements[action.toLowerCase()];
    if (requirement) {
      return requirement;
    }

    // Check if action starts with known prefix
    for (const [prefix, req] of Object.entries(requirements)) {
      if (action.toLowerCase().startsWith(prefix)) {
        return req;
      }
    }

    // Default requirement
    return { minimumTrust: 50 };
  }

  /**
   * Create and cache decision
   */
  private createDecision(
    request: AccessRequest,
    partialDecision: Partial<AccessDecision>
  ): AccessDecision {
    const decision: AccessDecision = {
      request,
      allowed: partialDecision.allowed || false,
      method: partialDecision.method || 'denied',
      reason: partialDecision.reason || '',
      evaluatedAt: Date.now(),
      ttl: this.CACHE_TTL,
      ...partialDecision,
    };

    // Cache positive decisions
    if (decision.allowed) {
      const cacheKey = JSON.stringify(request);
      this.permissionCache.set(cacheKey, {
        decision,
        expiry: Date.now() + this.CACHE_TTL,
      });
    }

    return decision;
  }

  /**
   * Generate helpful denial reason
   */
  private generateDenialReason(
    roleDecision: PermissionDecision,
    trustDecision: PermissionDecision
  ): string {
    const reasons = [`Role check: ${roleDecision.reason}`, `Trust check: ${trustDecision.reason}`];
    return `Access denied. ${reasons.join('. ')}`;
  }

  /**
   * Simple role checks - in production would use proper role system
   */
  private async isAdmin(entityId: UUID): Promise<boolean> {
    // This would check against actual role system
    return false;
  }

  private async isOwner(entityId: UUID): Promise<boolean> {
    return entityId === this.runtime.agentId;
  }

  private async hasRolePermission(entityId: UUID, action: string): Promise<boolean> {
    // This would check against actual permission system
    return false;
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Clear cache for specific entity
   */
  clearCacheForEntity(entityId: UUID): void {
    for (const [key, value] of this.permissionCache.entries()) {
      if (value.decision.request.entityId === entityId) {
        this.permissionCache.delete(key);
      }
    }
  }

  async stop(): Promise<void> {
    this.clearCache();
    logger.info('[PermissionManager] Stopped');
  }
}
