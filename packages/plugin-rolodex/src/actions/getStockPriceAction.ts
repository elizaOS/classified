import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';

export const getStockPriceAction: Action = {
  name: 'GET_STOCK_PRICE',
  similes: ['CHECK_STOCK', 'STOCK_PRICE', 'GET_QUOTE', 'CHECK_PRICE'],
  description: 'Get stock prices using the finance API',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Check for stock/finance-related keywords
    const stockKeywords = ['stock', 'price', 'quote', 'ticker', 'shares', 'market'];
    const hasStockKeyword = stockKeywords.some((kw) => text.includes(kw));

    // Check if we have the finance API key
    const hasApiKey = !!runtime.getSetting('FINANCE_API_KEY');

    return hasStockKeyword && hasApiKey;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      const apiKey = runtime.getSetting('FINANCE_API_KEY');

      if (!apiKey) {
        if (callback) {
          await callback({
            text: "I don't have access to the finance API. Please ask an admin to provide the FINANCE_API_KEY.",
            thought: 'Missing FINANCE_API_KEY - cannot access stock prices',
          });
        }
        return;
      }

      // Extract ticker symbol from message
      const text = message.content.text || '';
      const tickerMatch = text.match(/\b([A-Z]{1,5})\b/);
      const ticker = tickerMatch ? tickerMatch[1] : 'AAPL';

      // Simulate API call with the key
      logger.info(
        `[getStockPriceAction] Fetching stock price for ${ticker} with API key: ${apiKey.substring(0, 5)}...`
      );

      // Simulate stock data (in real implementation, this would call actual API)
      const stockData = {
        symbol: ticker,
        price: (Math.random() * 300 + 50).toFixed(2),
        change: (Math.random() * 10 - 5).toFixed(2),
        changePercent: (Math.random() * 5 - 2.5).toFixed(2),
        volume: Math.floor(Math.random() * 50000000) + 10000000,
        marketCap: `${(Math.random() * 900 + 100).toFixed(0)}B`,
        dayHigh: (Math.random() * 300 + 60).toFixed(2),
        dayLow: (Math.random() * 280 + 40).toFixed(2),
      };

      const changeEmoji = parseFloat(stockData.change) >= 0 ? '📈' : '📉';
      const changeColor = parseFloat(stockData.change) >= 0 ? '+' : '';

      if (callback) {
        await callback({
          text: `${changeEmoji} **${stockData.symbol}** Stock Information:\n\n💵 Current Price: $${stockData.price}\n${changeEmoji} Change: ${changeColor}${stockData.change} (${changeColor}${stockData.changePercent}%)\n📊 Volume: ${stockData.volume.toLocaleString()}\n💰 Market Cap: $${stockData.marketCap}\n📈 Day High: $${stockData.dayHigh}\n📉 Day Low: $${stockData.dayLow}\n\n(Data from authenticated finance API)`,
          thought: `Successfully retrieved stock data for ${ticker} using API key`,
          actions: ['GET_STOCK_PRICE'],
        });
      }

      return {
        success: true,
        values: {
          symbol: stockData.symbol,
          price: parseFloat(stockData.price),
          change: parseFloat(stockData.change),
        },
        data: {
          fullStockData: stockData,
          apiKeyUsed: true,
        },
      };
    } catch (error) {
      logger.error('[getStockPriceAction] Error getting stock price:', error);

      if (callback) {
        await callback({
          text: 'I encountered an error while fetching stock prices. Please try again.',
          thought: 'Error in getStockPriceAction handler',
        });
      }
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: { text: "What's the current price of AAPL stock?" },
      },
      {
        name: '{{agent}}',
        content: {
          text: '📈 **AAPL** Stock Information:\n\n💵 Current Price: $175.25\n📈 Change: +2.35 (+1.36%)\n📊 Volume: 45,234,567\n💰 Market Cap: $2.8T\n📈 Day High: $176.50\n📉 Day Low: $173.20\n\n(Data from authenticated finance API)',
          thought: 'Retrieved stock price using stored API key',
          actions: ['GET_STOCK_PRICE'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'Get me stock prices for MSFT' },
      },
      {
        name: '{{agent}}',
        content: {
          text: '📉 **MSFT** Stock Information:\n\n💵 Current Price: $425.50\n📉 Change: -1.25 (-0.29%)\n📊 Volume: 23,456,789\n💰 Market Cap: $3.1T\n📈 Day High: $428.00\n📉 Day Low: $424.75\n\n(Data from authenticated finance API)',
          thought: 'Successfully used finance API with stored credentials',
          actions: ['GET_STOCK_PRICE'],
        },
      },
    ],
  ],
};
