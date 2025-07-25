import {
  Plugin,
  ModelType,
  IAgentRuntime,
  logger
} from '@elizaos/core';
import { SystemDetection } from './services/SystemDetection';

/**
 * Get Ollama URL based on environment
 */
function getOllamaUrl(): string {
  // Use container-local URL when running in container, localhost otherwise
  const isContainer = process.env.DOCKER_CONTAINER === 'true';
  const baseUrl = isContainer ? 'http://eliza-ollama:11434' : 'http://localhost:7772';
  logger.info(`[OLLAMA] Using Ollama URL: ${baseUrl} (container: ${isContainer})`);
  return baseUrl;
}

// Store the selected model globally
let selectedModel: string = 'llama3.2:1b'; // Default fallback

/**
 * Generate text using Ollama with the optimal DeepSeek model
 */
async function generateOllamaText(prompt: string): Promise<string> {
  const ollamaUrl = getOllamaUrl();

  try {
    // Ensure prompt is a clean string
    const cleanPrompt = typeof prompt === 'string' ? prompt : String(prompt || '');

    // Create clean request body to avoid circular references
    const requestBody = {
      model: selectedModel,
      prompt: cleanPrompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_ctx: 128000, // Set 128K context length
        num_predict: 2000,
      }
    };

    logger.debug(`[OLLAMA] Generating text with model: ${selectedModel}, prompt length: ${cleanPrompt.length}`);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[OLLAMA] Text generation API error ${response.status}: ${errorText}`);
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logger.info(`[OLLAMA] Successfully generated text response: ${(data.response || '').substring(0, 100)}...`);
    return data.response || '';
  } catch (error) {
    logger.error('[OLLAMA] Text generation failed:', error);
    throw error;
  }
}

/**
 * Generate embeddings using Ollama
 */
async function generateOllamaEmbedding(text: string): Promise<number[]> {
  const ollamaUrl = getOllamaUrl();

  try {
    // Ensure text is a string
    const textStr = typeof text === 'string' ? text : String(text);
    logger.info(`[OLLAMA] Generating embedding for text: "${textStr.substring(0, 50)}..."`);

    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nomic-embed-text', // Keep this separate - embeddings need a specialized model
        prompt: textStr,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[OLLAMA] Embeddings API error ${response.status}: ${errorText}`);
      throw new Error(`Ollama embeddings API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logger.info(`[OLLAMA] Successfully generated embedding with ${data.embedding?.length || 0} dimensions`);
    return data.embedding || [];
  } catch (error) {
    logger.error('[OLLAMA] Embedding generation failed:', error);
    throw error;
  }
}

export const ollamaPlugin: Plugin = {
  name: 'ollama',
  description: 'Ollama local AI model provider for text generation and embeddings',
  priority: 100, // High priority to load before OpenAI

  async init(_config: Record<string, string>, _runtime: IAgentRuntime) {
    const isContainerized = process.env.DOCKER_CONTAINER === 'true';

    if (isContainerized) {
      logger.info('[OLLAMA] Initializing Ollama plugin for containerized environment...');
      logger.info('[OLLAMA] Using pre-configured model: llama3.2:1b');
      selectedModel = 'llama3.2:1b';

      const ollamaUrl = getOllamaUrl();
      logger.info(`[OLLAMA] Using Ollama URL: ${ollamaUrl} (container: true)`);
      logger.info('[OLLAMA] Model specs: 1.3GB, 128,000 tokens context');
    } else {
      logger.info('[OLLAMA] Initializing Ollama plugin with DeepSeek model selection...');

      try {
        // Display system capabilities
        const systemSummary = await SystemDetection.getSystemSummary();
        logger.info(`[OLLAMA] System Analysis:\n${systemSummary}`);

        // Get Ollama URL
        const ollamaUrl = getOllamaUrl();

        // Select and ensure optimal DeepSeek model is available
        const optimalModel = await SystemDetection.ensureOptimalModel(ollamaUrl);
        selectedModel = optimalModel.pullCommand;

        logger.info(`[OLLAMA] Using model: ${selectedModel} for both TEXT_SMALL and TEXT_LARGE`);
        logger.info(`[OLLAMA] Model specs: ${optimalModel.memoryGB}GB, ${optimalModel.contextLength.toLocaleString()} tokens context`);

        // Ensure embedding model is also available
        const embeddingModelInstalled = await SystemDetection.checkModelInstalled('nomic-embed-text', ollamaUrl);
        if (!embeddingModelInstalled) {
          logger.info('[OLLAMA] Pulling embedding model: nomic-embed-text...');
          await SystemDetection.pullModel('nomic-embed-text', ollamaUrl);
        }
      } catch (detectionError) {
        logger.warn('[OLLAMA] SystemDetection failed, using fallback configuration:', detectionError.message);
        selectedModel = 'llama3.2:1b';
      }
    }

    // Test the selected model (skip for containerized environments since models are pre-verified)
    if (!isContainerized) {
      try {
        const _testResponse = await generateOllamaText('Hello, this is a test.');
        logger.info('[OLLAMA] ✅ Text generation test successful with selected model');

        const testEmbedding = await generateOllamaEmbedding('test embedding');
        logger.info(`[OLLAMA] ✅ Embedding test successful - ${testEmbedding.length} dimensions`);
      } catch (testError) {
        logger.error('[OLLAMA] ❌ Model test failed:', testError.message);
        logger.warn(`[OLLAMA] Please ensure the model is properly installed: ollama pull ${selectedModel}`);
      }
    } else {
      logger.info('[OLLAMA] ✅ Skipping model test for containerized environment - models pre-verified');
    }

    logger.info('[OLLAMA] ✅ Plugin initialized - ready for inference');
  },

  models: {
    [ModelType.TEXT_LARGE]: async (params: any) => {
      logger.info('[OLLAMA] Handling TEXT_LARGE request');
      // Safely extract prompt from potentially circular object
      let prompt = '';
      if (typeof params === 'string') {
        prompt = params;
      } else if (params && typeof params === 'object') {
        prompt = params.prompt || params.messages || params.text || '[object]';
      } else {
        prompt = String(params || '');
      }
      return await generateOllamaText(prompt);
    },

    [ModelType.TEXT_SMALL]: async (params: any) => {
      logger.info('[OLLAMA] Handling TEXT_SMALL request');
      // Safely extract prompt from potentially circular object
      let prompt = '';
      if (typeof params === 'string') {
        prompt = params;
      } else if (params && typeof params === 'object') {
        prompt = params.prompt || params.messages || params.text || '[object]';
      } else {
        prompt = String(params || '');
      }
      return await generateOllamaText(prompt);
    },

    [ModelType.TEXT_EMBEDDING]: async (params: any) => {
      logger.info('[OLLAMA] Handling TEXT_EMBEDDING request');
      // Safely extract text from potentially circular object
      let text = '';
      if (typeof params === 'string') {
        text = params;
      } else if (params && typeof params === 'object') {
        text = params.text || params.prompt || params.input || '[object]';
      } else {
        text = String(params || '');
      }
      return await generateOllamaEmbedding(text);
    }
  },
};

export default ollamaPlugin;
