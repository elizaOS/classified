import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession, authOptions } from '@/lib/auth/auth-config';
import { GitHubService } from '@/lib/services/github-service';
import { getSql } from '@/lib/database';

async function handleGET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    // Verify user authorization
    if (userId && userId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user's GitHub token
    const userGitHubToken = await getUserGitHubToken(userId || session.user.id);
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
      const repositories = await githubService.getUserRepositories();

      return NextResponse.json(repositories);
    } catch (githubError) {
      console.error('GitHub API error:', githubError);
      return NextResponse.json(
        {
          error:
            'Failed to fetch GitHub repositories. Please check your GitHub token.',
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Failed to get GitHub repositories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, private: isPrivate, projectId } = body;

    if (!name || !description) {
      return NextResponse.json(
        {
          error: 'Repository name and description are required',
        },
        { status: 400 },
      );
    }

    // Get project if specified
    let project = null;
    let buildResult = null;

    if (projectId) {
      const sqlAdapter = getSql();
      const sql = sqlAdapter.getSqlClient();
      const projectQuery = await sql`
        SELECT * FROM autocoder_projects 
        WHERE id = ${projectId} AND user_id = ${session.user.id} AND status = 'completed'
      `;

      if (projectQuery.length === 0) {
        return NextResponse.json(
          {
            error: 'Project not found or not completed',
          },
          { status: 404 },
        );
      }

      project = projectQuery[0];
      buildResult = project.build_result
        ? JSON.parse(project.build_result)
        : null;
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
      const repoData = {
        name,
        description,
        private: isPrivate || false,
        files: buildResult?.files || {
          'README.md': `# ${name}\n\n${description}\n\nGenerated with ElizaOS Autocoder.`,
        },
        packageJson: buildResult?.packageJson || {
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          version: '1.0.0',
          description,
          main: 'index.js',
          scripts: {
            test: 'echo "Error: no test specified" && exit 1',
          },
          keywords: ['elizaos', 'plugin'],
          author: session.user.email,
          license: 'MIT',
        },
      };

      const repository = await githubService.createRepository(repoData);

      // Update project with GitHub URL if this was for a specific project
      if (project) {
        const updateSqlAdapter = getSql();
        const updateSql = updateSqlAdapter.getSqlClient();
        await updateSql`
          UPDATE autocoder_projects 
          SET build_result = jsonb_set(
            COALESCE(build_result, '{}'),
            '{githubUrl}',
            ${JSON.stringify(repository.html_url)}
          ),
          updated_at = NOW()
          WHERE id = ${projectId}
        `;
      }

      return NextResponse.json(repository, { status: 201 });
    } catch (githubError) {
      console.error('GitHub repository creation failed:', githubError);
      return NextResponse.json(
        {
          error: `Failed to create GitHub repository: ${githubError instanceof Error ? githubError.message : 'Unknown error'}`,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Failed to create GitHub repository:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function getUserGitHubToken(userId: string): Promise<string | null> {
  try {
    // This would typically query your user accounts/tokens table
    // For now, we'll use environment variable or user settings

    // Check if user has GitHub token stored
    const sqlAdapter = getSql();
    const sql = sqlAdapter.getSqlClient();
    const tokenQuery = await sql`
      SELECT github_token FROM user_integrations 
      WHERE user_id = ${userId} AND provider = 'github' AND github_token IS NOT NULL
    `;

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

// Export the route handlers

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
