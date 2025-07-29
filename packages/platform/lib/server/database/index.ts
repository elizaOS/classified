/**
 * Mock database manager for development
 * TODO: Replace with actual database implementation using Drizzle ORM
 */

import type { User, Organization, ApiKey, OrganizationMember } from '../types';
import { generateSecureToken } from '../utils/crypto';

// In-memory stores for development
const users = new Map<string, User>();
const organizations = new Map<string, Organization>();
const apiKeys = new Map<string, ApiKey>();
const orgMembers = new Map<string, OrganizationMember[]>();

export class DatabaseManager {
  // User operations
  async createUser(data: Partial<User>): Promise<User> {
    const user: User = {
      id: `user_${generateSecureToken(16)}`,
      email: data.email!,
      firstName: data.firstName,
      lastName: data.lastName,
      avatar: data.avatar,
      emailVerified: data.emailVerified || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: data.lastLoginAt,
      metadata: data.metadata || {},
      workosUserId: data.workosUserId,
      workosOrganizationId: data.workosOrganizationId,
    };

    users.set(user.id, user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const allUsers = Array.from(users.values());
    return allUsers.find((u) => u.email === email) || null;
  }

  async getUserByWorkOSId(workosUserId: string): Promise<User | null> {
    const allUsers = Array.from(users.values());
    return allUsers.find((u) => u.workosUserId === workosUserId) || null;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const user = users.get(id);
    if (!user) {
      return null;
    }

    const updated = {
      ...user,
      ...data,
      updatedAt: new Date(),
    };

    users.set(id, updated);
    return updated;
  }

  // Organization operations
  async createOrganization(data: Partial<Organization>): Promise<Organization> {
    const org: Organization = {
      id: `org_${generateSecureToken(16)}`,
      name: data.name!,
      slug: data.slug!,
      domain: data.domain,
      subscriptionTier: data.subscriptionTier || 'free',
      maxAgents: data.maxAgents || 5,
      maxUsers: data.maxUsers || 10,
      maxApiRequests: data.maxApiRequests || 10000,
      settings: data.settings || {
        allowCustomDomains: false,
        ssoRequired: false,
        maxStorageGB: 10,
        features: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      workosOrganizationId: data.workosOrganizationId!,
    };

    organizations.set(org.id, org);
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return organizations.get(id) || null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const allOrgs = Array.from(organizations.values());
    return allOrgs.find((o) => o.slug === slug) || null;
  }

  async getOrganizationByWorkOSId(
    workosOrganizationId: string,
  ): Promise<Organization | null> {
    const allOrgs = Array.from(organizations.values());
    return (
      allOrgs.find((o) => o.workosOrganizationId === workosOrganizationId) ||
      null
    );
  }

  async updateOrganization(
    id: string,
    data: Partial<Organization>,
  ): Promise<Organization | null> {
    const org = organizations.get(id);
    if (!org) {
      return null;
    }

    const updated = {
      ...org,
      ...data,
      updatedAt: new Date(),
    };

    organizations.set(id, updated);
    return updated;
  }

  // Organization member operations
  async addUserToOrganization(
    userId: string,
    organizationId: string,
    role: 'owner' | 'admin' | 'member' | 'viewer' = 'member',
  ): Promise<OrganizationMember> {
    const member: OrganizationMember = {
      id: `member_${generateSecureToken(16)}`,
      userId,
      organizationId,
      role,
      permissions: [],
      invitedAt: new Date(),
      joinedAt: new Date(),
      invitedBy: 'system',
    };

    const orgMembersList = orgMembers.get(organizationId) || [];
    orgMembersList.push(member);
    orgMembers.set(organizationId, orgMembersList);

    return member;
  }

  async getOrganizationMembers(
    organizationId: string,
  ): Promise<OrganizationMember[]> {
    return orgMembers.get(organizationId) || [];
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const userOrgs: Organization[] = [];

    orgMembers.forEach((members, orgId) => {
      if (members.some((m) => m.userId === userId)) {
        const org = organizations.get(orgId);
        if (org) {
          userOrgs.push(org);
        }
      }
    });

    return userOrgs;
  }

  // API Key operations
  async createApiKey(data: Partial<ApiKey>): Promise<ApiKey> {
    const apiKey: ApiKey = {
      id: `key_${generateSecureToken(16)}`,
      name: data.name!,
      keyHash: data.keyHash!,
      prefix: data.prefix!,
      userId: data.userId!,
      organizationId: data.organizationId,
      permissions: data.permissions || [],
      lastUsedAt: data.lastUsedAt,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      isActive: true,
      metadata: data.metadata || {},
    };

    apiKeys.set(apiKey.id, apiKey);
    return apiKey;
  }

  async getApiKeyById(id: string): Promise<ApiKey | null> {
    return apiKeys.get(id) || null;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    const allKeys = Array.from(apiKeys.values());
    return allKeys.find((k) => k.keyHash === keyHash && k.isActive) || null;
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    const allKeys = Array.from(apiKeys.values());
    return allKeys.filter((k) => k.userId === userId && k.isActive);
  }

  async updateApiKey(
    id: string,
    data: Partial<ApiKey>,
  ): Promise<ApiKey | null> {
    const key = apiKeys.get(id);
    if (!key) {
      return null;
    }

    const updated = {
      ...key,
      ...data,
    };

    apiKeys.set(id, updated);
    return updated;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const key = apiKeys.get(id);
    if (!key) {
      return false;
    }

    key.isActive = false;
    apiKeys.set(id, key);
    return true;
  }
}

// Export singleton instance
export const db = new DatabaseManager();
