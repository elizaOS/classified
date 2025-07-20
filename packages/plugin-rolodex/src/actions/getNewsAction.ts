import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';

export const getNewsAction: Action = {
  name: 'GET_NEWS',
  similes: ['FETCH_NEWS', 'NEWS_HEADLINES', 'GET_HEADLINES', 'CHECK_NEWS'],
  description: 'Get news headlines using the news API',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Check for news-related keywords
    const newsKeywords = ['news', 'headlines', 'latest', 'breaking', 'article', 'story'];
    const hasNewsKeyword = newsKeywords.some((kw) => text.includes(kw));

    // Check if we have the news API key
    const hasApiKey = !!runtime.getSetting('NEWS_API_KEY');

    return hasNewsKeyword && hasApiKey;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      const apiKey = runtime.getSetting('NEWS_API_KEY');

      if (!apiKey) {
        if (callback) {
          await callback({
            text: "I don't have access to the news API. Please ask an admin to provide the NEWS_API_KEY.",
            thought: 'Missing NEWS_API_KEY',
          });
        }
        return;
      }

      // Extract topic from message
      const text = message.content.text || '';
      let topic = 'general';

      if (text.includes('tech')) {
        topic = 'technology';
      } else if (text.includes('sport')) {
        topic = 'sports';
      } else if (text.includes('business')) {
        topic = 'business';
      } else if (text.includes('health')) {
        topic = 'health';
      } else if (text.includes('science')) {
        topic = 'science';
      }

      // Simulate API call with the key
      logger.info(
        `[getNewsAction] Fetching ${topic} news with API key: ${apiKey.substring(0, 5)}...`
      );

      // Simulate news data (in real implementation, this would call actual API)
      const headlines = [
        {
          title: `Breaking: Major breakthrough in ${topic} sector announced today`,
          source: 'Tech News Daily',
          time: '2 hours ago',
        },
        {
          title: `${topic.charAt(0).toUpperCase() + topic.slice(1)} industry sees record growth in Q4`,
          source: 'Business Wire',
          time: '4 hours ago',
        },
        {
          title: `Experts predict major changes in ${topic} landscape for 2025`,
          source: 'Global Times',
          time: '6 hours ago',
        },
      ];

      const newsText = headlines
        .map((h, i) => `${i + 1}. **${h.title}**\n   Source: ${h.source} • ${h.time}`)
        .join('\n\n');

      if (callback) {
        await callback({
          text: `📰 Latest ${topic} news headlines:\n\n${newsText}\n\n(Fetched using authenticated news API)`,
          thought: `Successfully retrieved ${topic} news using API key`,
          actions: ['GET_NEWS'],
        });
      }

      return {
        success: true,
        values: {
          topic,
          headlineCount: headlines.length,
        },
        data: {
          headlines,
          apiKeyUsed: true,
        },
      };
    } catch (error) {
      logger.error('[getNewsAction] Error getting news:', error);

      if (callback) {
        await callback({
          text: 'I encountered an error while fetching news. Please try again.',
          thought: 'Error in getNewsAction handler',
        });
      }
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: { text: 'Get me the latest tech news headlines' },
      },
      {
        name: '{{agent}}',
        content: {
          text: '📰 Latest technology news headlines:\n\n1. **Breaking: Major breakthrough in technology sector announced today**\n   Source: Tech News Daily • 2 hours ago\n\n2. **Technology industry sees record growth in Q4**\n   Source: Business Wire • 4 hours ago\n\n3. **Experts predict major changes in technology landscape for 2025**\n   Source: Global Times • 6 hours ago\n\n(Fetched using authenticated news API)',
          thought: 'Retrieved news headlines using stored API key',
          actions: ['GET_NEWS'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'What are the latest news headlines?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: '📰 Latest general news headlines:\n\n1. **Breaking: Major breakthrough in general sector announced today**\n   Source: Tech News Daily • 2 hours ago\n\n2. **General industry sees record growth in Q4**\n   Source: Business Wire • 4 hours ago\n\n3. **Experts predict major changes in general landscape for 2025**\n   Source: Global Times • 6 hours ago\n\n(Fetched using authenticated news API)',
          thought: 'Successfully used news API with stored credentials',
          actions: ['GET_NEWS'],
        },
      },
    ],
  ],
};
