/**
 * Character Conversation Messages API Routes - Send messages and get AI responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

// Use dynamic imports to avoid database connection during build
const getCharacterService = () =>
  import('@/lib/characters/service').then((m) => m.characterService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);
const getCreditService = () =>
  import('@/lib/billing/credits').then((m) => m.CreditService);

// Send message schema
const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  metadata: z.record(z.any()).optional(),
});

/**
 * POST /api/characters/conversations/[id]/messages - Send message to character
 */
async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const conversationId = resolvedParams.id;

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = sendMessageSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const { content, metadata } = validation.data;

    // Get character service
    const characterService = await getCharacterService();

    // Get conversation to verify access and get character info
    const conversation = await characterService.getConversation(
      user.organizationId,
      user.id,
      conversationId,
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    // Get character details
    const character = await characterService.getCharacterById(
      user.organizationId,
      conversation.characterId,
    );

    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 },
      );
    }

    // Add user message to conversation
    const updatedConversation = await characterService.addMessage(
      user.organizationId,
      user.id,
      conversationId,
      {
        role: 'user',
        content,
        metadata,
      },
    );

    // Generate AI response using character configuration
    try {
      const response = await generateCharacterResponse(
        character,
        updatedConversation.messages,
        user.organizationId,
      );

      // Add AI response to conversation
      const finalConversation = await characterService.addMessage(
        user.organizationId,
        user.id,
        conversationId,
        {
          role: 'assistant',
          content: response.content,
          metadata: {
            model: response.model,
            tokensUsed: response.tokensUsed,
            cost: response.cost,
          },
        },
      );

      return NextResponse.json({
        success: true,
        data: {
          conversation: finalConversation,
          usage: {
            tokensUsed: response.tokensUsed,
            cost: response.cost,
            model: response.model,
          },
        },
      });
    } catch (error) {
      console.error('Error generating character response:', error);

      // If AI generation fails, still return the conversation with user message
      return NextResponse.json(
        {
          success: false,
          data: {
            conversation: updatedConversation,
          },
          error: 'Failed to generate AI response',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 },
    );
  }
}

/**
 * Generate character response using user's API credits
 */
async function generateCharacterResponse(
  character: any,
  messages: any[],
  organizationId: string,
): Promise<{
  content: string;
  model: string;
  tokensUsed: number;
  cost: number;
}> {
  // Use static methods from CreditService

  // Check organization has sufficient credits
  const CreditService = await getCreditService();
  const hasCredits = await CreditService.checkSufficientCredits(
    organizationId,
    0.01,
  ); // Minimum check
  if (!hasCredits) {
    throw new Error('Insufficient credits for AI inference');
  }

  // Build system prompt from character configuration
  const systemPrompt = buildCharacterSystemPrompt(character);

  // Prepare conversation history for AI model
  const conversationMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-10).map((msg) => ({
      // Keep last 10 messages for context
      role: msg.role,
      content: msg.content,
    })),
  ];

  try {
    // Use OpenAI-compatible API (this would be configured per organization)
    const response = await fetch(
      `${process.env.OPENAI_API_BASE_URL || 'https://api.openai.com'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use cost-effective model for characters
          messages: conversationMessages,
          max_tokens: 500, // Limit response length for characters
          temperature: 0.8, // Slightly higher for personality
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `AI API error: ${response.status} ${response.statusText}`,
      );
    }

    const aiResponse = await response.json();

    if (!aiResponse.choices?.[0]?.message?.content) {
      throw new Error('Invalid AI response format');
    }

    const content = aiResponse.choices[0].message.content;
    const tokensUsed = aiResponse.usage?.total_tokens || 0;

    // Calculate cost (approximate pricing for gpt-4o-mini)
    const inputTokens = aiResponse.usage?.prompt_tokens || 0;
    const outputTokens = aiResponse.usage?.completion_tokens || 0;
    const cost =
      (inputTokens * 0.00015) / 1000 + (outputTokens * 0.0006) / 1000; // Per 1K tokens pricing

    // Deduct credits from organization
    await CreditService.deductCreditsForUsage(organizationId, 'system', {
      service: 'openai',
      operation: 'character_inference',
      modelName: 'gpt-4o-mini',
      inputTokens,
      outputTokens,
      agentId: character.id,
    });

    return {
      content,
      model: 'gpt-4o-mini',
      tokensUsed,
      cost,
    };
  } catch (error) {
    console.error('AI inference error:', error);
    throw new Error('Failed to generate AI response');
  }
}

/**
 * Build system prompt from character configuration
 */
function buildCharacterSystemPrompt(character: any): string {
  const config = character.characterConfig;

  let prompt = `You are ${config.name}. ${config.bio}`;

  if (config.personality) {
    prompt += `\n\nPersonality: ${config.personality}`;
  }

  if (config.style) {
    prompt += `\n\nCommunication Style: ${config.style}`;
  }

  if (config.knowledge && config.knowledge.length > 0) {
    prompt += `\n\nKnowledge: ${config.knowledge.join(', ')}`;
  }

  if (config.system) {
    prompt += `\n\nAdditional Instructions: ${config.system}`;
  }

  // Add example interactions if available
  if (config.messageExamples && config.messageExamples.length > 0) {
    prompt += '\n\nExample interactions:';
    config.messageExamples.slice(0, 3).forEach((example: any, i: number) => {
      if (example.length >= 2) {
        prompt += `\n\nExample ${i + 1}:`;
        prompt += `\nUser: ${example[0].user}`;
        prompt += `\nAssistant: ${example[0].assistant}`;
      }
    });
  }

  prompt +=
    '\n\nRespond as this character would, staying true to their personality and style. Keep responses concise and engaging.';

  return prompt;
}

export const { POST } = wrapHandlers({ handlePOST });
