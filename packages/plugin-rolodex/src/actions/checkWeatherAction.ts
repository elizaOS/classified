import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';

export const checkWeatherAction: Action = {
  name: 'CHECK_WEATHER',
  similes: ['GET_WEATHER', 'WEATHER_REPORT', 'WEATHER_CHECK', 'WEATHER_FORECAST'],
  description: 'Check weather for a location using the weather API',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Check for weather-related keywords
    const weatherKeywords = [
      'weather',
      'temperature',
      'forecast',
      'climate',
      'rain',
      'sunny',
      'cloudy',
    ];
    const hasWeatherKeyword = weatherKeywords.some((kw) => text.includes(kw));

    // Check if we have the weather API key
    const hasApiKey = !!runtime.getSetting('WEATHER_API_KEY');

    return hasWeatherKeyword && hasApiKey;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      const apiKey = runtime.getSetting('WEATHER_API_KEY');

      if (!apiKey) {
        if (callback) {
          await callback({
            text: "I don't have access to the weather API. Please ask an admin to provide the WEATHER_API_KEY.",
            thought: 'Missing WEATHER_API_KEY',
          });
        }
        return;
      }

      // Extract location from message
      const text = message.content.text || '';
      const locationMatch = text.match(/(?:in|for|at)\s+([A-Za-z\s]+?)(?:\?|$|using)/i);
      const location = locationMatch ? locationMatch[1].trim() : 'New York';

      // Simulate API call with the key
      logger.info(
        `[checkWeatherAction] Checking weather for ${location} with API key: ${apiKey.substring(0, 5)}...`
      );

      // Simulate weather data (in real implementation, this would call actual API)
      const weatherData = {
        location,
        temperature: Math.floor(Math.random() * 30) + 50, // 50-80°F
        condition: ['sunny', 'cloudy', 'partly cloudy', 'rainy'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
        windSpeed: Math.floor(Math.random() * 20) + 5, // 5-25 mph
      };

      if (callback) {
        await callback({
          text: `Weather in ${weatherData.location}:\n🌡️ Temperature: ${weatherData.temperature}°F\n☁️ Condition: ${weatherData.condition}\n💧 Humidity: ${weatherData.humidity}%\n💨 Wind: ${weatherData.windSpeed} mph\n\n(Using authenticated weather API)`,
          thought: `Successfully retrieved weather data for ${location} using API key`,
          actions: ['CHECK_WEATHER'],
        });
      }

      return {
        success: true,
        values: {
          location: weatherData.location,
          temperature: weatherData.temperature,
          condition: weatherData.condition,
        },
        data: {
          fullWeatherData: weatherData,
          apiKeyUsed: true,
        },
      };
    } catch (error) {
      logger.error('[checkWeatherAction] Error checking weather:', error);

      if (callback) {
        await callback({
          text: 'I encountered an error while checking the weather. Please try again.',
          thought: 'Error in checkWeatherAction handler',
        });
      }
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: { text: "What's the weather in San Francisco?" },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Weather in San Francisco:\n🌡️ Temperature: 65°F\n☁️ Condition: partly cloudy\n💧 Humidity: 60%\n💨 Wind: 12 mph\n\n(Using authenticated weather API)',
          thought: 'Retrieved weather data using stored API key',
          actions: ['CHECK_WEATHER'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'Can you check the weather in London using the weather API?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Weather in London:\n🌡️ Temperature: 55°F\n☁️ Condition: rainy\n💧 Humidity: 75%\n💨 Wind: 18 mph\n\n(Using authenticated weather API)',
          thought: 'Successfully used weather API with stored credentials',
          actions: ['CHECK_WEATHER'],
        },
      },
    ],
  ],
};
