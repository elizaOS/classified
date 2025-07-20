import { ModelType, logger, asUUID, stringToUuid } from '@elizaos/core';
import { type Action, type IAgentRuntime, type Memory, type HandlerCallback } from '@elizaos/core';
import { RolodexService } from '../services';

export const confirmPlatformIdentityAction: Action = {
  name: 'CONFIRM_PLATFORM_IDENTITY',
  description: 'Confirm platform identity when someone verifies they are the same person from another platform',
  similes: ['yes this is me', 'i am the same', 'this is my account', 'confirming my identity', 'same person'],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Use LLM to detect identity confirmation
    const prompt = `Does this message contain a confirmation of identity from another platform?
Message: "${message.content.text}"

Look for patterns like:
- "Yes, this is me from Twitter"
- "I am the same person as @username on Discord"
- "This is my account, I was just talking to you on Discord"
- "Confirming my identity from the other platform"
- "Same person from Twitter"

Answer only yes or no.`;

    try {
      const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
      return (response as string).toLowerCase().includes('yes');
    } catch (error) {
      logger.error('Error validating platform confirmation', error);
      // Fallback to keyword detection
      const confirmationKeywords = ['confirm', 'yes', 'same', 'this is me', 'my account', 'verify'];
      const platforms = ['twitter', 'discord', 'github', 'telegram', 'instagram'];
      return confirmationKeywords.some(k => text.includes(k)) && 
             (platforms.some(p => text.includes(p)) || text.includes('other') || text.includes('platform'));
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: any,
    options: any,
    callback?: HandlerCallback
  ) => {
    try {
      const rolodexService = runtime.getService<RolodexService>('rolodex');
      if (!rolodexService) {
        throw new Error('RolodexService not available');
      }

      // Extract confirmation information using LLM
      const extractPrompt = `Extract identity confirmation information from this message:
"${message.content.text}"

Return a JSON object with:
- platform: the platform being referenced (twitter, discord, github, etc.)
- handle: the handle/username being confirmed (if mentioned)
- confidence: confidence level (0-1) based on how explicit the confirmation is
- method: how they're confirming (direct_statement, behavioral_match, etc.)

If no clear confirmation is found, return null.

Example output:
{"platform": "twitter", "handle": "@johndoe", "confidence": 0.9, "method": "direct_statement"}`;

      let confirmationInfo;
      try {
        const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt: extractPrompt });
        confirmationInfo = JSON.parse(response as string);
      } catch (error) {
        logger.error('Failed to extract confirmation info', error);
        confirmationInfo = null;
      }

      // Get the confirming entity (the message sender)
      const confirmingEntityId = message.entityId;

      // Get entity resolution manager
      const entityResolutionManager = rolodexService.entityResolutionManager;
      if (!entityResolutionManager) {
        throw new Error('EntityResolutionManager not available');
      }

      // If we have specific confirmation info, record it
      if (confirmationInfo && confirmationInfo.platform) {
        const platform = confirmationInfo.platform.toLowerCase();
        const handle = confirmationInfo.handle || 'unknown';
        const claimId = asUUID(stringToUuid(`${platform}:${handle}:confirmation`));

        const completed = await entityResolutionManager.recordPlatformConfirmation(
          confirmingEntityId, // who is confirming
          confirmingEntityId, // which entity is being confirmed
          platform,
          handle,
          claimId, // reference to the original claim
          confirmationInfo.confidence || 0.8,
          confirmationInfo.method || 'direct_statement',
          message.content.text || ''
        );

        let responseText;
        if (completed) {
          responseText = `Thank you for confirming your identity! I've successfully linked your identities across platforms and can now better track our relationship context.`;
        } else {
          responseText = `I've recorded your identity confirmation for ${platform}. I'm still gathering evidence to make a confident link between your identities.`;
        }

        if (callback) {
          await callback({
            text: responseText,
            metadata: {
              platform,
              handle,
              completed,
              action: 'platform_identity_confirmed',
            },
          });
        }

        return {
          data: { platform, handle, completed },
          text: responseText,
          success: true,
        };
      } else {
        // Generic confirmation without specific platform details
        // Look for recent platform claims that might match this confirmation
        const allClaims = await entityResolutionManager.getPlatformClaims();
        const recentClaims = allClaims
          .filter(claim => 
            claim.claimedAbout === confirmingEntityId && 
            (Date.now() - claim.timestamp.getTime()) < 24 * 60 * 60 * 1000 // last 24 hours
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (recentClaims.length > 0) {
          const mostRecentClaim = recentClaims[0];
          const claimId = asUUID(stringToUuid(`${mostRecentClaim.platform}:${mostRecentClaim.handle}:confirmation`));

          const completed = await entityResolutionManager.recordPlatformConfirmation(
            confirmingEntityId,
            confirmingEntityId,
            mostRecentClaim.platform,
            mostRecentClaim.handle,
            claimId,
            0.7, // Lower confidence for implicit confirmation
            'direct_statement',
            message.content.text || ''
          );

          const responseText = completed
            ? `Thank you for confirming your identity! I've successfully linked your ${mostRecentClaim.platform} identity with high confidence.`
            : `I've recorded your confirmation. I'm still gathering evidence to confidently link your identities.`;

          if (callback) {
            await callback({
              text: responseText,
              metadata: {
                platform: mostRecentClaim.platform,
                handle: mostRecentClaim.handle,
                completed,
                action: 'platform_identity_confirmed',
              },
            });
          }

          return {
            data: { 
              platform: mostRecentClaim.platform, 
              handle: mostRecentClaim.handle, 
              completed 
            },
            text: responseText,
            success: true,
          };
        } else {
          if (callback) {
            await callback({
              text: "I'd like to help confirm your identity, but I don't have any recent platform claims to match this confirmation against. Could you be more specific about which platform you're confirming?",
              error: true,
            });
          }

          return {
            text: "I'd like to help confirm your identity, but I don't have any recent platform claims to match this confirmation against.",
            success: false,
          };
        }
      }
    } catch (error) {
      logger.error('Error confirming platform identity', error);
      if (callback) {
        await callback({
          text: 'I had trouble processing your identity confirmation. Please try again.',
          error: true,
        });
      }
      return { 
        text: 'I had trouble processing your identity confirmation. Please try again.', 
        success: false 
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: { text: 'Yes, this is me from Twitter @johndoe123' },
      },
      {
        name: 'Agent',
        content: {
          text: "Thank you for confirming your identity! I've successfully linked your identities across platforms and can now better track our relationship context.",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Same person from Discord' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've recorded your confirmation. I'm still gathering evidence to confidently link your identities.",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'This is my account, confirming from the other platform' },
      },
      {
        name: 'Agent',
        content: {
          text: "Thank you for confirming your identity! I've successfully linked your github identity with high confidence.",
        },
      },
    ],
  ],
};