import { describe, it, expect } from 'vitest';
import { RequirementParser } from '../utils/requirementParser';

describe('RequirementParser', () => {
  describe('parseFromDescription', () => {
    it('should parse weather plugin requirements', () => {
      const description =
        'Create a weather plugin that gets current weather data from OpenWeatherMap API';
      const requirements = RequirementParser.parseFromDescription(description);

      expect(requirements.name).toBe('Weather');
      expect(requirements.description).toBe(description);
      expect(requirements.complexity).toBeDefined();
      expect(requirements.estimatedDevelopmentTime).toBeDefined();

      // Should have weather-related capabilities
      expect(requirements.capabilities.actions).toContainEqual(
        expect.objectContaining({
          name: 'GET_WEATHER',
          description: 'Get current weather information',
        })
      );

      expect(requirements.capabilities.envVars).toContainEqual(
        expect.objectContaining({
          name: 'OPENWEATHER_API_KEY',
          required: true,
        })
      );
    });

    it('should parse crypto plugin requirements', () => {
      const description = 'Build a cryptocurrency plugin for getting Bitcoin prices';
      const requirements = RequirementParser.parseFromDescription(description);

      expect(requirements.name).toBe('Cryptocurrency');
      expect(requirements.capabilities.actions).toContainEqual(
        expect.objectContaining({
          name: 'GET_CRYPTO_PRICE',
        })
      );
    });

    it('should handle generic plugin descriptions', () => {
      const description = 'Create a custom plugin for handling special tasks';
      const requirements = RequirementParser.parseFromDescription(description);

      expect(requirements.name).toBe('Custom');
      expect(requirements.capabilities.actions.length).toBeGreaterThan(0);
      expect(requirements.complexity).toBeDefined();
    });
  });

  describe('complexity assessment', () => {
    it('should assess simple complexity for basic plugins', () => {
      const description = 'Create a simple hello world plugin';
      const requirements = RequirementParser.parseFromDescription(description);

      expect(requirements.complexity).toBe('simple');
    });

    it('should assess complex complexity for feature-rich plugins', () => {
      const description =
        'Create a comprehensive plugin with weather data, email sending, database storage, background processing, and sentiment analysis';
      const requirements = RequirementParser.parseFromDescription(description);

      expect(requirements.complexity).toBe('complex');
    });
  });
});
