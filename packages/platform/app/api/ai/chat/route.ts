/**
 * POST /api/ai/chat
 * Chat with AI models with automatic credit deduction
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import { withModelUsageTracking } from '@/lib/billing/credit-middleware';
import OpenAI from 'openai';
import { z } from 'zod';

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    }),
  ),
  model: z.string().default('gpt-3.5-turbo'),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().min(1).max(4096).default(1000),
  stream: z.boolean().default(false),
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function handlePOST(request: NextRequest) {
  try {
    // Get current user session
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = chatSchema.parse(body);

    // This route will automatically track OpenAI usage and deduct credits
    return withModelUsageTracking(
      request,
      {
        service: 'openai',
        modelName: validatedData.model,
        operation: 'chat',
      },
      () => handleChatRequest(validatedData, user.organizationId),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error('Chat request validation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chat request',
      },
      { status: 500 },
    );
  }
}

async function handleChatRequest(
  validatedData: z.infer<typeof chatSchema>,
  organizationId: string,
): Promise<NextResponse> {
  try {
    // Validate OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'AI service not configured',
        },
        { status: 503 },
      );
    }

    // Call real OpenAI API
    const completion = await openai.chat.completions.create({
      model: validatedData.model,
      messages:
        validatedData.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: validatedData.temperature,
      max_tokens: validatedData.max_tokens,
      stream: validatedData.stream,
    });

    // Return the real OpenAI response
    return NextResponse.json({
      success: true,
      data: completion,
    });
  } catch (error) {
    console.error('OpenAI API call failed:', error);

    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      let statusCode = 500;
      let errorMessage = 'AI service error';

      if (error.status === 401) {
        statusCode = 503;
        errorMessage = 'AI service authentication failed';
      } else if (error.status === 429) {
        statusCode = 429;
        errorMessage = 'AI service rate limit exceeded';
      } else if (error.status === 400) {
        statusCode = 400;
        errorMessage = 'Invalid request to AI service';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: error.message,
        },
        { status: statusCode },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process AI request',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
