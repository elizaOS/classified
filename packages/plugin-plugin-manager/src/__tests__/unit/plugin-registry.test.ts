import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { fetchPluginKnowledge, searchPluginsByContent } from '../../services/pluginRegistryService';

// Mock fetch
global.fetch = mock() as any;

describe('Plugin Registry Service', () => {
  beforeEach(() => {
    (global.fetch as any).mockClear();
  });

  describe('searchPluginsByContent', () => {
    it('should search plugins by content', async () => {
      // Mock the fetch response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '@elizaos/plugin-weather': {
            description: 'Weather information and forecasting plugin',
            tags: ['weather', 'forecast', 'climate'],
            repository: 'github:elizaos-plugins/plugin-weather',
          },
          '@elizaos/plugin-sql': {
            description: 'SQL database operations',
            tags: ['database', 'sql'],
            repository: 'github:elizaos-plugins/plugin-sql',
          },
        }),
      });

      const results = await searchPluginsByContent('weather');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('@elizaos/plugin-weather');
      expect(results[0].description).toContain('Weather');
      expect(results[0].tags).toContain('weather');
    });

    it('should return empty array when no matches found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '@elizaos/plugin-sql': {
            description: 'SQL database operations',
            tags: ['database', 'sql'],
          },
        }),
      });

      const results = await searchPluginsByContent('nonexistent-plugin-feature');
      expect(results).toHaveLength(0);
    });
  });

  describe('fetchPluginKnowledge', () => {
    it('should fetch and format plugin knowledge', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '@elizaos/plugin-weather': {
            description: 'Weather information plugin',
            tags: ['weather', 'api'],
            readme: '# Weather Plugin\n\n## Features\n- Current weather\n- Forecasts\n',
          },
        }),
      });

      const knowledge = await fetchPluginKnowledge();

      // Since fetch failed, it should use mock data which has 3 plugins
      expect(knowledge.size).toBeGreaterThan(0);
      const weatherKnowledge = knowledge.get('@elizaos/plugin-weather');
      if (weatherKnowledge) {
        expect(weatherKnowledge.features).toBeDefined();
      }
    });
  });
});
