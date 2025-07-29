/**
 * Organizations management service
 */

import { getDatabase } from '../database';
import { organizations, users } from '../database/schema-pglite';
import { eq, and, desc, ne } from 'drizzle-orm';
import { logger } from '../logger';
import type { Organization, User } from '../database/schema-pglite';

export interface CreateOrganizationParams {
  name: string;
  slug: string;
  ownerId: string;
  subscriptionTier?: string;
  settings?: Record<string, any>;
}

export interface UpdateOrganizationParams {
  name?: string;
  slug?: string;
  subscriptionTier?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface OrganizationMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: Date;
  isActive: boolean;
}

export class OrganizationService {
  private static instance: OrganizationService;

  static getInstance(): OrganizationService {
    if (!OrganizationService.instance) {
      OrganizationService.instance = new OrganizationService();
    }
    return OrganizationService.instance;
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    params: CreateOrganizationParams,
  ): Promise<Organization> {
    const db = await getDatabase();

    try {
      // Check if slug is unique
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, params.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('Organization slug already exists');
      }

      // Create organization
      const [org] = await db
        .insert(organizations)
        .values({
          name: params.name,
          slug: params.slug,
          subscriptionTier: params.subscriptionTier || 'free',
          settings: params.settings || {},
          metadata: {
            createdBy: params.ownerId,
            createdAt: new Date().toISOString(),
          },
        })
        .returning();

      // Add owner as first member
      await db
        .update(users)
        .set({
          organizationId: org.id,
          role: 'owner',
        })
        .where(eq(users.id, params.ownerId));

      logger.info('Organization created', {
        organizationId: org.id,
        ownerId: params.ownerId,
      });

      return org;
    } catch (error) {
      logger.error('Failed to create organization', error as Error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId: string): Promise<Organization | null> {
    const db = await getDatabase();

    try {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      return org || null;
    } catch (error) {
      logger.error('Failed to get organization', error as Error);
      throw error;
    }
  }

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const db = await getDatabase();

    try {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      return org || null;
    } catch (error) {
      logger.error('Failed to get organization by slug', error as Error);
      throw error;
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(
    organizationId: string,
    params: UpdateOrganizationParams,
  ): Promise<Organization> {
    const db = await getDatabase();

    try {
      // Check if slug is unique (if changing)
      if (params.slug) {
        const existing = await db
          .select()
          .from(organizations)
          .where(
            and(
              eq(organizations.slug, params.slug),
              ne(organizations.id, organizationId),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          throw new Error('Organization slug already exists');
        }
      }

      const updateData: any = {};
      if (params.name !== undefined) {
        updateData.name = params.name;
      }
      if (params.slug !== undefined) {
        updateData.slug = params.slug;
      }
      if (params.subscriptionTier !== undefined) {
        updateData.subscriptionTier = params.subscriptionTier;
      }
      if (params.settings !== undefined) {
        updateData.settings = params.settings;
      }
      if (params.metadata !== undefined) {
        updateData.metadata = params.metadata;
      }

      const [updated] = await db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, organizationId))
        .returning();

      if (!updated) {
        throw new Error('Organization not found');
      }

      logger.info('Organization updated', { organizationId });

      return updated;
    } catch (error) {
      logger.error('Failed to update organization', error as Error);
      throw error;
    }
  }

  /**
   * Delete organization
   */
  async deleteOrganization(organizationId: string): Promise<void> {
    const db = await getDatabase();

    try {
      // Check if organization has users
      const memberCount = await this.getOrganizationMemberCount(organizationId);
      if (memberCount > 0) {
        throw new Error('Cannot delete organization with active members');
      }

      await db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));

      logger.info('Organization deleted', { organizationId });
    } catch (error) {
      logger.error('Failed to delete organization', error as Error);
      throw error;
    }
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(
    organizationId: string,
  ): Promise<OrganizationMember[]> {
    const db = await getDatabase();

    try {
      const members = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          joinedAt: users.createdAt,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .orderBy(desc(users.createdAt));

      return members.map((m: any) => ({
        id: m.id,
        name:
          m.firstName && m.lastName
            ? `${m.firstName} ${m.lastName}`
            : m.firstName || m.lastName || null,
        email: m.email,
        role: m.role,
        joinedAt: new Date(m.joinedAt),
        isActive: m.isActive,
      }));
    } catch (error) {
      logger.error('Failed to get organization members', error as Error);
      throw error;
    }
  }

  /**
   * Get organization member count
   */
  async getOrganizationMemberCount(organizationId: string): Promise<number> {
    const db = await getDatabase();

    try {
      const members = await db
        .select()
        .from(users)
        .where(eq(users.organizationId, organizationId));

      return members.length;
    } catch (error) {
      logger.error('Failed to get organization member count', error as Error);
      throw error;
    }
  }

  /**
   * Add user to organization
   */
  async addUserToOrganization(
    userId: string,
    organizationId: string,
    role: string = 'member',
  ): Promise<void> {
    const db = await getDatabase();

    try {
      await db
        .update(users)
        .set({
          organizationId,
          role,
        })
        .where(eq(users.id, userId));

      logger.info('User added to organization', {
        userId,
        organizationId,
        role,
      });
    } catch (error) {
      logger.error('Failed to add user to organization', error as Error);
      throw error;
    }
  }

  /**
   * Remove user from organization
   */
  async removeUserFromOrganization(userId: string): Promise<void> {
    const db = await getDatabase();

    try {
      await db
        .update(users)
        .set({
          organizationId: null,
          role: 'member',
        })
        .where(eq(users.id, userId));

      logger.info('User removed from organization', { userId });
    } catch (error) {
      logger.error('Failed to remove user from organization', error as Error);
      throw error;
    }
  }

  /**
   * Update user role in organization
   */
  async updateUserRole(
    userId: string,
    organizationId: string,
    role: string,
  ): Promise<void> {
    const db = await getDatabase();

    try {
      await db
        .update(users)
        .set({ role })
        .where(
          and(eq(users.id, userId), eq(users.organizationId, organizationId)),
        );

      logger.info('User role updated', { userId, organizationId, role });
    } catch (error) {
      logger.error('Failed to update user role', error as Error);
      throw error;
    }
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const db = await getDatabase();

    try {
      const userOrgs = await db
        .select({
          organization: organizations,
        })
        .from(users)
        .innerJoin(organizations, eq(users.organizationId, organizations.id))
        .where(eq(users.id, userId));

      return userOrgs.map((row: any) => row.organization);
    } catch (error) {
      logger.error('Failed to get user organizations', error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const organizationService = OrganizationService.getInstance();
