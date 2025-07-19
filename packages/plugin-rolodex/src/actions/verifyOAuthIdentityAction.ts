import { logger } from '@elizaos/core';

import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  asUUID,
} from '@elizaos/core';
import { OAuthIdentityVerifier } from '../providers/OAuthIdentityVerifier';
import { EntityGraphManager } from '../managers/EntityGraphManager';
import { EntityResolutionManager } from '../managers/EntityResolutionManager';

/**
 * Action to verify OAuth identity and link to current user's entity
 */
export const verifyOAuthIdentityAction: Action = {
  name: 'VERIFY_OAUTH_IDENTITY',
  similes: ['LINK_OAUTH', 'CONNECT_OAUTH', 'VERIFY_PLATFORM', 'LINK_PLATFORM'],
  description: 'Verify OAuth identity (Google, GitHub, Discord, Twitter) and link to user profile',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Check if OAuth service is available
    const oauthService = runtime.getService('OAUTH_VERIFICATION');
    if (!oauthService) {
      return false;
    }

    // Check if message mentions OAuth verification or platform linking
    const text = message.content.text?.toLowerCase() || '';
    const keywords = [
      'verify',
      'oauth',
      'link',
      'connect',
      'google',
      'github',
      'discord',
      'twitter',
      'authenticate',
      'identity',
      'platform',
      'account',
    ];

    return keywords.some((keyword) => text.includes(keyword));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      logger.info('[verifyOAuthIdentityAction] Starting OAuth identity verification');

      // Get required services
      const entityGraphService = runtime.getService('entityGraph') as unknown as EntityGraphManager;
      const entityResolutionService = runtime.getService(
        'entityResolution'
      ) as unknown as EntityResolutionManager;

      if (!entityGraphService || !entityResolutionService) {
        if (callback) {
          await callback({
            text: 'Sorry, the identity management services are not available right now.',
            thought: 'Missing required Rolodex services for OAuth verification',
          });
        }
        return;
      }

      // Create OAuth verifier
      const oauthVerifier = new OAuthIdentityVerifier(
        runtime,
        entityGraphService,
        entityResolutionService
      );

      // Get available OAuth providers
      const availableProviders = oauthVerifier.getAvailableProviders();

      if (availableProviders.length === 0) {
        if (callback) {
          await callback({
            text: 'Sorry, no OAuth providers are currently configured. Please contact the administrator to set up OAuth authentication.',
            thought: 'No OAuth providers available - need API keys configured',
          });
        }
        return;
      }

      // Parse the message to see if a specific platform was requested
      const text = message.content.text?.toLowerCase() || '';
      let requestedPlatform: string | null = null;

      for (const provider of availableProviders) {
        if (text.includes(provider)) {
          requestedPlatform = provider;
          break;
        }
      }

      // If no specific platform requested, show available options
      if (!requestedPlatform) {
        const platformList = availableProviders
          .map((p) => `• ${p.charAt(0).toUpperCase() + p.slice(1)}`)
          .join('\n');

        if (callback) {
          await callback({
            text: `I can help you verify your identity using OAuth! Available platforms:\n\n${platformList}\n\nWhich platform would you like to use for verification? Just say something like "verify with Google" or "link my GitHub account".`,
            thought: "User wants OAuth verification but didn't specify platform",
            actions: ['VERIFY_OAUTH_IDENTITY'],
          });
        }
        return;
      }

      // Resolve or create entity for the user
      const entityId = asUUID(message.entityId || `entity-${Date.now()}`);

      // Try to get existing entity or create new one
      await entityGraphService.trackEntity(
        entityId,
        `OAuth verification request for ${requestedPlatform}`,
        { updateExisting: true }
      );

      // Create OAuth challenge
      try {
        const challenge = await oauthVerifier.createOAuthChallenge(entityId, requestedPlatform);

        if (callback) {
          await callback({
            text: `Great! I've created an OAuth verification link for ${requestedPlatform.charAt(0).toUpperCase() + requestedPlatform.slice(1)}.\n\n🔗 **Click here to verify your identity:**\n${challenge.challengeUrl}\n\nThis link will expire in 5 minutes. After you complete the verification, I'll automatically link your ${requestedPlatform} account to your profile and increase your trust score.`,
            thought: `Created OAuth challenge for ${requestedPlatform} verification`,
            actions: ['VERIFY_OAUTH_IDENTITY'],
          });
        }

        logger.info('[verifyOAuthIdentityAction] OAuth challenge created successfully:', {
          entityId,
          platform: requestedPlatform,
          expiresAt: challenge.expiresAt,
        });
      } catch (error) {
        logger.error('[verifyOAuthIdentityAction] Error creating OAuth challenge:', error);

        if (callback) {
          await callback({
            text: `Sorry, I encountered an error setting up ${requestedPlatform} verification: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`,
            thought: `OAuth challenge creation failed for ${requestedPlatform}`,
          });
        }
      }
    } catch (error) {
      logger.error('[verifyOAuthIdentityAction] OAuth identity verification failed:', error);

      if (callback) {
        await callback({
          text: 'Sorry, I encountered an error while setting up identity verification. Please try again later or contact support.',
          thought: 'OAuth identity verification action failed with error',
        });
      }
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: { text: 'I want to verify my identity with Google' },
      },
      {
        name: 'Agent',
        content: {
          text: "Great! I've created an OAuth verification link for Google. Click here to verify your identity: [OAuth URL]. This link will expire in 5 minutes.",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Link my GitHub account' },
      },
      {
        name: 'Agent',
        content: {
          text: "I'll help you link your GitHub account. Click here to verify: [OAuth URL]",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'How can I verify my identity?' },
      },
      {
        name: 'Agent',
        content: {
          text: 'I can help you verify your identity using OAuth! Available platforms:\n• Google\n• GitHub\n• Discord\n• Twitter\n\nWhich platform would you like to use?',
        },
      },
    ],
  ],
};
