import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getSql } from '@/lib/database';
import { authService } from '@/lib/auth/session';
import { createGitHubService } from '@/lib/services/github-service';

interface CreateBranchRequest {
  projectId: string;
  owner: string;
  repo: string;
  branchName: string;
  fromBranch?: string;
}

interface PushFilesRequest {
  projectId: string;
  owner: string;
  repo: string;
  branch: string;
  files: Record<string, string>;
  commitMessage: string;
  createPR?: boolean;
  prTitle?: string;
  prDescription?: string;
}

// Create branch or push files
async function handlePOST(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'create') {
    return handleCreateBranch(body, user);
  } else if (action === 'push') {
    return handlePushFiles(body, user);
  } else {
    return NextResponse.json(
      { error: 'Invalid action. Use ?action=create or ?action=push' },
      { status: 400 },
    );
  }
}

// Create a new branch
async function handleCreateBranch(body: CreateBranchRequest, user: any) {
  if (!body.projectId || !body.owner || !body.repo || !body.branchName) {
    return NextResponse.json(
      { error: 'Project ID, owner, repo, and branch name are required' },
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

    // Create the branch
    const branchRef = await githubService.createFeatureBranch(
      body.owner,
      body.repo,
      body.branchName,
      body.fromBranch,
    );

    // Log branch creation
    await sql.query(
      `INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [
        `msg-${Date.now()}`,
        body.projectId,
        user.id,
        'agent',
        `🌿 Branch created successfully!\n\n**Branch:** \`${body.branchName}\`\n**From:** \`${body.fromBranch || 'main'}\`\n\nYou can now make changes to this branch and create a pull request when ready.`,
        JSON.stringify({
          type: 'github_branch_created',
          branch: body.branchName,
          fromBranch: body.fromBranch || 'main',
          ref: branchRef,
          agentAction: true,
        }),
      ],
    );

    return NextResponse.json({
      success: true,
      branch: {
        name: body.branchName,
        ref: branchRef,
        fromBranch: body.fromBranch || 'main',
      },
    });
  } catch (error) {
    console.error('Failed to create branch:', error);

    // Log error message for user
    try {
      const sql = getSql();
      await sql.query(
        `INSERT INTO autocoder_messages (
          id, project_id, user_id, type, message, timestamp, metadata
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          `msg-${Date.now()}`,
          body.projectId,
          user.id,
          'agent',
          `❌ Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          JSON.stringify({
            type: 'github_branch_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        ],
      );
    } catch (msgError) {
      console.error('Failed to log error message:', msgError);
    }

    return NextResponse.json(
      {
        error: 'Failed to create branch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Push files to a branch
async function handlePushFiles(body: PushFilesRequest, user: any) {
  if (
    !body.projectId ||
    !body.owner ||
    !body.repo ||
    !body.branch ||
    !body.files ||
    !body.commitMessage
  ) {
    return NextResponse.json(
      {
        error:
          'Project ID, owner, repo, branch, files, and commit message are required',
      },
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

    // Push files to the branch
    const result = await githubService.pushFiles({
      owner: body.owner,
      repo: body.repo,
      branch: body.branch,
      files: body.files,
      commitMessage: body.commitMessage,
      createPR: body.createPR,
      prTitle: body.prTitle,
      prDescription: body.prDescription,
    });

    const fileCount = Object.keys(body.files).length;
    let message = `📝 Pushed ${fileCount} file${fileCount > 1 ? 's' : ''} to branch \`${body.branch}\`\n\n**Commit:** ${body.commitMessage}`;

    if (result.prNumber) {
      message += `\n\n🔀 **Pull Request #${result.prNumber} created!**\nTitle: ${body.prTitle || `Update from ${body.branch}`}`;
    }

    // Log file push
    await sql.query(
      `INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [
        `msg-${Date.now()}`,
        body.projectId,
        user.id,
        'agent',
        message,
        JSON.stringify({
          type: 'github_files_pushed',
          branch: body.branch,
          commitSha: result.commitSha,
          prNumber: result.prNumber,
          fileCount,
          agentAction: true,
        }),
      ],
    );

    return NextResponse.json({
      success: true,
      commit: {
        sha: result.commitSha,
        branch: body.branch,
        message: body.commitMessage,
        filesCount: fileCount,
      },
      pullRequest: result.prNumber
        ? {
            number: result.prNumber,
            title: body.prTitle || `Update from ${body.branch}`,
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to push files:', error);

    // Log error message for user
    try {
      const sql = getSql();
      await sql.query(
        `INSERT INTO autocoder_messages (
          id, project_id, user_id, type, message, timestamp, metadata
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          `msg-${Date.now()}`,
          body.projectId,
          user.id,
          'agent',
          `❌ Failed to push files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          JSON.stringify({
            type: 'github_push_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        ],
      );
    } catch (msgError) {
      console.error('Failed to log error message:', msgError);
    }

    return NextResponse.json(
      {
        error: 'Failed to push files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({
  handlePOST,
});
