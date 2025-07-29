import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import {
  validateApiKey,
  checkApiKeyPermission,
} from '@/lib/server/services/api-key-service';
import { deductCredits } from '@/lib/server/services/billing-service';
import { trackUsage } from '@/lib/server/services/usage-tracking-service';

const anthropicRequestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }),
  ),
  max_tokens: z.number().min(1).max(8192),
  temperature: z.number().min(0).max(1).optional(),
  system: z.string().optional(),
  stream: z.boolean().optional(),
});

// Pricing per 1K tokens (input/output)
const ANTHROPIC_PRICING = {
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
} as const;

async function handlePOST(request: NextRequest) {
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
    if (!(await checkApiKeyPermission(apiKey, 'inference:anthropic'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const requestData = anthropicRequestSchema.parse(body);

    // Check if model is supported
    if (
      !ANTHROPIC_PRICING[requestData.model as keyof typeof ANTHROPIC_PRICING]
    ) {
      return NextResponse.json(
        {
          error: 'Unsupported model',
          supportedModels: Object.keys(ANTHROPIC_PRICING),
        },
        { status: 400 },
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Make the request to Anthropic
    const startTime = Date.now();
    const completion = await anthropic.messages.create({
      model: requestData.model,
      max_tokens: requestData.max_tokens,
      messages: requestData.messages,
      temperature: requestData.temperature,
      system: requestData.system,
      stream: requestData.stream || false,
    });
    const duration = Date.now() - startTime;

    // Calculate costs
    const pricing =
      ANTHROPIC_PRICING[requestData.model as keyof typeof ANTHROPIC_PRICING];
    // Check if completion has usage property (non-streaming response)
    const inputTokens =
      'usage' in completion ? completion.usage?.input_tokens || 0 : 0;
    const outputTokens =
      'usage' in completion ? completion.usage?.output_tokens || 0 : 0;

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
      description: `Anthropic ${requestData.model} - ${inputTokens + outputTokens} tokens`,
      metadata: {
        provider: 'anthropic',
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
      provider: 'anthropic',
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
    console.error('Anthropic API error:', error);

    // Track failed usage
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKeyValue = authHeader.substring(7);
      const apiKey = await validateApiKey(apiKeyValue);

      if (apiKey) {
        await trackUsage({
          organizationId: apiKey.organizationId,
          apiKeyId: apiKey.id,
          provider: 'anthropic',
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

    if (error.message.includes('Insufficient credit balance')) {
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
}

export const { POST } = wrapHandlers({ handlePOST });
