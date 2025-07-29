/**
 * WorkOS SSO Authentication Integration
 */

import { WorkOS } from '@workos-inc/node';
import type {
  Organization as WorkOSOrganization,
  User as WorkOSUser,
  AuthenticationResponse,
  OrganizationMembership,
} from '@workos-inc/node';
import type { WorkOSExtended } from '@/lib/types/common';

// Initialize WorkOS client
let workosClient: WorkOS | null = null;

function getWorkOSClient(): WorkOS {
  if (!workosClient) {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;

    if (!apiKey || !clientId) {
      throw new Error(
        'WorkOS API key and client ID are required. Please set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.',
      );
    }

    workosClient = new WorkOS(apiKey, {
      clientId,
    });
  }

  return workosClient;
}

/**
 * WorkOS Authentication Service
 */
export class WorkOSAuthService {
  private workos = getWorkOSClient();
  private workosExtended: WorkOSExtended =
    getWorkOSClient() as unknown as WorkOSExtended;
  private clientId = process.env.WORKOS_CLIENT_ID!;
  private redirectUri =
    process.env.WORKOS_REDIRECT_URI || 'http://localhost:3333/auth/callback';

  /**
   * Generate authorization URL for SSO login
   */
  generateAuthUrl(
    options: {
      organizationId?: string;
      connection?: string;
      domain?: string;
      state?: string;
      screenHint?: 'sign_up' | 'sign_in';
      redirectUri?: string;
    } = {},
  ): string {
    try {
      const { redirectUri, ...otherOptions } = options;

      const authUrl = this.workos.sso.getAuthorizationUrl({
        clientId: this.clientId,
        redirectUri: redirectUri || this.redirectUri,
        ...otherOptions,
      });

      return authUrl;
    } catch (error) {
      console.error('Failed to generate WorkOS auth URL:', error);
      throw new Error('Failed to generate authentication URL');
    }
  }

  /**
   * Exchange authorization code for user profile
   */
  async authenticateWithCode(code: string): Promise<{
    user: WorkOSUser;
    organizationId?: string;
    accessToken: string;
  }> {
    try {
      const response = (await this.workos.sso.getProfileAndToken({
        code,
        clientId: this.clientId,
      })) as unknown as {
        profile: WorkOSUser;
        organizationId?: string;
        accessToken: string;
      };

      return {
        user: response.profile as WorkOSUser,
        organizationId: response.organizationId || undefined,
        accessToken: response.accessToken,
      };
    } catch (error) {
      console.error('WorkOS authentication failed:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(
    organizationId: string,
  ): Promise<WorkOSOrganization | null> {
    try {
      const organization =
        await this.workos.organizations.getOrganization(organizationId);
      return organization;
    } catch (error) {
      console.error('Failed to get WorkOS organization:', error);
      return null;
    }
  }

  /**
   * List organizations for domain
   */
  async getOrganizationsByDomain(
    domain: string,
  ): Promise<WorkOSOrganization[]> {
    try {
      const { data } = await this.workos.organizations.listOrganizations({
        domains: [domain],
      });
      return data;
    } catch (error) {
      console.error('Failed to get organizations by domain:', error);
      return [];
    }
  }

  /**
   * Create a new organization in WorkOS
   */
  async createOrganization(data: {
    name: string;
    domains?: string[];
    idempotencyKey?: string;
  }): Promise<WorkOSOrganization> {
    try {
      const organization = await this.workos.organizations.createOrganization({
        name: data.name,
        domains: data.domains,
      });

      return organization;
    } catch (error) {
      console.error('Failed to create WorkOS organization:', error);
      throw new Error('Failed to create organization');
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<WorkOSUser | null> {
    try {
      // WorkOS API structure might be different - using type assertion for now
      const user = await (this.workos as any).users?.getUser(userId);
      return user || null;
    } catch (error) {
      console.error('Failed to get WorkOS user:', error);
      return null;
    }
  }

  /**
   * Create user in WorkOS
   */
  async createUser(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified?: boolean;
  }): Promise<WorkOSUser> {
    try {
      const user = await (this.workos as any).users?.createUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        emailVerified: data.emailVerified,
      });

      return user;
    } catch (error) {
      console.error('Failed to create WorkOS user:', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Send magic link for passwordless authentication
   */
  async sendMagicLink(email: string, invitationToken?: string): Promise<void> {
    try {
      await (this.workos as any).passwordless?.sendSession({
        email,
        type: 'MagicLink',
        redirectUri: this.redirectUri,
        invitationToken,
      });
    } catch (error) {
      console.error('Failed to send magic link:', error);
      throw new Error('Failed to send magic link');
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(userId: string): Promise<void> {
    try {
      await (this.workos as any).users?.sendVerificationEmail(userId);
    } catch (error) {
      console.error('Failed to send email verification:', error);
      throw new Error('Failed to send email verification');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await (this.workos as any).passwordless?.sendSession({
        email,
        type: 'MagicLink',
        redirectUri: `${this.redirectUri}/reset-password`,
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      throw new Error('Failed to send password reset');
    }
  }

  /**
   * Get organization membership for user
   */
  async getOrganizationMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null> {
    try {
      const result = await (
        this.workos as any
      ).organizationMemberships?.listOrganizationMemberships({
        userId,
        organizationId,
      });

      return result?.data?.[0] || null;
    } catch (error) {
      console.error('Failed to get organization membership:', error);
      return null;
    }
  }

  /**
   * Create organization membership
   */
  async createOrganizationMembership(data: {
    userId: string;
    organizationId: string;
    roleSlug?: string;
  }): Promise<OrganizationMembership> {
    try {
      const membership = await (
        this.workos as any
      ).organizationMemberships?.createOrganizationMembership({
        userId: data.userId,
        organizationId: data.organizationId,
        roleSlug: data.roleSlug,
      });

      return membership;
    } catch (error) {
      console.error('Failed to create organization membership:', error);
      throw new Error('Failed to create organization membership');
    }
  }

  /**
   * Delete organization membership
   */
  async deleteOrganizationMembership(membershipId: string): Promise<void> {
    try {
      await (
        this.workos as any
      ).organizationMemberships?.deleteOrganizationMembership(membershipId);
    } catch (error) {
      console.error('Failed to delete organization membership:', error);
      throw new Error('Failed to delete organization membership');
    }
  }

  /**
   * Webhook signature verification
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const event = this.workos.webhooks.constructEvent({
        payload,
        sigHeader: signature,
        secret,
      });
      return !!event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Process webhook event
   */
  constructWebhookEvent(payload: string, signature: string, secret: string) {
    try {
      return this.workos.webhooks.constructEvent({
        payload,
        sigHeader: signature,
        secret,
      });
    } catch (error) {
      console.error('Failed to construct webhook event:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

// Export singleton instance
export const workosAuth = new WorkOSAuthService();

// Helper function to determine user role based on WorkOS data
export function mapWorkOSRoleToAppRole(workosRole?: string): string {
  if (!workosRole) {
    return 'member';
  }

  const roleMapping: Record<string, string> = {
    admin: 'admin',
    owner: 'owner',
    manager: 'admin',
    member: 'member',
    guest: 'viewer',
    viewer: 'viewer',
  };

  return roleMapping[workosRole.toLowerCase()] || 'member';
}

// Helper to extract domain from email
export function getDomainFromEmail(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}
