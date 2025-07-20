import { ModelType, logger } from '@elizaos/core';
import { type Action, type IAgentRuntime, type Memory, type HandlerCallback } from '@elizaos/core';
import { RolodexService } from '../services';

export const recordPlatformClaimAction: Action = {
  name: 'RECORD_PLATFORM_CLAIM',
  description: 'Record when someone claims to have an identity on another platform (e.g., "My Twitter is @john")',
  similes: ['my twitter is', 'my discord is', 'my github is', 'I am on', 'find me on', 'my handle is'],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Use LLM to detect platform identity claims
    const prompt = `Does this message contain a claim about someone's identity on another platform?
Message: "${message.content.text}"

Look for patterns like:
- "My Twitter is @username" 
- "My Discord is username#1234"
- "Find me on GitHub as username"
- "I'm @username on Twitter"
- "My handle on X is @username"

Answer only yes or no.`;

    try {
      const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
      return (response as string).toLowerCase().includes('yes');
    } catch (error) {
      logger.error('Error validating platform claim', error);
      // Fallback to keyword detection
      const platforms = ['twitter', 'discord', 'github', 'telegram', 'instagram', 'tiktok', 'reddit'];
      const keywords = ['my', 'handle', 'find me', 'i am', '@', '#'];
      return platforms.some(p => text.includes(p)) && keywords.some(k => text.includes(k));
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

      // Extract platform claim information using LLM
      const extractPrompt = `Extract platform identity claim from this message:
"${message.content.text}"

Return a JSON object with:
- platform: the platform name (twitter, discord, github, etc.)
- handle: the username/handle being claimed
- confidence: confidence level (0-1) based on how explicit the claim is

If no clear platform claim is found, return null.

Example output:
{"platform": "twitter", "handle": "@johndoe", "confidence": 0.9}`;

      let claimInfo;
      try {
        const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt: extractPrompt });
        claimInfo = JSON.parse(response as string);
      } catch (error) {
        logger.error('Failed to extract platform claim info', error);
        claimInfo = null;
      }

      if (!claimInfo || !claimInfo.platform || !claimInfo.handle) {
        if (callback) {
          await callback({
            text: "I couldn't identify which platform identity you're claiming.",
            error: true,
          });
        }
        return { text: "I couldn't identify which platform identity you're claiming.", success: false };
      }

      // Get the claiming entity (the message sender)
      const claimingEntityId = message.entityId;

      // Record the platform claim using the entity resolution manager
      const entityResolutionManager = rolodexService.entityResolutionManager;
      if (!entityResolutionManager) {
        throw new Error('EntityResolutionManager not available');
      }

      const claimId = await entityResolutionManager.recordPlatformClaim(
        claimingEntityId, // who made the claim
        claimingEntityId, // which entity made the claim (same in this case)
        claimingEntityId, // which entity the claim is about (claiming about themselves)
        claimInfo.platform.toLowerCase(),
        claimInfo.handle,
        claimInfo.confidence || 0.8,
        'user_statement',
        message.content.text || ''
      );

      // Generate response
      const responseText = `I've recorded your claim that your ${claimInfo.platform} handle is ${claimInfo.handle}. If you confirm this from your ${claimInfo.platform} account, I can link these identities together with high confidence.`;

      if (callback) {
        await callback({
          text: responseText,
          metadata: {
            claimId,
            platform: claimInfo.platform,
            handle: claimInfo.handle,
            action: 'platform_claim_recorded',
          },
        });
      }

      return {
        data: { claimId, platform: claimInfo.platform, handle: claimInfo.handle },
        text: responseText,
        success: true,
      };
    } catch (error) {
      logger.error('Error recording platform claim', error);
      if (callback) {
        await callback({
          text: 'I had trouble recording that platform claim. Please try again.',
          error: true,
        });
      }
      return { text: 'I had trouble recording that platform claim. Please try again.', success: false };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: { text: 'My Twitter is @johndoe123' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've recorded your claim that your twitter handle is @johndoe123. If you confirm this from your twitter account, I can link these identities together with high confidence.",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'You can find me on Discord as user#1234' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've recorded your claim that your discord handle is user#1234. If you confirm this from your discord account, I can link these identities together with high confidence.",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'My GitHub username is developer99' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've recorded your claim that your github handle is developer99. If you confirm this from your github account, I can link these identities together with high confidence.",
        },
      },
    ],
  ],
};