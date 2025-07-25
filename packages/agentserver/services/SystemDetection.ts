import { logger } from '@elizaos/core';
import os from 'os';
import { execSync } from 'child_process';

interface SystemCapabilities {
  totalRAM: number; // GB
  availableRAM: number; // GB
  gpuType: 'cuda' | 'mlx' | 'cpu' | 'rocm';
  gpuMemory?: number; // GB
  cpuCores: number;
  platform: string;
  architecture: string;
}

interface DeepSeekModel {
  name: string;
  size: string; // e.g., "1.5b", "7b", "8b"
  memoryGB: number;
  contextLength: number;
  minRAMRequired: number; // Minimum RAM needed including context overhead
  pullCommand: string;
}

const DEEPSEEK_MODELS: DeepSeekModel[] = [
  {
    name: 'deepseek-r1:1.5b',
    size: '1.5b',
    memoryGB: 1.1,
    contextLength: 128000,
    minRAMRequired: 8, // 1.1GB model + 4-6GB for 128K context + system overhead
    pullCommand: 'deepseek-r1:1.5b'
  },
  {
    name: 'deepseek-r1:7b',
    size: '7b',
    memoryGB: 4.7,
    contextLength: 128000,
    minRAMRequired: 16, // 4.7GB model + 8-10GB for 128K context + system overhead
    pullCommand: 'deepseek-r1:7b'
  },
  {
    name: 'deepseek-r1:8b',
    size: '8b',
    memoryGB: 5.2,
    contextLength: 128000,
    minRAMRequired: 18, // 5.2GB model + 8-10GB for 128K context + system overhead
    pullCommand: 'deepseek-r1:8b'
  },
  {
    name: 'deepseek-r1:14b',
    size: '14b',
    memoryGB: 9.0,
    contextLength: 128000,
    minRAMRequired: 24, // 9GB model + 12-14GB for 128K context + system overhead
    pullCommand: 'deepseek-r1:14b'
  },
  {
    name: 'deepseek-r1:32b',
    size: '32b',
    memoryGB: 20,
    contextLength: 128000,
    minRAMRequired: 48, // 20GB model + 20-25GB for 128K context + system overhead
    pullCommand: 'deepseek-r1:32b'
  },
  {
    name: 'deepseek-r1:70b',
    size: '70b',
    memoryGB: 43,
    contextLength: 128000,
    minRAMRequired: 96, // 43GB model + 40-50GB for 128K context + system overhead
    pullCommand: 'deepseek-r1:70b'
  }
];

export class SystemDetection {
  private static capabilities: SystemCapabilities | null = null;

  /**
   * Detect system capabilities
   */
  static async detectCapabilities(): Promise<SystemCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    logger.info('[SYSTEM] Detecting system capabilities...');

    const totalRAM = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const freeRAM = Math.round(os.freemem() / (1024 * 1024 * 1024));
    const availableRAM = Math.max(freeRAM - 2, Math.round(totalRAM * 0.7)); // Reserve 2GB for system or use 70% of total
    const cpuCores = os.cpus().length;
    const platform = os.platform();
    const architecture = os.arch();

    let gpuType: 'cuda' | 'mlx' | 'cpu' | 'rocm' = 'cpu';
    let gpuMemory: number | undefined;

