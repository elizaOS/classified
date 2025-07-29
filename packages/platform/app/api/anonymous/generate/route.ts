import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { chatService } from '@/lib/services/chat-service';
import { anonymousSessionRepo } from '@/lib/database/repositories/anonymous-session';

interface GenerationRequest {
  type: 'n8n_workflow' | 'mcp' | 'agent_config';
  requirements: Record<string, any>;
  userContext: Record<string, any>;
  sessionId: string;
}

interface GeneratedAsset {
  type: 'n8n_workflow' | 'mcp' | 'agent_config';
  name: string;
  description: string;
  data: any;
  preview?: string;
  downloadUrl?: string;
}

async function handlePOST(request: NextRequest) {
  try {
    const body: GenerationRequest = await request.json();
    const { type, requirements, userContext, sessionId } = body;

    if (!type || !sessionId) {
      return NextResponse.json(
        { error: 'Type and session ID are required' },
        { status: 400 },
      );
    }

    // Create a streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        generateAssetWithProgress(
          type,
          requirements,
          { ...userContext, sessionId },
          controller,
          encoder,
        );
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Generation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function generateAssetWithProgress(
  type: string,
  requirements: Record<string, any>,
  userContext: Record<string, any>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  try {
    // Send progress updates
    const sendProgress = (progress: number, message?: string) => {
      const data = JSON.stringify({ type: 'progress', progress, message });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    };

    sendProgress(10, 'Analyzing requirements...');

    // Build description from requirements for AI generation
    const description = buildDescriptionFromRequirements(
      type,
      requirements,
      userContext,
    );

    sendProgress(30, 'Generating solution with AI...');

    // Use real AI generation instead of fake delays
    const asset = await chatService.generateAsset({
      type: type as 'n8n_workflow' | 'mcp' | 'agent_config',
      description,
      requirements,
      userContext,
    });

    sendProgress(80, 'Finalizing asset...');

    // Save generated content to session if sessionId provided
    if (userContext.sessionId) {
      await anonymousSessionRepo.addGeneratedContent(userContext.sessionId, {
        type: asset.type,
        name: asset.name,
        description: asset.description,
        data: asset.data,
        preview: asset.preview,
        downloadUrl: asset.downloadUrl,
        createdAt: new Date(),
      });
    }

    sendProgress(100, 'Generation complete!');

    // Send final result
    const completeData = JSON.stringify({ type: 'complete', asset });
    controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));

    controller.close();
  } catch (error) {
    console.error('Generation error:', error);
    const errorData = JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Generation failed',
    });
    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
    controller.close();
  }
}

/**
 * Helper function to build description from requirements for AI generation
 */
function buildDescriptionFromRequirements(
  type: string,
  requirements: Record<string, any>,
  userContext: Record<string, any>,
): string {
  let description = `A ${type.replace('_', ' ')} that`;

  // Add requirements to description
  const reqKeys = Object.keys(requirements);
  if (reqKeys.length > 0) {
    const reqStrings = reqKeys.map((key) => `${key}: ${requirements[key]}`);
    description += ` handles ${reqStrings.join(', ')}`;
  }

  // Add user context
  if (userContext.businessDomain) {
    description += ` for ${userContext.businessDomain} domain`;
  }

  if (userContext.useCase) {
    description += ` to ${userContext.useCase}`;
  }

  return description;
}

export const { POST } = wrapHandlers({ handlePOST });
