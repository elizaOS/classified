import { IAgentRuntime, Memory, Provider, State, elizaLogger } from '@elizaos/core';
import { fetchPluginKnowledge } from '../services/pluginRegistryService.ts';

export const pluginKnowledgeProvider: Provider = {
  name: 'pluginKnowledge',
  description:
    'Provides searchable knowledge about available plugins including their READMEs and descriptions',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Get cached plugin knowledge
    const knowledge = await fetchPluginKnowledge();

    // Format the knowledge for the agent
    let text = 'Plugin Knowledge Database:\n\n';
    let pluginCount = 0;

    for (const [pluginName, info] of knowledge.entries()) {
      pluginCount++;
      text += `**${pluginName}**\n`;
      text += `Description: ${info.description}\n`;

      if (info.tags && info.tags.length > 0) {
        text += `Tags: ${info.tags.join(', ')}\n`;
      }

      if (info.features && info.features.length > 0) {
        text += `Features:\n`;
        info.features.forEach((feature) => {
          text += `- ${feature}\n`;
        });
      }

      text += '\n';

      // Limit to prevent too much context
      if (pluginCount >= 10) {
        text += `... and ${knowledge.size - 10} more plugins available.\n`;
        break;
      }
    }

    return {
      text,
      values: {
        totalPlugins: knowledge.size,
        pluginNames: Array.from(knowledge.keys()),
      },
      data: {
        knowledge: Object.fromEntries(knowledge),
      },
    };
  },
};
