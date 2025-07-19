import { type Provider, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';

/**
 * Provider that supplies character evolution context for self-reflection
 * Helps the agent understand its current state and recent modifications
 */
export const characterEvolutionProvider: Provider = {
  name: 'CHARACTER_EVOLUTION',
  description: 'Provides context about character evolution and recent modifications',
  dynamic: true, // Only included when explicitly requested
  position: 5, // After basic providers but before decision-making

  get: async (runtime: IAgentRuntime, message: Memory, _state: State) => {
    try {
      const characterInfo = await gatherCharacterInfo(runtime);
      const recentModifications = await getRecentModifications(runtime, message.roomId);
      const evolutionSuggestions = await getEvolutionSuggestions(runtime, message.roomId);

      const contextText = formatEvolutionContext(
        characterInfo,
        recentModifications,
        evolutionSuggestions
      );

      return {
        text: contextText,
        values: {
          totalModifications: recentModifications.length,
          pendingEvolutionSuggestions: evolutionSuggestions.length,
          lastModificationAge: recentModifications[0]?.timestamp
            ? Date.now() - recentModifications[0].timestamp
            : null,
          hasEvolutionCapability: true,
        },
        data: {
          characterInfo,
          recentModifications,
          evolutionSuggestions,
        },
      };
    } catch (error) {
      logger.error('Error in character evolution provider', error);

      return {
        text: '[CHARACTER EVOLUTION]\nEvolution context temporarily unavailable\n[/CHARACTER EVOLUTION]',
        values: {
          hasEvolutionCapability: false,
          error: true,
        },
      };
    }
  },
};

/**
 * Gather comprehensive character information for context
 */
async function gatherCharacterInfo(runtime: IAgentRuntime) {
  const character = runtime.character;

  const characterInfo = {
    name: character.name,
    bio: Array.isArray(character.bio) ? character.bio : [character.bio],
    topics: character.topics?.length || 0,
    messageExamples: character.messageExamples?.length || 0,
    hasStyle: !!character.style,
    settings: Object.keys(character.settings || {}).length,
  };

  return characterInfo;
}

/**
 * Get recent character modifications from memory
 */
async function getRecentModifications(runtime: IAgentRuntime, roomId: string, limit = 5) {
  try {
    const modifications = await runtime.getMemories({
      entityId: runtime.agentId,
      roomId: roomId as any, // Type cast for UUID compatibility
      count: limit,
      tableName: 'character_modifications',
    });

    return modifications.map((memory) => ({
      timestamp: (memory.content.metadata as any)?.timestamp || memory.createdAt,
      modification: (memory.content.metadata as any)?.modification,
      isUserRequested: (memory.content.metadata as any)?.isUserRequested || false,
      requesterId: (memory.content.metadata as any)?.requesterId,
      summary: memory.content.text,
    }));
  } catch (error) {
    logger.warn('Failed to get recent modifications', error);
    return [];
  }
}

/**
 * Get pending evolution suggestions
 */
async function getEvolutionSuggestions(runtime: IAgentRuntime, roomId: string, limit = 3) {
  try {
    const suggestions = await runtime.getMemories({
      entityId: runtime.agentId,
      roomId: roomId as any, // Type cast for UUID compatibility
      count: limit,
      tableName: 'character_evolution',
    });

    return suggestions.map((memory) => ({
      timestamp: (memory.content.metadata as any)?.timestamp || memory.createdAt,
      confidence: (memory.content.metadata as any)?.evolution?.confidence,
      reasoning: (memory.content.metadata as any)?.evolution?.reasoning,
      modifications: (memory.content.metadata as any)?.evolution?.modifications,
      conversationContext: (memory.content.metadata as any)?.conversationContext,
    }));
  } catch (error) {
    logger.warn('Failed to get evolution suggestions', error);
    return [];
  }
}

/**
 * Format evolution context for the agent
 */
function formatEvolutionContext(
  characterInfo: any,
  recentModifications: any[],
  evolutionSuggestions: any[]
): string {
  const sections: string[] = ['[CHARACTER EVOLUTION CONTEXT]'];

  // Current character state
  sections.push(`Current Character State:
- Name: ${characterInfo.name}
- Bio elements: ${characterInfo.bio.length}
- Topics: ${characterInfo.topics}
- Message examples: ${characterInfo.messageExamples}
- Has custom style: ${characterInfo.hasStyle}
- Custom settings: ${characterInfo.settings}`);

  // Recent modifications
  if (recentModifications.length > 0) {
    sections.push(`Recent Modifications (last ${recentModifications.length}):`);
    recentModifications.forEach((mod, index) => {
      const age = Date.now() - mod.timestamp;
      const ageStr = formatAge(age);
      const source = mod.isUserRequested ? 'user-requested' : 'self-initiated';
      sections.push(`${index + 1}. ${ageStr} ago (${source}): ${mod.summary}`);
    });
  } else {
    sections.push('No recent modifications found.');
  }

  // Evolution suggestions
  if (evolutionSuggestions.length > 0) {
    sections.push('Pending Evolution Suggestions:');
    evolutionSuggestions.forEach((suggestion, index) => {
      const age = Date.now() - suggestion.timestamp;
      const ageStr = formatAge(age);
      sections.push(
        `${index + 1}. ${ageStr} ago (confidence: ${(suggestion.confidence * 100).toFixed()}%): ${suggestion.reasoning}`
      );
    });
  } else {
    sections.push('No pending evolution suggestions.');
  }

  // Evolution capabilities
  sections.push(`Evolution Capabilities:
- Can analyze conversations for learning opportunities
- Can suggest gradual character improvements
- Can apply modifications with user permission
- Maintains backup copies of character files
- Validates modifications for safety and consistency`);

  sections.push('[/CHARACTER EVOLUTION CONTEXT]');

  return sections.join('\n');
}

/**
 * Format time age into human-readable string
 */
function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
}
