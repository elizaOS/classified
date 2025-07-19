import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { stringToUuid, asUUID } from '@elizaos/core';
import { storeSecretAction } from '../actions/storeSecretAction';
import { checkWeatherAction } from '../actions/checkWeatherAction';
import { getNewsAction } from '../actions/getNewsAction';
import { getStockPriceAction } from '../actions/getStockPriceAction';
import { createMockRuntime, createMockMemory, createMockState } from './test-utils';

describe('Secrets Management Actions', () => {
  let mockRuntime: any;
  let mockCallback: any;
  let mockMessage: any;
  let mockState: any;

  beforeEach(() => {
    mock.restore();

    mockRuntime = createMockRuntime({
      getSetting: mock((key: string) => {
        const settings: { [key: string]: any } = {
          WEATHER_API_KEY: undefined,
          NEWS_API_KEY: undefined,
          FINANCE_API_KEY: undefined,
        };
        return settings[key];
      }),
      character: {
        name: 'TestAgent',
        bio: ['Test bio'],
        system: 'Test system',
        secrets: {},
      },
    });

    mockCallback = mock();
    mockState = createMockState();
  });

  describe('storeSecretAction', () => {
    it('should validate when admin provides API keys', async () => {
      const message = createMockMemory({
        content: { text: 'Admin: Store these keys: WEATHER_API_KEY=abc123' },
      });

      const isValid = await storeSecretAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should not validate without admin prefix', async () => {
      const message = createMockMemory({
        content: { text: 'Store these keys: WEATHER_API_KEY=abc123' },
      });

      const isValid = await storeSecretAction.validate(mockRuntime, message);
      expect(isValid).toBe(false);
    });

    it('should extract and store multiple API keys', async () => {
      const message = createMockMemory({
        content: { text: 'Admin: Store these: WEATHER_API_KEY=wk123 NEWS_API_KEY=nk456' },
      });

      const result = await storeSecretAction.handler(
        mockRuntime,
        message,
        mockState,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      if (typeof result === 'object' && result !== null) {
        expect(result.values?.storedKeys).toContain('WEATHER_API_KEY');
        expect(result.values?.storedKeys).toContain('NEWS_API_KEY');
        expect(result.values?.count).toBe(2);
      }

      expect(mockRuntime.character.secrets.WEATHER_API_KEY).toBe('wk123');
      expect(mockRuntime.character.secrets.NEWS_API_KEY).toBe('nk456');

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('securely stored 2 API keys'),
          actions: ['STORE_SECRET'],
        })
      );
    });

    it('should handle no API keys in message', async () => {
      const message = createMockMemory({
        content: { text: 'Admin: Please store the API keys' },
      });

      await storeSecretAction.handler(mockRuntime, message, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("couldn't find any API keys"),
        })
      );
    });
  });

  describe('checkWeatherAction', () => {
    it('should validate when weather keywords present and API key exists', async () => {
      mockRuntime.getSetting = mock((key: string) =>
        key === 'WEATHER_API_KEY' ? 'test-key' : undefined
      );

      const message = createMockMemory({
        content: { text: 'What is the weather in London?' },
      });

      const isValid = await checkWeatherAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should not validate without API key', async () => {
      const message = createMockMemory({
        content: { text: 'What is the weather in London?' },
      });

      const isValid = await checkWeatherAction.validate(mockRuntime, message);
      expect(isValid).toBe(false);
    });

    it('should check weather for specified location', async () => {
      mockRuntime.getSetting = mock((key: string) =>
        key === 'WEATHER_API_KEY' ? 'test-weather-key' : undefined
      );

      const message = createMockMemory({
        content: { text: 'Check the weather in San Francisco' },
      });

      const result = await checkWeatherAction.handler(
        mockRuntime,
        message,
        mockState,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      if (typeof result === 'object' && result !== null) {
        expect(result.values?.location).toBe('San Francisco');
        expect(result.data?.apiKeyUsed).toBe(true);
      }

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/Weather in San Francisco.*Temperature:/s),
          actions: ['CHECK_WEATHER'],
        })
      );
    });

    it('should handle missing API key gracefully', async () => {
      const message = createMockMemory({
        content: { text: 'What is the weather?' },
      });

      await checkWeatherAction.handler(mockRuntime, message, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("don't have access to the weather API"),
        })
      );
    });
  });

  describe('getNewsAction', () => {
    it('should validate when news keywords present and API key exists', async () => {
      mockRuntime.getSetting = mock((key: string) =>
        key === 'NEWS_API_KEY' ? 'test-key' : undefined
      );

      const message = createMockMemory({
        content: { text: 'Get me the latest tech news' },
      });

      const isValid = await getNewsAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should fetch news for specified topic', async () => {
      mockRuntime.getSetting = mock((key: string) =>
        key === 'NEWS_API_KEY' ? 'test-news-key' : undefined
      );

      const message = createMockMemory({
        content: { text: 'Show me technology news headlines' },
      });

      const result = await getNewsAction.handler(mockRuntime, message, mockState, {}, mockCallback);

      expect(result).toBeDefined();
      if (typeof result === 'object' && result !== null) {
        expect(result.values?.topic).toBe('technology');
        expect(result.data?.apiKeyUsed).toBe(true);
      }

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Latest technology news headlines'),
          actions: ['GET_NEWS'],
        })
      );
    });
  });

  describe('getStockPriceAction', () => {
    it('should validate when stock keywords present and API key exists', async () => {
      mockRuntime.getSetting = mock((key: string) =>
        key === 'FINANCE_API_KEY' ? 'test-key' : undefined
      );

      const message = createMockMemory({
        content: { text: 'What is the stock price of AAPL?' },
      });

      const isValid = await getStockPriceAction.validate(mockRuntime, message);
      expect(isValid).toBe(true);
    });

    it('should fetch stock price for specified ticker', async () => {
      mockRuntime.getSetting = mock((key: string) =>
        key === 'FINANCE_API_KEY' ? 'test-finance-key' : undefined
      );

      const message = createMockMemory({
        content: { text: 'Get me the stock price for TSLA' },
      });

      const result = await getStockPriceAction.handler(
        mockRuntime,
        message,
        mockState,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      if (typeof result === 'object' && result !== null) {
        expect(result.values?.symbol).toBe('TSLA');
        expect(result.data?.apiKeyUsed).toBe(true);
      }

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/TSLA.*Current Price: \$/s),
          actions: ['GET_STOCK_PRICE'],
        })
      );
    });

    it('should handle missing finance API key', async () => {
      const message = createMockMemory({
        content: { text: 'Check AAPL stock price' },
      });

      await getStockPriceAction.handler(mockRuntime, message, mockState, {}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("don't have access to the finance API"),
        })
      );
    });
  });

  describe('Action Examples', () => {
    it('should have proper action examples for all actions', () => {
      // Verify action examples are properly formatted
      expect(storeSecretAction.examples).toBeDefined();
      expect(Array.isArray(storeSecretAction.examples)).toBe(true);

      expect(checkWeatherAction.examples).toBeDefined();
      expect(Array.isArray(checkWeatherAction.examples)).toBe(true);

      expect(getNewsAction.examples).toBeDefined();
      expect(Array.isArray(getNewsAction.examples)).toBe(true);

      expect(getStockPriceAction.examples).toBeDefined();
      expect(Array.isArray(getStockPriceAction.examples)).toBe(true);

      // Check format of examples
      if (storeSecretAction.examples && storeSecretAction.examples.length > 0) {
        const example = storeSecretAction.examples[0];
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThan(0);
        expect(example[0]).toHaveProperty('name');
        expect(example[0]).toHaveProperty('content');
      }
    });
  });
});