    // Detect GPU type
    try {
      if (platform === 'darwin' && architecture === 'arm64') {
        // Apple Silicon Mac - use MLX
        gpuType = 'mlx';
        // For Apple Silicon, GPU memory is shared with system RAM
        gpuMemory = totalRAM;
        logger.info('[SYSTEM] Detected Apple Silicon - using MLX acceleration');
      } else if (platform === 'linux' || platform === 'win32') {
        // Try to detect NVIDIA CUDA
        try {
          const nvidiaSmi = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', {
            encoding: 'utf8',
            timeout: 5000
          });
          const gpuMemoryMB = parseInt(nvidiaSmi.trim(), 10);
          if (!isNaN(gpuMemoryMB) && gpuMemoryMB > 0) {
            gpuType = 'cuda';
            gpuMemory = Math.round(gpuMemoryMB / 1024);
            logger.info(`[SYSTEM] Detected NVIDIA GPU with ${gpuMemory}GB VRAM - using CUDA acceleration`);
          }
        } catch {
          // Try to detect AMD ROCm
          try {
            execSync('rocm-smi', { encoding: 'utf8', timeout: 5000 });
            gpuType = 'rocm';
            logger.info('[SYSTEM] Detected AMD GPU - using ROCm acceleration');
          } catch {
            logger.info('[SYSTEM] No GPU acceleration detected - using CPU');
          }
        }
      }
    } catch (error) {
      logger.debug('[SYSTEM] GPU detection failed:', error);
      logger.info('[SYSTEM] Defaulting to CPU inference');
    }

    this.capabilities = {
      totalRAM,
      availableRAM,
      gpuType,
      gpuMemory,
      cpuCores,
      platform,
      architecture
    };

    logger.info('[SYSTEM] System capabilities detected:', {
      totalRAM: `${totalRAM}GB`,
      availableRAM: `${availableRAM}GB`,
      gpuType,
      gpuMemory: gpuMemory ? `${gpuMemory}GB` : 'N/A',
      cpuCores,
      platform,
      architecture
    });

    return this.capabilities;
  }

  /**
   * Select the optimal DeepSeek model based on system capabilities
   */
  static async selectOptimalDeepSeekModel(): Promise<DeepSeekModel> {
    const capabilities = await this.detectCapabilities();

    logger.info('[SYSTEM] Selecting optimal DeepSeek model...');
    logger.info(`[SYSTEM] Available RAM: ${capabilities.availableRAM}GB, GPU: ${capabilities.gpuType}`);

    // DEV MODE: For quick startup, prioritize what's already installed
    const useSmallModels = process.env.USE_SMALL_MODELS === 'true' ||
                          process.env.NODE_ENV === 'development' ||
                          process.env.ELIZA_DEV_MODE === 'true';

    if (useSmallModels) {
      logger.info('[SYSTEM] 🚀 DEV MODE: Using smallest available model for quick startup');
      const smallestModel = DEEPSEEK_MODELS[0]; // 1.5b model
      logger.info(`[SYSTEM] DEV: Selected ${smallestModel.name} for fast development`);
      logger.info('[SYSTEM] DEV: Set USE_SMALL_MODELS=false for production model selection');
      return smallestModel;
    }

    // Sort models by size (largest first) and find the best fit
    const sortedModels = [...DEEPSEEK_MODELS].sort((a, b) => b.memoryGB - a.memoryGB);

    for (const model of sortedModels) {
      // Check if we have enough RAM for the model + context
      const hasEnoughRAM = capabilities.availableRAM >= model.minRAMRequired;

      // For GPU acceleration, also check VRAM if available
      let hasEnoughVRAM = true;
      if (capabilities.gpuMemory && (capabilities.gpuType === 'cuda' || capabilities.gpuType === 'rocm')) {
        // For discrete GPUs, we need the model to fit in VRAM
        hasEnoughVRAM = capabilities.gpuMemory >= model.memoryGB;
      }

      if (hasEnoughRAM && hasEnoughVRAM) {
        logger.info(`[SYSTEM] Selected model: ${model.name}`);
        logger.info(`[SYSTEM] Model size: ${model.memoryGB}GB, Required RAM: ${model.minRAMRequired}GB`);
        logger.info(`[SYSTEM] Context length: ${model.contextLength.toLocaleString()} tokens`);
        return model;
      } else {
        logger.debug(`[SYSTEM] Skipping ${model.name}: RAM=${hasEnoughRAM}, VRAM=${hasEnoughVRAM}`);
      }
    }

    // Fallback to smallest model if nothing fits
    const fallback = DEEPSEEK_MODELS[0];
    logger.warn(`[SYSTEM] No model fits available resources, using smallest: ${fallback.name}`);
    logger.warn(`[SYSTEM] Performance may be degraded with only ${capabilities.availableRAM}GB available RAM`);

    return fallback;
  }

  /**
   * Check if Ollama has the model installed
   */
  static async checkModelInstalled(modelName: string, ollamaUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`);
      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const installedModels = data.models || [];

      return installedModels.some((model: any) =>
        model.name === modelName ||
        model.name === `${modelName}:latest`
      );
    } catch (error) {
      logger.debug('[SYSTEM] Failed to check installed models:', error);
      return false;
    }
  }

  /**
   * Pull a model in Ollama
   */
  static async pullModel(modelName: string, ollamaUrl: string): Promise<boolean> {
    try {
      logger.info(`[SYSTEM] Pulling model: ${modelName}...`);

      const response = await fetch(`${ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
          stream: false
        }),
      });

      if (!response.ok) {
        logger.error(`[SYSTEM] Failed to pull model ${modelName}: ${response.status}`);
        return false;
      }

      logger.info(`[SYSTEM] Successfully pulled model: ${modelName}`);
      return true;
    } catch (error) {
      logger.error(`[SYSTEM] Error pulling model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Ensure the optimal model is available in Ollama
   */
  static async ensureOptimalModel(ollamaUrl: string): Promise<DeepSeekModel> {
    const optimalModel = await this.selectOptimalDeepSeekModel();

    // Check if model is already installed
    const isInstalled = await this.checkModelInstalled(optimalModel.pullCommand, ollamaUrl);

    if (!isInstalled) {
      logger.info(`[SYSTEM] Model ${optimalModel.name} not found, attempting to pull...`);
      const pullSuccess = await this.pullModel(optimalModel.pullCommand, ollamaUrl);

      if (!pullSuccess) {
        logger.warn(`[SYSTEM] Failed to pull ${optimalModel.name}, falling back to smaller model`);

        // Try smaller models in order
        for (const model of DEEPSEEK_MODELS) {
          if (model.memoryGB < optimalModel.memoryGB) {
            const smallerInstalled = await this.checkModelInstalled(model.pullCommand, ollamaUrl);
            if (smallerInstalled || await this.pullModel(model.pullCommand, ollamaUrl)) {
              logger.info(`[SYSTEM] Using fallback model: ${model.name}`);
              return model;
            }
          }
        }

        // If all else fails, return the optimal model anyway (user can manually pull)
        logger.error(`[SYSTEM] No DeepSeek models available. Please manually run: ollama pull ${optimalModel.pullCommand}`);
      }
    } else {
      logger.info(`[SYSTEM] Model ${optimalModel.name} is already available`);
    }

    return optimalModel;
  }

  /**
   * Ensure both text and embedding models are ready for out-of-the-box experience
   */
  static async ensureCompleteOllamaSetup(ollamaUrl: string): Promise<{textModel: DeepSeekModel, embeddingReady: boolean}> {
    logger.info('[SYSTEM] 🚀 Setting up complete Ollama configuration...');

    // 1. Ensure optimal text model
    const textModel = await this.ensureOptimalModel(ollamaUrl);

    // 2. Ensure embedding model
    logger.info('[SYSTEM] 📊 Checking embedding model...');
    let embeddingReady = await this.checkModelInstalled('nomic-embed-text', ollamaUrl);

    if (!embeddingReady) {
      logger.info('[SYSTEM] 📥 Pulling embedding model: nomic-embed-text...');
      embeddingReady = await this.pullModel('nomic-embed-text', ollamaUrl);

      if (!embeddingReady) {
        logger.warn('[SYSTEM] ⚠️ Failed to pull embedding model. Please run: ollama pull nomic-embed-text');
      }
    } else {
      logger.info('[SYSTEM] ✅ Embedding model already available');
    }

    // 3. Test both models work
    if (embeddingReady) {
      try {
        // Quick test of text generation
        const testResponse = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: textModel.pullCommand,
            prompt: 'Hello',
            stream: false,
            options: { num_ctx: 128000, num_predict: 10 }
          })
        });

        if (testResponse.ok) {
          logger.info('[SYSTEM] ✅ Text generation test passed');
        }

        // Quick test of embeddings
        const embeddingResponse = await fetch(`${ollamaUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: 'test embedding'
          })
        });

        if (embeddingResponse.ok) {
          logger.info('[SYSTEM] ✅ Embedding generation test passed');
        }

      } catch (testError) {
        logger.warn('[SYSTEM] ⚠️ Model testing failed (models may still work):', testError.message);
      }
    }

    return { textModel, embeddingReady };
  }

  /**
   * Get system info summary for logging
   */
  static async getSystemSummary(): Promise<string> {
    const capabilities = await this.detectCapabilities();
    const optimalModel = await this.selectOptimalDeepSeekModel();

    return `
System: ${capabilities.platform}/${capabilities.architecture}
RAM: ${capabilities.availableRAM}GB available / ${capabilities.totalRAM}GB total
GPU: ${capabilities.gpuType}${capabilities.gpuMemory ? ` (${capabilities.gpuMemory}GB)` : ''}
CPU: ${capabilities.cpuCores} cores
Optimal Model: ${optimalModel.name} (${optimalModel.memoryGB}GB, 128K context)
    `.trim();
  }
}
