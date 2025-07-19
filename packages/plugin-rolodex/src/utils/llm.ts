import { type IAgentRuntime, ModelType, logger } from '@elizaos/core';
import { z } from 'zod';

interface LLMProcessorOptions {
  maxRetries?: number;
  retryDelay?: number;
  temperature?: number;
  maxTokens?: number;
}

export class LLMProcessor {
  private runtime: IAgentRuntime;
  private options: Required<LLMProcessorOptions>;

  constructor(runtime: IAgentRuntime, options?: LLMProcessorOptions) {
    this.runtime = runtime;
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      temperature: 0.7,
      maxTokens: 2000,
      ...options,
    };
  }

  /**
   * Generate structured output with schema validation
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    modelType = ModelType.TEXT_LARGE
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        // Add schema description to prompt
        const enhancedPrompt = `${prompt}

IMPORTANT: Your response must be valid JSON that matches the following structure:
${this.getSchemaDescription(schema)}

Example of expected format:
${this.getSchemaExample(schema)}

Respond ONLY with the JSON object, no additional text, no markdown formatting, no explanations.`;

        // Generate response
        const response = await this.runtime.useModel(modelType, {
          prompt: enhancedPrompt,
          temperature: this.options.temperature,
          maxTokens: this.options.maxTokens,
        });

        // Extract JSON from response
        const json = this.extractJSON(response);

        // Validate against schema
        const result = schema.parse(json);

        return result;
      } catch (_error) {
        lastError = _error as Error;
        logger.warn(`[LLMProcessor] Attempt ${attempt + 1} failed:`, _error);

        if (attempt < this.options.maxRetries - 1) {
          // Wait before retry with exponential backoff
          await this.delay(this.options.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw new Error(
      `Failed to generate structured output after ${this.options.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate text with retry logic
   */
  async generateText(prompt: string, modelType = ModelType.TEXT_LARGE): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        const response = await this.runtime.useModel(modelType, {
          prompt,
          temperature: this.options.temperature,
          maxTokens: this.options.maxTokens,
        });

        return response;
      } catch (_error) {
        lastError = _error as Error;
        logger.warn(`[LLMProcessor] Text generation attempt ${attempt + 1} failed:`, _error);

        if (attempt < this.options.maxRetries - 1) {
          await this.delay(this.options.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw new Error(
      `Failed to generate text after ${this.options.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
        text,
      });

      // Handle different response formats
      if (Array.isArray(response)) {
        return response;
      } else if (typeof response === 'object' && 'embedding' in response) {
        return (response as any).embedding;
      } else {
        throw new Error('Unexpected embedding response format');
      }
    } catch (_error) {
      logger.error('[LLMProcessor] Error generating embedding:', _error);
      throw _error;
    }
  }

  /**
   * Batch generate text for multiple prompts
   */
  async batchGenerateText(prompts: string[], modelType = ModelType.TEXT_LARGE): Promise<string[]> {
    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    const results: string[] = [];

    for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
      const batch = prompts.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map((prompt) => this.generateText(prompt, modelType))
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Extract JSON from LLM response
   */
  private extractJSON(response: string): any {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const arrayMatch = response.match(/\[[\s\S]*\]/);

    let jsonString: string | null = null;

    if (jsonMatch && (!arrayMatch || jsonMatch.index! < arrayMatch.index!)) {
      jsonString = jsonMatch[0];
    } else if (arrayMatch) {
      jsonString = arrayMatch[0];
    }

    if (!jsonString) {
      // Try the entire response as JSON
      jsonString = response.trim();
    }

    try {
      return JSON.parse(jsonString);
    } catch (_error) {
      // Clean up common issues
      jsonString = jsonString
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']')
        .trim();

      return JSON.parse(jsonString);
    }
  }

  /**
   * Get human-readable schema description
   */
  private getSchemaDescription(schema: z.ZodSchema<any>): string {
    // This is a simplified version - in production, you'd want
    // to properly parse the Zod schema structure
    const schemaString = JSON.stringify(schema._def, null, 2);

    // Extract the shape if it's an object schema
    if ('shape' in schema && typeof schema.shape === 'function') {
      const shape = schema.shape();
      const fields: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        fields.push(`  "${key}": ${this.getFieldType(value as any)}`);
      }

      return `{
${fields.join(',\n')}
}`;
    }

    return schemaString;
  }

  /**
   * Get field type description
   */
  private getFieldType(field: any): string {
    if (field._def) {
      const typeName = field._def.typeName;

      switch (typeName) {
        case 'ZodString':
          return 'string';
        case 'ZodNumber':
          return 'number';
        case 'ZodBoolean':
          return 'boolean';
        case 'ZodArray':
          return `array of ${this.getFieldType(field._def.type)}`;
        case 'ZodObject':
          return 'object';
        case 'ZodEnum':
          return `one of: ${field._def.values.map((v: any) => `"${v}"`).join(', ')}`;
        default:
          return 'any';
      }
    }

    return 'any';
  }

  /**
   * Get example JSON for schema
   */
  private getSchemaExample(schema: z.ZodSchema<any>): string {
    // Provide specific examples for known schemas
    try {
      // Try to get the shape if it's an object schema
      if ('shape' in schema && typeof schema.shape === 'function') {
        const shape = schema.shape();

        // Check if this is the EntityExtractionSchema
        if ('entities' in shape) {
          return JSON.stringify(
            {
              entities: [
                {
                  type: 'person',
                  names: ['John Doe'],
                  summary: 'A software engineer',
                  tags: ['developer', 'engineer'],
                  platforms: { github: 'johndoe' },
                  metadata: { role: 'Senior Engineer' },
                },
              ],
            },
            null,
            2
          );
        }

        // Check if this is the RelationshipInferenceSchema
        if ('relationships' in shape) {
          return JSON.stringify(
            {
              relationships: [
                {
                  sourceEntity: 'Alice',
                  targetEntity: 'Bob',
                  type: 'colleague',
                  confidence: 0.85,
                  evidence: 'They work on the same team',
                  sentiment: 0.7,
                },
              ],
            },
            null,
            2
          );
        }

        // Check if this is the TrustAnalysisSchema
        if ('trustDelta' in shape) {
          return JSON.stringify(
            {
              trustDelta: 0.1,
              reason: 'Consistent helpful behavior',
              indicators: ['helpful', 'reliable'],
              riskLevel: 'low',
            },
            null,
            2
          );
        }
      }
    } catch (_error) {
      // If we can't determine the schema type, return default
    }

    // Default example
    return '{}';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate completion with streaming support
   */
  async generateStream(
    prompt: string,
    onToken: (token: string) => void,
    modelType = ModelType.TEXT_LARGE
  ): Promise<string> {
    // Note: This would require runtime support for streaming
    // For now, we'll simulate it
    const response = await this.generateText(prompt, modelType);

    // Simulate streaming by emitting tokens
    const words = response.split(' ');
    for (const word of words) {
      onToken(`${word} `);
      await this.delay(50); // Simulate streaming delay
    }

    return response;
  }
}
