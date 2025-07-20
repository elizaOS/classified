import {
  logger,
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionResult,
  type Entity,
  type UUID,
} from '@elizaos/core';

// Helper function for fuzzy string matching using Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Helper function to find entity by name with fuzzy matching
async function _findEntityByName(
  runtime: IAgentRuntime,
  searchName: string,
  roomId?: UUID
): Promise<Entity | null> {
  try {
    // Get entities from room if roomId provided, otherwise get all entities
    const entities = roomId
      ? await runtime.getEntitiesForRoom(roomId)
      : await runtime.getEntitiesByIds([]);

    if (!entities || entities.length === 0) {
      return null;
    }

    const searchLower = searchName.toLowerCase().trim();
    let bestMatch: Entity | null = null;
    let bestScore = Infinity;

    for (const entity of entities) {
      for (const name of entity.names) {
        const nameLower = name.toLowerCase().trim();

        // Exact match gets highest priority
        if (nameLower === searchLower) {
          return entity;
        }

        // Check if search term is contained in name
        if (nameLower.includes(searchLower) || searchLower.includes(nameLower)) {
          const distance = levenshteinDistance(searchLower, nameLower);
          if (distance < bestScore) {
            bestScore = distance;
            bestMatch = entity;
          }
        }

        // Calculate edit distance for fuzzy matching
        const distance = levenshteinDistance(searchLower, nameLower);
        const similarity = 1 - distance / Math.max(searchLower.length, nameLower.length);

        if (similarity > 0.6 && distance < bestScore) {
          bestScore = distance;
          bestMatch = entity;
        }
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error finding entity by name:', error);
    return null;
  }
}

const _findEntityTemplate = `
# Task: Find Entity

You are tasked with finding a specific entity (person, organization, or system) that the user is looking for.

## Context
{{recentMessages}}

## Available Entities
{{entities}}

## Current Message
User is looking for: "{{query}}"

## Instructions
1. Search through the available entities to find the best match
2. Consider aliases, alternative names, and partial matches
3. If multiple matches are found, list them all
4. If no matches are found, suggest similar entities or explain what information is needed

## Response Format
Respond with information about the found entity(ies) in a helpful format. Include:
- Entity name and any aliases
- Basic information about the entity
- How to reference this entity in future conversations
- Any relevant relationships or context

Be conversational and helpful in your response.
`;

export const findEntityAction: Action = {
  name: 'FIND_ENTITY',
  description: 'Find an entity by name or search criteria',
  similes: ['find person', 'search for', 'look up', 'who is', 'find contact'],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    const findKeywords = ['find', 'search', 'look up', 'who is', 'lookup'];
    return findKeywords.some((k) => text.includes(k));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const rolodexService = runtime.getService('rolodex');
      if (!rolodexService) {
        throw new Error('Rolodex service not available');
      }

      // Extract search query from message
      const text = message.content.text || '';
      const searchMatch = text.match(/(?:find|search|look up|who is|lookup)\s+(.+)/i);
      const searchQuery = searchMatch?.[1]?.trim();

      if (!searchQuery) {
        const response = {
          text: 'Please specify who or what you want to find.',
          action: 'FIND_ENTITY',
        };

        if (callback) {
          await callback(response);
        }

        return {
          success: false,
          text: response.text,
          data: { error: 'No search query provided' },
        };
      }

      // Search for entities using service
      const searchMethod = (rolodexService as any).searchEntities;
      if (!searchMethod) {
        const response = {
          text: 'Entity search is currently unavailable.',
          action: 'FIND_ENTITY',
        };

        if (callback) {
          await callback(response);
        }

        return {
          success: false,
          text: response.text,
          data: { error: 'Search method not available' },
        };
      }

      const searchResults = await searchMethod.call(rolodexService, searchQuery);

      if (!searchResults || searchResults.length === 0) {
        const response = {
          text: `I couldn't find any entities matching "${searchQuery}". Try different search terms or use TRACK_ENTITY to add them.`,
          action: 'FIND_ENTITY',
        };

        if (callback) {
          await callback(response);
        }

        return {
          success: true,
          text: response.text,
          data: { searchQuery, found: false },
        };
      }

      // Format results
      let responseText = `Found ${searchResults.length} ${searchResults.length === 1 ? 'entity' : 'entities'} matching "${searchQuery}":\n\n`;

      for (const entity of searchResults.slice(0, 5)) {
        responseText += `**${entity.names?.[0] || 'Unknown'}**\n`;
        responseText += `- Type: ${entity.type || 'unknown'}\n`;
        responseText += `- Tags: ${entity.tags?.join(', ') || 'none'}\n`;
        if (entity.summary) {
          responseText += `- Summary: ${entity.summary}\n`;
        }
        responseText += '\n';
      }

      if (searchResults.length > 5) {
        responseText += `\n...and ${searchResults.length - 5} more results.`;
      }

      const response = {
        text: responseText,
        action: 'FIND_ENTITY',
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        text: responseText,
        data: {
          searchQuery,
          results: searchResults.map((entity: any) => ({
            entityId: entity.id || entity.entityId,
            name: entity.names?.[0] || 'Unknown',
            type: entity.type || 'unknown',
            score: entity.relevanceScore || entity.score || 1,
          })),
          totalResults: searchResults.length,
        },
      };
    } catch (error) {
      logger.error('[FindEntity] Error:', error);
      const errorMsg = `Failed to search for entities: ${(error as Error).message}`;

      if (callback) {
        await callback({
          text: errorMsg,
          action: 'FIND_ENTITY',
        });
      }

      return {
        success: false,
        text: errorMsg,
        data: { error: (error as Error).message },
      };
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: { text: 'find John Smith' },
      },
      {
        name: 'assistant',
        content: {
          text: 'Found 2 entities matching "John Smith":\n\n**John Smith**\n- Type: person\n- Tags: colleague, developer\n- Summary: Software engineer at TechCorp\n\n**John A. Smith**\n- Type: person\n- Tags: friend\n- Summary: College friend from MIT',
          action: 'FIND_ENTITY',
        },
      },
    ],
  ],
};

