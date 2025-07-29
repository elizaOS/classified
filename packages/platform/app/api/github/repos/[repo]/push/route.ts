import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession, authOptions } from '@/lib/auth/auth-config';
import { GitHubService } from '@/lib/services/github-service';
import { getSql } from '@/lib/database';

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ repo: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repoFullName = decodeURIComponent(resolvedParams.repo);
    const body = await request.json();
    const { projectId, commitMessage, branch = 'main' } = body;

    if (!projectId) {
      return NextResponse.json(
        {
          error: 'Project ID is required',
        },
        { status: 400 },
      );
    }

    // Get project and verify ownership
    const sql = getSql();
    const project = await sql.query(
      `
      SELECT * FROM autocoder_projects 
      WHERE id = $1 AND user_id = $2 AND status = 'completed'
    `,
      [projectId, session.user.id],
    );

    if (project.length === 0) {
      return NextResponse.json(
        {
          error: 'Project not found or not completed',
        },
        { status: 404 },
      );
    }

    const currentProject = project[0];
    const buildResult = currentProject.build_result
      ? JSON.parse(currentProject.build_result)
      : null;

    if (!buildResult || !buildResult.files) {
      return NextResponse.json(
        {
          error: 'Project has no build files to push',
        },
        { status: 400 },
      );
    }

    // Get user's GitHub token
    const userGitHubToken = await getUserGitHubToken(session.user.id);
    if (!userGitHubToken) {
      return NextResponse.json(
        {
          error: 'GitHub token not found. Please connect your GitHub account.',
        },
        { status: 400 },
      );
    }

    const githubService = new GitHubService(userGitHubToken);

    try {
      // Parse owner/repo from full name
      const [owner, repo] = repoFullName.split('/');
      if (!owner || !repo) {
        return NextResponse.json(
          {
            error: 'Invalid repository format. Use owner/repo',
          },
          { status: 400 },
        );
      }

      // Validate repository access
      const hasAccess = await githubService.validateRepository(owner, repo);
      if (!hasAccess) {
        return NextResponse.json(
          {
            error: 'Repository not found or access denied',
          },
          { status: 404 },
        );
      }

      // Prepare files for push
      const filesToPush = {
        ...buildResult.files,
        'package.json': JSON.stringify(buildResult.packageJson, null, 2),
      };

      // Add README if not exists
      if (!filesToPush['README.md'] && buildResult.documentation?.readme) {
        filesToPush['README.md'] = buildResult.documentation.readme;
      }

      // Push files to repository
      await githubService.pushFiles({
        owner,
        repo,
        files: filesToPush,
        commitMessage:
          commitMessage ||
          `Update ${currentProject.name} v${buildResult.packageJson?.version || '1.0.0'}`,
        branch,
      });

      // Update project with GitHub URL
      const repoUrl = `https://github.com/${owner}/${repo}`;
      await sql.query(
        `
        UPDATE autocoder_projects 
        SET build_result = jsonb_set(
          COALESCE(build_result, '{}'),
          '{githubUrl}',
          $1
        ),
        updated_at = NOW()
        WHERE id = $2
      `,
        [JSON.stringify(repoUrl), projectId],
      );

      return NextResponse.json({
        success: true,
        message: 'Files pushed to GitHub successfully',
        repositoryUrl: repoUrl,
        branch,
        filesCount: Object.keys(filesToPush).length,
      });
    } catch (githubError) {
      console.error('GitHub push failed:', githubError);
      const errorMessage =
        githubError instanceof Error ? githubError.message : 'Unknown error';
      return NextResponse.json(
        {
          error: `Failed to push to GitHub: ${errorMessage}`,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Failed to push to GitHub repository:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function getUserGitHubToken(userId: string): Promise<string | null> {
  try {
    // Check if user has GitHub token stored
    const sql = getSql();
    const tokenQuery = await sql.query(
      `
      SELECT github_token FROM user_integrations 
      WHERE user_id = $1 AND provider = 'github' AND github_token IS NOT NULL
    `,
      [userId],
    );

    if (tokenQuery.length > 0) {
      return tokenQuery[0].github_token;
    }

    // Fallback to environment variable (for development)
    return process.env.GITHUB_TOKEN || null;
  } catch (error) {
    console.error('Failed to get GitHub token:', error);
    return null;
  }
}

export const { POST } = wrapHandlers({ handlePOST });
