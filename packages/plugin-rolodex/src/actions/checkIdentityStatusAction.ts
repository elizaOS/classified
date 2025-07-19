import {
  logger,
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionResult,
} from '@elizaos/core';

/**
 * Action to check the current identity verification status
 */
export const checkIdentityStatusAction: Action = {
  name: 'CHECK_IDENTITY_STATUS',
  description: 'Check verification status of entity identities across platforms',
  similes: [
    'check identity',
    'verify identity',
    'identity status',
    'who is verified',
    'check verification',
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    const keywords = ['check', 'identity', 'status', 'verified', 'verification'];
    return keywords.some((kw) => text.includes(kw));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info('[CheckIdentityStatus] Starting identity status check');

      // Get services from runtime
      const rolodexService = runtime.getService('rolodex');
      if (!rolodexService) {
        throw new Error('Rolodex service not available');
      }

      // Extract entity name or ID from message
      const text = message.content.text || '';
      const entityNameMatch = text.match(
        /check (?:identity|verification) (?:status )?(?:for |of )?(.+)/i
      );
      const entityName = entityNameMatch?.[1]?.trim();

      if (!entityName) {
        const response = {
          text: 'Please specify which entity you want to check. Example: "check identity status for John Smith"',
          actions: ['CHECK_IDENTITY_STATUS'],
        };

        if (callback) {
          await callback(response);
        }

        return {
          text: response.text,
          data: { error: 'No entity specified' },
        };
      }

      // Search for the entity using service method
      const searchMethod = (rolodexService as any).searchEntities;
      if (!searchMethod) {
        const response = {
          text: 'Identity status checking is currently unavailable.',
          actions: ['CHECK_IDENTITY_STATUS'],
        };

        if (callback) {
          await callback(response);
        }

        return {
          text: response.text,
          data: { error: 'Service method not available' },
        };
      }

      const searchResults = await searchMethod.call(rolodexService, entityName);
      if (searchResults.length === 0) {
        const response = {
          text: `I couldn't find any entity matching "${entityName}". Try a different name or use TRACK_ENTITY to add them first.`,
          actions: ['CHECK_IDENTITY_STATUS'],
        };

        if (callback) {
          await callback(response);
        }

        return {
          text: response.text,
          data: { entityName, found: false },
        };
      }

      const entity = searchResults[0];
      const platforms = entity.platforms || {};

      // Get verified and unverified platforms
      const verifiedPlatforms = Object.entries(platforms)
        .filter(([_platform, identity]) => (identity as any).verified)
        .map(([platform, identity]) => ({
          platform,
          name:
            (identity as any).metadata?.name ||
            (identity as any).platformId ||
            (identity as any).handle,
          verifiedAt: (identity as any).linkedAt || (identity as any).verifiedAt,
        }));

      const unverifiedPlatforms = Object.entries(platforms)
        .filter(([_platform, identity]) => !(identity as any).verified)
        .map(([platform, identity]) => ({
          platform,
          name:
            (identity as any).metadata?.name ||
            (identity as any).platformId ||
            (identity as any).handle,
        }));

      // Build response
      let responseText = `Identity verification status for ${entity.names?.[0] || entityName}:\n\n`;

      if (verifiedPlatforms.length > 0) {
        responseText += '✅ **Verified Identities:**\n';
        verifiedPlatforms.forEach((p) => {
          responseText += `• ${p.platform}: ${p.name}${p.verifiedAt ? ` (verified on ${new Date(p.verifiedAt).toLocaleDateString()})` : ''}\n`;
        });
      }

      if (unverifiedPlatforms.length > 0) {
        responseText += '\n❌ **Unverified Identities:**\n';
        unverifiedPlatforms.forEach((p) => {
          responseText += `• ${p.platform}: ${p.name}\n`;
        });
        responseText += '\nUse VERIFY_OAUTH_IDENTITY to verify these platforms.';
      }

      if (verifiedPlatforms.length === 0 && unverifiedPlatforms.length === 0) {
        responseText +=
          'No platform identities linked yet. Use VERIFY_OAUTH_IDENTITY to add verified identities.';
      }

      const response = {
        text: responseText,
        actions: ['CHECK_IDENTITY_STATUS'],
        metadata: {
          entityId: entity.id || entity.entityId,
          verifiedCount: verifiedPlatforms.length,
          unverifiedCount: unverifiedPlatforms.length,
        },
      };

      if (callback) {
        await callback(response);
      }

      return {
        text: responseText,
        data: {
          entityId: entity.id || entity.entityId,
          verifiedPlatforms,
          unverifiedPlatforms,
        },
      };
    } catch (error) {
      logger.error('[CheckIdentityStatus] Error:', error);

      const errorMessage = `Failed to check identity status: ${(error as Error).message}`;
      if (callback) {
        await callback({
          text: errorMessage,
          actions: ['CHECK_IDENTITY_STATUS'],
        });
      }

      return {
        text: errorMessage,
        data: { error: (error as Error).message },
      };
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: { text: 'check identity status for John Smith' },
      },
      {
        name: 'assistant',
        content: {
          text: 'Identity verification status for John Smith:\n\n✅ **Verified Identities:**\n• github: johnsmith (verified on 12/1/2024)\n• twitter: @jsmith (verified on 12/2/2024)\n\n❌ **Unverified Identities:**\n• linkedin: john-smith\n\nUse VERIFY_OAUTH_IDENTITY to verify these platforms.',
          action: 'CHECK_IDENTITY_STATUS',
        },
      },
    ],
  ],
};
