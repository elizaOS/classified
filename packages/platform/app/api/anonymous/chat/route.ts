import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { anonymousSessionRepo } from '@/lib/database/repositories/anonymous-session';
import { chatService } from '@/lib/services/chat-service';
import type { ChatMessage } from '@/lib/database/repositories/anonymous-session';

interface ChatRequest {
  sessionId: string;
  message: string;
  context: {
    currentStep: string;
    userContext: Record<string, any>;
    chatHistory: any[];
  };
}

interface ChatResponse {
  content: string;
  suggestions?: string[];
  workflowStep?: string;
  generatedAsset?: any;
  nextStep?: string;
}

async function handlePOST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { sessionId, message, context } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Session ID and message are required' },
        { status: 400 },
      );
    }

    // Get session data for context
    const session = await anonymousSessionRepo.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Build chat context
    const chatContext = {
      currentStep: context.currentStep || session.workflowProgress.currentStep,
      userContext: {
        ...context.userContext,
        workflowType: session.workflowProgress.workflowType,
        requirements: session.workflowProgress.requirements,
      },
      chatHistory: session.chatHistory.slice(-10), // Last 10 messages for context
      sessionId,
    };

    // Generate real AI response
    const response = await chatService.generateChatResponse(
      message,
      chatContext,
    );

    // Update session workflow progress if needed
    if (response.workflowStep) {
      const updatedProgress = {
        ...session.workflowProgress,
        currentStep: response.nextStep || session.workflowProgress.currentStep,
      };

      // Extract workflow type from user context if mentioned
      if (
        message.toLowerCase().includes('n8n') ||
        message.toLowerCase().includes('workflow')
      ) {
        updatedProgress.workflowType = 'n8n_workflow';
      } else if (
        message.toLowerCase().includes('mcp') ||
        message.toLowerCase().includes('server')
      ) {
        updatedProgress.workflowType = 'mcp';
      } else if (message.toLowerCase().includes('agent')) {
        updatedProgress.workflowType = 'agent_config';
      }

      await anonymousSessionRepo.updateSession(sessionId, {
        workflowProgress: updatedProgress,
      });
    }

    // Save message to session for persistence
    await saveMessageToSession(sessionId, message, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function saveMessageToSession(
  sessionId: string,
  userMessage: string,
  response: ChatResponse,
) {
  try {
    // Save user message
    const userChatMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      metadata: {},
    };

    await anonymousSessionRepo.addMessage(sessionId, userChatMessage);

    // Save assistant response
    const assistantChatMessage: ChatMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        suggestions: response.suggestions,
        workflowStep: response.workflowStep,
        nextStep: response.nextStep,
        generatedAsset: response.generatedAsset,
      },
    };

    await anonymousSessionRepo.addMessage(sessionId, assistantChatMessage);

    console.log(`Session ${sessionId}: Messages saved to database`);
  } catch (error) {
    console.error('Failed to save message to session:', error);
    // Don't throw - the conversation can continue even if persistence fails
  }
}

export const { POST } = wrapHandlers({ handlePOST });
