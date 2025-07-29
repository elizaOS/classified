import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import {
  validateApiKey,
  checkApiKeyPermission,
} from '@/lib/server/services/api-key-service';
import { deductCredits } from '@/lib/server/services/billing-service';
import { trackUsage } from '@/lib/server/services/usage-tracking-service';
import { createMetricsMiddleware } from '@/lib/middleware/metrics-middleware';

const openaiRequestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    }),
  ),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(8192).optional(),
  stream: z.boolean().optional(),
});

// Pricing per 1K tokens (input/output)
const OPENAI_PRICING = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
} as const;

const metricsMiddleware = createMetricsMiddleware('/api/v1/inference/openai');

export const POST = metricsMiddleware(async (request: NextRequest) => {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid API key' },
        { status: 401 },
      );
    }

    const apiKeyValue = authHeader.substring(7);
    const apiKey = await validateApiKey(apiKeyValue);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 },
      );
    }

    // Check permissions
    if (!(await checkApiKeyPermission(apiKey, 'inference:openai'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const requestData = openaiRequestSchema.parse(body);

    // Check if model is supported
    if (!OPENAI_PRICING[requestData.model as keyof typeof OPENAI_PRICING]) {
      return NextResponse.json(
        {
          error: 'Unsupported model',
          supportedModels: Object.keys(OPENAI_PRICING),
        },
        { status: 400 },
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Make the request to OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: requestData.model,
      messages: requestData.messages,
      temperature: requestData.temperature,
      max_tokens: requestData.max_tokens,
      stream: requestData.stream || false,
    });
    const duration = Date.now() - startTime;

    // Calculate costs
    const pricing =
      OPENAI_PRICING[requestData.model as keyof typeof OPENAI_PRICING];
    // Check if completion has usage property (non-streaming response)
    const inputTokens =
      'usage' in completion ? completion.usage?.prompt_tokens || 0 : 0;
    const outputTokens =
      'usage' in completion ? completion.usage?.completion_tokens || 0 : 0;

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Add 10% platform margin
    const chargeAmount = totalCost * 1.1;

    // Deduct credits
    const usageRecord = await deductCredits({
      organizationId: apiKey.organizationId,
      userId: apiKey.userId || undefined,
      amount: chargeAmount,
      description: `OpenAI ${requestData.model} - ${inputTokens + outputTokens} tokens`,
      metadata: {
        provider: 'openai',
        model: requestData.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        rawCost: totalCost,
        platformFee: chargeAmount - totalCost,
        duration,
      },
    });

    // Track usage statistics
    await trackUsage({
      organizationId: apiKey.organizationId,
      apiKeyId: apiKey.id,
      provider: 'openai',
      model: requestData.model,
      inputTokens,
      outputTokens,
      cost: chargeAmount,
      duration,
      success: true,
      usageRecordId: usageRecord?.id,
    });

    return NextResponse.json({
      ...completion,
      usage: {
        ...('usage' in completion ? completion.usage : {}),
        cost: chargeAmount,
        billing: {
          inputTokens,
          outputTokens,
          inputCost,
          outputCost,
          platformFee: chargeAmount - totalCost,
          totalCost: chargeAmount,
        },
      },
    });
  } catch (error: any) {
    console.error('OpenAI API error:', error);

    // Track failed usage
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKeyValue = authHeader.substring(7);
      const apiKey = await validateApiKey(apiKeyValue);

      if (apiKey) {
        await trackUsage({
          organizationId: apiKey.organizationId,
          apiKeyId: apiKey.id,
          provider: 'openai',
          model: 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          duration: 0,
          success: false,
          errorMessage: error.message,
        });
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    if (
      error.code === 'insufficient_quota' ||
      error.message.includes('Insufficient credit balance')
    ) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          message:
            'Please add more credits to your account to continue using the API',
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        error: 'API request failed',
        message: error.message || 'Unknown error occurred',
      },
      { status: error.status || 500 },
    );
  }
});
