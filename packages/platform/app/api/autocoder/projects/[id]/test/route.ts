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

    // Verify project ownership
    const sqlAdapter = getSql();
    const sql = sqlAdapter.getSqlClient();
    const project = await sql`
      SELECT * FROM autocoder_projects 
      WHERE id = ${projectId} AND user_id = ${session.user.id}
    `;

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const currentProject = project[0];

    // Check if project has a build result
    if (!currentProject.build_result) {
      return NextResponse.json(
        {
          error: 'Project must be built before testing',
        },
        { status: 400 },
      );
    }

    const buildResult = JSON.parse(currentProject.build_result);
    const containerService = E2BContainerService.getInstance();

    try {
      // Create a new container session for testing
      const sessionId = await containerService.createSession(
        projectId,
        session.user.id,
      );

      // Execute the build and tests in the container
      const testResult = await containerService.executeCodeBuild(sessionId, {
        projectId,
        userId: session.user.id,
        files: buildResult.files,
        packageJson: buildResult.packageJson,
        buildCommands: ['npm run build'],
        testCommands: ['npm test'],
      });

      // Clean up the session
      await containerService.terminateSession(sessionId);

      // Update project with test results
      const updatedBuildResult = {
        ...buildResult,
        lastTestResults: testResult.testResults,
        lastTestTimestamp: new Date().toISOString(),
      };

      const updateSqlAdapter = getSql();
      const updateSql = updateSqlAdapter.getSqlClient();
      await updateSql`
        UPDATE autocoder_projects 
        SET build_result = ${JSON.stringify(updatedBuildResult)}, updated_at = NOW()
        WHERE id = ${projectId}
      `;

      return NextResponse.json({
        success: testResult.success,
        tests: testResult.testResults?.details || [],
        summary: {
          total: testResult.testResults?.total || 0,
          passed: testResult.testResults?.passed || 0,
          failed: testResult.testResults?.failed || 0,
          coverage: testResult.testResults?.coverage || 0,
        },
        logs: testResult.buildLogs,
        error: testResult.error,
      });
    } catch (error) {
      console.error('Container testing failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          error: `Testing failed: ${errorMessage}`,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Failed to run tests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
