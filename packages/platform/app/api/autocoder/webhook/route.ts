import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/autocoder/webhook
 *
 * Webhook endpoint for receiving updates from the main ElizaOS agent.
 * This allows the agent to send real-time project updates, messages, and status changes
 * back to the platform WebSocket server for broadcasting to connected clients.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from the main ElizaOS agent
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.ELIZA_AGENT_TOKEN}`;

    if (!authHeader || authHeader !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid agent token' },
        { status: 401 },
      );
    }

    const { type, projectId, data, message, metadata, timestamp } =
      await request.json();

    if (!type || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: type and projectId' },
        { status: 400 },
      );
    }

    // Get the WebSocket server instance to broadcast updates
    // Note: This would need to be properly imported/accessed in a real implementation
    // For now, we'll use a global registry or event system

    // Simulate broadcasting to WebSocket clients
    // In a real implementation, you'd access the WebSocket server instance
    await broadcastToWebSocketClients(type, {
      projectId,
      message,
      data,
      metadata,
      timestamp: timestamp || new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      type,
      projectId,
      message: 'Webhook received and broadcasted successfully',
    });
  } catch (error) {
    console.error('Error processing agent webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Helper function to broadcast webhook data to WebSocket clients
 * In a real implementation, this would interface with the WebSocket server
 */
async function broadcastToWebSocketClients(
  type: string,
  payload: {
    projectId: string;
    message?: string;
    data?: any;
    metadata?: any;
    timestamp: string;
  },
): Promise<void> {
  try {
    // This is where you'd interface with your WebSocket server
    // For example, using a global event emitter or direct reference

    const { projectId, message, data, metadata, timestamp } = payload;

    switch (type) {
      case 'agent_message':
        // Broadcast agent message to project subscribers
        console.log(
          `Broadcasting agent message for project ${projectId}:`,
          message,
        );
        // wsServer.broadcastToProject(projectId, {
        //   type: 'AGENT_MESSAGE',
        //   projectId,
        //   message,
        //   timestamp,
        //   data: { metadata }
        // });
        break;

      case 'project_update':
        // Broadcast project status update
        console.log(
          `Broadcasting project update for project ${projectId}:`,
          data,
        );
        // wsServer.broadcastToProject(projectId, {
        //   type: 'PROJECT_UPDATE',
        //   projectId,
        //   data: { updates: data },
        //   timestamp
        // });
        break;

      case 'swarm_scaled':
        // Broadcast swarm scaling information
        console.log(
          `Broadcasting swarm scaling for project ${projectId}:`,
          data,
        );
        // wsServer.broadcastToProject(projectId, {
        //   type: 'SWARM_SCALED',
        //   projectId,
        //   data,
        //   timestamp
        // });
        break;

      case 'build_log':
        // Broadcast build log entries
        console.log(`Broadcasting build log for project ${projectId}:`, data);
        // wsServer.broadcastToProject(projectId, {
        //   type: 'BUILD_LOG',
        //   projectId,
        //   data: { log: data },
        //   timestamp
        // });
        break;

      case 'error':
        // Broadcast error messages
        console.log(`Broadcasting error for project ${projectId}:`, message);
        // wsServer.broadcastToProject(projectId, {
        //   type: 'ERROR',
        //   projectId,
        //   data: { message, metadata },
        //   timestamp
        // });
        break;

      default:
        console.log(`Unknown webhook type: ${type}`);
    }
  } catch (error) {
    console.error('Error broadcasting to WebSocket clients:', error);
  }
}

/**
 * GET /api/autocoder/webhook
 *
 * Health check endpoint for the webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'autocoder-agent-webhook',
    timestamp: new Date().toISOString(),
    message: 'Webhook endpoint is ready to receive agent updates',
  });
}
