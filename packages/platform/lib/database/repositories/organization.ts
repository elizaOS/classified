/**
 * Organization repository with RLS-aware database operations
 */

import { eq, and, desc, asc } from 'drizzle-orm';
import { getDatabase } from '../index';
import {
  organizations,
  users,
  agents,
  type Organization,
  type NewOrganization,
} from '../index';
import { validateDatabaseContext, getCurrentOrganizationId } from '../context';

export class OrganizationRepository {
  private async getDb() {
    return await getDatabase();
  }

  /**
   * Get the current organization (based on RLS context)
   */
  async getCurrent(): Promise<Organization | null> {
    await validateDatabaseContext();
    const db = await this.getDb();

    const [organization] = await db.select().from(organizations).limit(1);

    return organization || null;
  }

  /**
   * Get organization by ID (admin only)
   */
  async getById(id: string): Promise<Organization | null> {
    const db = await this.getDb();
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    return organization || null;
  }

  /**
   * Get organization by slug
   */
  async getBySlug(slug: string): Promise<Organization | null> {
    const db = await this.getDb();
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    return organization || null;
  }

  /**
   * Get organization by WorkOS organization ID
   */
  async getByWorkosId(
    workosOrganizationId: string,
  ): Promise<Organization | null> {
    const db = await this.getDb();
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.workosOrganizationId, workosOrganizationId))
      .limit(1);

    return organization || null;
  }

  /**
   * Get organization by Stripe customer ID
   */
  async getByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Organization | null> {
    const db = await this.getDb();
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.stripeCustomerId, stripeCustomerId))
      .limit(1);

    return organization || null;
  }

  /**
   * Create a new organization
   */
  async create(data: NewOrganization): Promise<Organization> {
    const db = await this.getDb();
    const [organization] = await db
      .insert(organizations)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return organization;
  }

  /**
   * Update current organization
   */
  async updateCurrent(
    data: Partial<NewOrganization>,
  ): Promise<Organization | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [organization] = await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return organization || null;
  }

  /**
   * Update organization by ID (admin only)
   */
  async updateById(
    id: string,
    data: Partial<NewOrganization>,
  ): Promise<Organization | null> {
    const db = await this.getDb();
    const [organization] = await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();

    return organization || null;
  }

  /**
   * Delete current organization (soft delete by setting inactive)
   */
  async deleteCurrent(): Promise<boolean> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const result = await db.update(organizations).set({
      subscriptionStatus: 'cancelled',
      updatedAt: new Date(),
    });

    return true; // If no error was thrown, update was successful
  }

  /**
   * Update credit balance
   */
  async updateCreditBalance(amount: string): Promise<Organization | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [organization] = await db
      .update(organizations)
      .set({
        creditBalance: amount,
        updatedAt: new Date(),
      })
      .returning();

    return organization || null;
  }

  /**
   * Add credits to current organization
   */
  async addCredits(amount: string): Promise<Organization | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [organization] = await db
      .update(organizations)
      .set({
        creditBalance: `credit_balance + ${amount}`,
        updatedAt: new Date(),
      })
      .returning();

    return organization || null;
  }

  /**
   * Deduct credits from current organization
   */
  async deductCredits(amount: string): Promise<Organization | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [organization] = await db
      .update(organizations)
      .set({
        creditBalance: `credit_balance - ${amount}`,
        updatedAt: new Date(),
      })
      .returning();

    return organization || null;
  }

  /**
   * Check if organization has enough credits
   */
  async hasEnoughCredits(requiredAmount: string): Promise<boolean> {
    const organization = await this.getCurrent();
    if (!organization) {
      return false;
    }

    const currentBalance = parseFloat(organization.creditBalance);
    const required = parseFloat(requiredAmount);

    return currentBalance >= required;
  }

  /**
   * Get organization statistics
   */
  async getStats(): Promise<{
    userCount: number;
    agentCount: number;
    creditBalance: string;
    subscriptionTier: string;
  }> {
    await validateDatabaseContext();

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) {
      throw new Error('No organization context');
    }

    // Get user count
    const db = await this.getDb();
    const [userCountResult] = await db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.organizationId, organizationId));

    // Get agent count
    const [agentCountResult] = await db
      .select({ count: agents.id })
      .from(agents)
      .where(eq(agents.organizationId, organizationId));

    // Get organization details
    const organization = await this.getCurrent();

    return {
      userCount: Number(userCountResult?.count) || 0,
      agentCount: Number(agentCountResult?.count) || 0,
      creditBalance: organization?.creditBalance || '0',
      subscriptionTier: organization?.subscriptionTier || 'free',
    };
  }

  /**
   * Check if organization is within limits
   */
  async checkLimits(): Promise<{
    withinUserLimit: boolean;
    withinAgentLimit: boolean;
    withinApiRequestLimit: boolean;
    withinStorageLimit: boolean;
  }> {
    const organization = await this.getCurrent();
    if (!organization) {
      throw new Error('Organization not found');
    }

    const stats = await this.getStats();

    return {
      withinUserLimit: stats.userCount <= organization.maxUsers,
      withinAgentLimit: stats.agentCount <= organization.maxAgents,
      withinApiRequestLimit: true, // TODO: Implement API request tracking
      withinStorageLimit: true, // TODO: Implement storage usage tracking
    };
  }

  /**
   * Update subscription details from Stripe
   */
  async updateSubscription(data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<Organization | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [organization] = await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return organization || null;
  }
}