function _extractSearchQuery(text: string): string | null {
  // Remove common stop words and extract the main search term
  const patterns = [
    /find\s+(.+?)(?:\s+for\s+me)?$/i,
    /search\s+for\s+(.+)$/i,
    /look\s+up\s+(.+)$/i,
    /who\s+is\s+(.+?)(?:\?|$)/i,
    /do\s+you\s+know\s+(.+?)(?:\?|$)/i,
    /can\s+you\s+find\s+(.+?)(?:\?|$)/i,
    /get\s+me\s+info\s+about\s+(.+)$/i,
    /tell\s+me\s+about\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: look for proper nouns (capitalized words)
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (properNouns && properNouns.length > 0) {
    return properNouns[0];
  }

  return null;
}

function _formatEntityDetails(entity: any, components: any[], relationships: any[]): string {
  let details = `**${entity.names[0]}**\n`;
  details += `- ID: ${entity.id}\n`;
  details += `- Names: ${entity.names.join(', ')}\n`;

  if (entity.metadata) {
    details += `- Metadata: ${JSON.stringify(entity.metadata, null, 2)}\n`;
  }

  if (components.length > 0) {
    details += `- Components: ${components.map((c) => c.type).join(', ')}\n`;
  }

  if (relationships.length > 0) {
    details += `- Relationships: ${relationships.length} connections\n`;
  }

  return details;
}

function _formatEntityList(entities: any[]): string {
  return entities
    .slice(0, 10) // Limit to 10 entities
    .map((entity, index) => {
      return `${index + 1}. **${entity.names[0]}** (${entity.names.slice(1).join(', ') || 'no aliases'}) - ID: ${entity.id}`;
    })
    .join('\n');
}

function _formatRecentMessages(state?: State): string {
  if (!state?.text) {
    return 'No recent message context available.';
  }
  return state.text.slice(-500); // Last 500 chars
}

interface SearchResult {
  entity: any;
  score: number;
}

function _searchEntitiesFuzzy(entities: any[], query: string): SearchResult[] {
  const queryLower = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const entity of entities) {
    let bestScore = 0;

    // Check all names for matches
    for (const name of entity.names) {
      const nameLower = name.toLowerCase();

      // Exact match
      if (nameLower === queryLower) {
        bestScore = Math.max(bestScore, 1.0);
      }
      // Starts with
      else if (nameLower.startsWith(queryLower)) {
        bestScore = Math.max(bestScore, 0.9);
      }
      // Contains
      else if (nameLower.includes(queryLower)) {
        bestScore = Math.max(bestScore, 0.7);
      }
      // Fuzzy match (simple Levenshtein-like)
      else {
        const distance = calculateSimpleDistance(queryLower, nameLower);
        const maxLen = Math.max(queryLower.length, nameLower.length);
        const similarity = 1 - distance / maxLen;
        if (similarity > 0.5) {
          bestScore = Math.max(bestScore, similarity * 0.6);
        }
      }
    }

    if (bestScore > 0.3) {
      // Minimum threshold
      results.push({ entity, score: bestScore });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

function calculateSimpleDistance(a: string, b: string): number {
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const matrix = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}
