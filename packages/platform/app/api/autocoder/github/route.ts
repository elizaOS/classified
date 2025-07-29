import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getSql } from '@/lib/database';
import { authService } from '@/lib/auth/session';
import {
  GitHubService,
  createGitHubService,
} from '@/lib/services/github-service';

interface CreateRepositoryRequest {
  projectId: string;
  name: string;
  description: string;
  category: string;
  specification: any;
  githubToken?: string;
  generateRepository?: boolean;
}

interface DeployRepositoryRequest {
  projectId: string;
  owner: string;
  repo: string;
  branch?: string;
  environment?: 'development' | 'staging' | 'production';
}

interface SearchRepositoriesRequest {
  query: string;
  page?: number;
  perPage?: number;
}

// Create repository for autocoder project
async function handlePOST(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: CreateRepositoryRequest = await request.json();

  if (!body.projectId || !body.name || !body.description || !body.category) {
    return NextResponse.json(
      { error: 'Project ID, name, description, and category are required' },
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

    const project = projects[0];

    // Get user's GitHub token from their profile or use provided token
    let githubToken = body.githubToken;
    if (!githubToken) {
      // Try to get from user profile/settings
      const userSettings = await sql.query(
        'SELECT github_token FROM user_settings WHERE user_id = $1',
        [user.id],
      );

      if (userSettings.length > 0 && userSettings[0].github_token) {
        githubToken = userSettings[0].github_token;
      } else {
        return NextResponse.json(
          {
            error:
              'GitHub token is required. Please provide a token or configure it in your settings.',
          },
          { status: 400 },
        );
      }
    }

    // Create GitHub service with user's token
    const githubService = createGitHubService(githubToken);

    // Create autocoder repository
    const repository = await githubService.createAutocoderRepository({
      projectId: body.projectId,
      name: body.name,
      description: body.description,
      category: body.category,
      specification:
        body.specification || JSON.parse(project.specification || '{}'),
      userId: user.id,
      generateRepository: body.generateRepository ?? true,
    });

    // Update project with GitHub repository information
    await sql.query(
      `UPDATE autocoder_projects 
       SET github_repository = $1, status = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(repository), 'repository_created', body.projectId],
    );

    // Log the repository creation
    await sql.query(
      `INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [
        `msg-${Date.now()}`,
        body.projectId,
        user.id,
        'agent',
        `🚀 Repository created successfully!\n\n**Repository:** [${repository.full_name}](${repository.html_url})\n\n**Clone URL:** \`${repository.clone_url}\`\n\nYour project is now live on GitHub with all the generated code, tests, and CI/CD workflows. You can start collaborating and deploying immediately!`,
        JSON.stringify({
          type: 'github_repository_created',
          repository,
          agentAction: true,
        }),
      ],
    );

    return NextResponse.json({
      success: true,
      repository,
    });
  } catch (error) {
    console.error('Failed to create GitHub repository:', error);

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
          `❌ Failed to create GitHub repository: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your GitHub token and try again.`,
          JSON.stringify({
            type: 'github_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        ],
      );
    } catch (msgError) {
      console.error('Failed to log error message:', msgError);
    }

    return NextResponse.json(
      {
        error: 'Failed to create GitHub repository',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Get repository information
async function handleGET(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const action = searchParams.get('action');

  if (action === 'search') {
    return handleSearchRepositories(request, user);
  }

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
    const githubRepository = project.github_repository
      ? JSON.parse(project.github_repository)
      : null;

    if (!githubRepository) {
      return NextResponse.json(
        { error: 'No GitHub repository associated with this project' },
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

    // Get repository stats
    const [owner, repo] = githubRepository.full_name.split('/');
    const stats = await githubService.getRepositoryStats(owner, repo);

    return NextResponse.json({
      success: true,
      repository: githubRepository,
      stats,
    });
  } catch (error) {
    console.error('Failed to get repository information:', error);
    return NextResponse.json(
      { error: 'Failed to get repository information' },
      { status: 500 },
    );
  }
}

// Search repositories
async function handleSearchRepositories(request: NextRequest, user: any) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '30');

  try {
    // Get user's GitHub token
    const sql = getSql();
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
    const results = await githubService.searchAutocoderRepositories(
      query,
      page,
      perPage,
    );

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Failed to search repositories:', error);
    return NextResponse.json(
      { error: 'Failed to search repositories' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({
  handleGET,
  handlePOST,
});
