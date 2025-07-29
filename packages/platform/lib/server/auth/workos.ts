/**
 * WorkOS client wrapper for SSO functionality
 */

import { WorkOS } from '@workos-inc/node';
import type {
  User as WorkOSUser,
  Organization as WorkOSOrg,
} from '@workos-inc/node';
import type { User, Organization, WorkOSConfig } from '../types';

export class WorkOSClient {
  private client: WorkOS;
  private config: WorkOSConfig;

  constructor(config: WorkOSConfig) {
    this.config = config;
    this.client = new WorkOS(config.apiKey);
  }

  /**
   * Get authorization URL for SSO login
   */
  getAuthorizationUrl(organizationId?: string, state?: string): string {
    const params: any = {
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      state,
    };

    if (organizationId) {
      params.organization = organizationId;
    }

    return this.client.userManagement.getAuthorizationUrl(params);
  }

  /**
   * Exchange authorization code for user profile
   */
  async exchangeCodeForProfile(code: string): Promise<{
    user: WorkOSUser;
    organization?: WorkOSOrg;
    accessToken: string;
  }> {
    const response = await this.client.userManagement.authenticateWithCode({
      code,
      clientId: this.config.clientId,
    });

    // Get user details
    const user = await this.client.userManagement.getUser(response.user.id);

    // Get organization if available
    let organization: WorkOSOrg | undefined;
    if (response.organizationId) {
      organization = await this.client.organizations.getOrganization(
        response.organizationId,
      );
    }

    return {
      user,
      organization,
      accessToken: response.accessToken,
    };
  }

  /**
   * Convert WorkOS user to platform user
   */
  convertWorkOSUser(workosUser: WorkOSUser): Partial<User> {
    return {
      email: workosUser.email,
      firstName: workosUser.firstName || undefined,
      lastName: workosUser.lastName || undefined,
      avatar: workosUser.profilePictureUrl || undefined,
      emailVerified: workosUser.emailVerified || false,
      workosUserId: workosUser.id,
    };
  }

  /**
   * Convert WorkOS organization to platform organization
   */
  convertWorkOSOrganization(workosOrg: WorkOSOrg): Partial<Organization> {
    return {
      name: workosOrg.name,
      // WorkOS doesn't provide slug, so we'll generate one from name
      slug: workosOrg.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      domain: workosOrg.domains?.[0]?.domain,
      workosOrganizationId: workosOrg.id,
    };
  }

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId: string): Promise<WorkOSOrg> {
    return this.client.organizations.getOrganization(organizationId);
  }

  /**
   * List organizations for a user
   */
  async listUserOrganizations(userId: string): Promise<WorkOSOrg[]> {
    const response =
      await this.client.userManagement.listOrganizationMemberships({
        userId,
      });

    const organizations = await Promise.all(
      response.data.map((membership) =>
        this.client.organizations.getOrganization(membership.organizationId),
      ),
    );

    return organizations;
  }

  /**
   * Create a magic link for passwordless login
   */
  async createMagicLink(email: string): Promise<{ id: string; email: string }> {
    const response = await this.client.userManagement.createMagicAuth({
      email,
    });

    return response;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string, secret: string): boolean {
    try {
      this.client.webhooks.constructEvent({
        payload,
        sigHeader: signature,
        secret,
      });
      return true;
    } catch {
      return false;
    }
  }
}
