/**
 * WebSocket API Route
 * 
 * Provides WebSocket connection information and management endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import { webSocketIntegration } from '@/lib/websocket';

// Get WebSocket connection information
async function handleGET(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get WebSocket server status and statistics
    const stats = webSocketIntegration.getClientStats();
    const isInitialized = webSocketIntegration.isInitialized();

    return NextResponse.json({
      success: true,
      websocket: {
        initialized: isInitialized,
        serverUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
        status: stats.status,
        clientCount: stats.totalClients,
        projectClients: stats.projectClients,
      },
      user: {
        id: user.id,
        canConnect: true,
      },
    });
  } catch (error) {
    console.error('Failed to get WebSocket info:', error);
    return NextResponse.json(
      { error: 'Failed to get WebSocket information' },
      { status: 500 },
    );
  }
}

// WebSocket management operations
async function handlePOST(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    action: 'broadcast' | 'notify' | 'status';
    projectId?: string;
    message?: string;
    type?: 'analysis' | 'build' | 'completion';
    data?: any;
  };

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 },
    );
  }

  try {
    switch (body.action) {
      case 'broadcast':
        if (!body.projectId || !body.message) {
          return NextResponse.json(
            { error: 'projectId and message are required for broadcast' },
            { status: 400 },
          );
        }

        // Send project update broadcast
        webSocketIntegration.sendProjectUpdate(
          body.projectId,
          'manual',
          body.message,
          body.data,
        );

        return NextResponse.json({
          success: true,
          message: 'Broadcast sent successfully',
        });

      case 'notify':
        if (!body.projectId || !body.message || !body.type) {
          return NextResponse.json(
            { error: 'projectId, message, and type are required for notification' },
            { status: 400 },
          );
        }

        // Send typed notification
        const { notifyProjectUpdate } = await import('@/lib/websocket');
        notifyProjectUpdate(body.projectId, body.type, body.message, body.data);

        return NextResponse.json({
          success: true,
          message: 'Notification sent successfully',
        });

      case 'status':
        // Get current WebSocket status
        const stats = webSocketIntegration.getClientStats();
        
        return NextResponse.json({
          success: true,
          status: stats,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: broadcast, notify, status' },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('WebSocket operation failed:', error);
    return NextResponse.json(
      { error: 'WebSocket operation failed' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({
  handleGET,
  handlePOST,
});