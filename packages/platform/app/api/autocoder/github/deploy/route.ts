import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getSql } from '@/lib/database';
import { authService } from '@/lib/auth/session';
import { createGitHubService } from '@/lib/services/github-service';

interface DeployRepositoryRequest {
  projectId: string;
  owner: string;
  repo: string;
  branch?: string;
  environment?: 'development' | 'staging' | 'production';
  metadata?: Record<string, any>;
}

// Deploy repository
async function handlePOST(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: DeployRepositoryRequest = await request.json();

  if (!body.projectId || !body.owner || !body.repo) {
    return NextResponse.json(
      { error: 'Project ID, owner, and repo are required' },
      { status: 400 },
    );
  }

  const sql = getSql();

  try {
    // Verify user owns the project
    const projects = await sql.query(
      'SELECT * FROM autocoder_projects WHERE id = $1 AND user_id = $2',
      [body.projectId, user.id],
    );

    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 },
      );
    }

    // Get user's GitHub token
    const userSettings = await sql.query(
      'SELECT github_token FROM user_settings WHERE user_id = $1',
      [user.id],
    );

    if (userSettings.length === 0 || !userSettings[0].github_token) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 400 },
      );
    }

    const githubService = createGitHubService(userSettings[0].github_token);

    // Deploy the repository
    const deployment = await githubService.deployRepository({
      owner: body.owner,
      repo: body.repo,
      branch: body.branch || 'main',
      environment: body.environment || 'production',
      metadata: body.metadata || {},
    });

    // Update project status
    await sql.query(
      'UPDATE autocoder_projects SET status = $1, updated_at = NOW() WHERE id = $2',
      ['deployed', body.projectId],
    );

    // Log deployment success
    await sql.query(
      `INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [
        `msg-${Date.now()}`,
        body.projectId,
        user.id,
        'agent',
        `🚀 Deployment successful!\n\n**Environment:** ${deployment.environment}\n**URL:** [${deployment.url}](${deployment.url})\n**Status:** ${deployment.state}\n\nYour project is now live and accessible to users!`,
        JSON.stringify({
          type: 'github_deployment',
          deployment,
          agentAction: true,
        }),
      ],
    );

    return NextResponse.json({
      success: true,
      deployment,
    });
  } catch (error) {
    console.error('Failed to deploy repository:', error);

    // Log error message for user
    try {
      await sql.query(
        `INSERT INTO autocoder_messages (
          id, project_id, user_id, type, message, timestamp, metadata
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          `msg-${Date.now()}`,
          body.projectId,
          user.id,
          'agent',
          `❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your repository configuration and try again.`,
          JSON.stringify({
            type: 'github_deployment_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        ],
      );
    } catch (msgError) {
      console.error('Failed to log error message:', msgError);
    }

    return NextResponse.json(
      {
        error: 'Failed to deploy repository',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Get deployment status
async function handleGET(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 },
    );
  }

  const sql = getSql();

  try {
    // Verify user owns the project
    const projects = await sql.query(
      'SELECT * FROM autocoder_projects WHERE id = $1 AND user_id = $2',
      [projectId, user.id],
    );

    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 },
      );
    }

    const project = projects[0];

    // Get deployment messages from project history
    const deploymentMessages = await sql.query(
      `SELECT * FROM autocoder_messages 
       WHERE project_id = $1 AND metadata->>'type' IN ('github_deployment', 'github_deployment_error')
       ORDER BY timestamp DESC`,
      [projectId],
    );

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        status: project.status,
        github_repository: project.github_repository
          ? JSON.parse(project.github_repository)
          : null,
      },
      deployments: deploymentMessages.map((msg: any) => ({
        id: msg.id,
        type: msg.metadata?.type,
        message: msg.message,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
      })),
    });
  } catch (error) {
    console.error('Failed to get deployment status:', error);
    return NextResponse.json(
      { error: 'Failed to get deployment status' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({
  handleGET,
  handlePOST,
});
