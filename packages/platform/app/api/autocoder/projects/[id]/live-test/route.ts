import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession } from '@/lib/auth/config';
import { authOptions } from '@/lib/auth/config';
import { getSql } from '@/lib/database';
import { E2BContainerService } from '@/lib/autocoder/e2b-container-service';

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = resolvedParams.id;
    const body = await request.json();
    const { action, sessionId, command } = body;

    // Verify project ownership
    const adapter = getSql();
    const sql = adapter.getSqlClient();
    const project = await sql`
      SELECT * FROM autocoder_projects 
      WHERE id = ${projectId} AND user_id = ${session.user.id}
    `;

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const currentProject = project[0];
    const containerService = E2BContainerService.getInstance();

    switch (action) {
      case 'create':
        try {
          // Check if project has build result
          if (!currentProject.build_result) {
            return NextResponse.json(
              {
                error: 'Project must be built before live testing',
              },
              { status: 400 },
            );
          }

          const buildResult = JSON.parse(currentProject.build_result);

          // Create live testing session
          const newSessionId = await containerService.createLiveTestingSession(
            projectId,
            buildResult.files,
          );

          return NextResponse.json({
            success: true,
            sessionId: newSessionId,
            message: 'Live testing session created successfully',
          });
        } catch (error) {
          console.error('Failed to create live testing session:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json(
            {
              error: `Failed to create live testing session: ${errorMessage}`,
            },
            { status: 500 },
          );
        }

      case 'execute':
        try {
          if (!sessionId || !command) {
            return NextResponse.json(
              {
                error: 'Session ID and command are required',
              },
              { status: 400 },
            );
          }

          const result = await containerService.executeLiveCommand(
            sessionId,
            command,
          );

          return NextResponse.json({
            success: result.success,
            output: result.output,
            error: result.error,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to execute live command:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json(
            {
              error: `Failed to execute command: ${errorMessage}`,
            },
            { status: 500 },
          );
        }

      case 'status':
        try {
          if (!sessionId) {
            return NextResponse.json(
              {
                error: 'Session ID is required',
              },
              { status: 400 },
            );
          }

          const status = await containerService.getSessionStatus(sessionId);

          if (!status) {
            return NextResponse.json(
              {
                error: 'Session not found',
              },
              { status: 404 },
            );
          }

          return NextResponse.json({
            success: true,
            status,
          });
        } catch (error) {
          console.error('Failed to get session status:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json(
            {
              error: `Failed to get session status: ${errorMessage}`,
            },
            { status: 500 },
          );
        }

      case 'terminate':
        try {
          if (!sessionId) {
            return NextResponse.json(
              {
                error: 'Session ID is required',
              },
              { status: 400 },
            );
          }

          await containerService.terminateSession(sessionId);

          return NextResponse.json({
            success: true,
            message: 'Session terminated successfully',
          });
        } catch (error) {
          console.error('Failed to terminate session:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json(
            {
              error: `Failed to terminate session: ${errorMessage}`,
            },
            { status: 500 },
          );
        }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action. Use: create, execute, status, or terminate',
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Live testing API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
