import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession, authOptions } from '@/lib/auth/auth-config';
import { getDatabase, getSql } from '@/lib/database';
import { GitHubService } from '@/lib/services/github-service';
import { NPMService } from '@/lib/services/npm-service';
import { randomUUID } from 'crypto';

interface PublishPluginRequest {
  projectId: string;
  userId: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  isPublic: boolean;
  createGitHubRepo?: boolean;
  npmPublish?: boolean;
  build: any;
}

async function handleGET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100,
    );
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const sortBy = searchParams.get('sortBy') || 'updated_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';
    const publicOnly = searchParams.get('publicOnly') !== 'false';

    // Build search query
    let whereClause = publicOnly ? 'WHERE is_public = true' : 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (query) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${query}%`);
      paramIndex++;
    }

    if (tags.length > 0) {
      whereClause += ` AND tags && $${paramIndex}::text[]`;
      queryParams.push(tags);
      paramIndex++;
    }

    // Validate sort column
    const allowedSortColumns = [
      'name',
      'updated_at',
      'published_at',
      'downloads',
      'rating',
    ];
    const sortColumn = allowedSortColumns.includes(sortBy)
      ? sortBy
      : 'updated_at';

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM autocoder_registry 
      ${whereClause}
    `;

    const searchQuery = `
      SELECT 
        r.*,
        p.name as project_name,
        p.type as project_type
      FROM autocoder_registry r
      LEFT JOIN autocoder_projects p ON r.project_id = p.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const db = await getDatabase();

    const [countResult, searchResult] = await Promise.all([
      db.query(countQuery, queryParams.slice(0, -2)),
      db.query(searchQuery, queryParams),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);
    const plugins = searchResult.map((plugin: any) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      version: plugin.version,
      tags: plugin.tags,
      isPublic: plugin.is_public,
      githubUrl: plugin.github_url,
      npmUrl: plugin.npm_url,
      downloads: plugin.downloads,
      rating: parseFloat(plugin.rating),
      publishedAt: plugin.published_at,
      updatedAt: plugin.updated_at,
      projectType: plugin.project_type,
      author: plugin.user_id, // TODO: Join with users table for actual author info
    }));

    return NextResponse.json({
      plugins,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to search plugins:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PublishPluginRequest = await request.json();

    // Validate request
    if (!body.projectId || !body.name || !body.description || !body.version) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: projectId, name, description, version',
        },
        { status: 400 },
      );
    }

    const db = await getDatabase();

    // Verify project ownership
    const sql = getSql();
    const project = await sql.query(
      `
      SELECT * FROM autocoder_projects 
      WHERE id = $1 AND user_id = $2 AND status = 'completed'
    `,
      [body.projectId, session.user.id],
    );

    if (project.length === 0) {
      return NextResponse.json(
        {
          error: 'Project not found or not completed',
        },
        { status: 404 },
      );
    }

    // Check if plugin name is already taken
    const existingPlugin = await sql.query(
      `
      SELECT id FROM autocoder_registry 
      WHERE name = $1 AND user_id != $2
    `,
      [body.name, session.user.id],
    );

    if (existingPlugin.length > 0) {
      return NextResponse.json(
        {
          error: 'Plugin name already exists',
        },
        { status: 409 },
      );
    }

    const registryId = randomUUID();
    let githubUrl = null;
    let npmUrl = null;

    try {
      // Create GitHub repository if requested
      if (body.createGitHubRepo) {
        const githubService = new GitHubService();
        const repoResult = await githubService.createRepository({
          name: body.name,
          description: body.description,
          private: !body.isPublic,
          files: body.build.files,
          packageJson: body.build.packageJson,
        });
        githubUrl = repoResult.html_url;
      }

      // Publish to NPM if requested
      if (body.npmPublish) {
        const npmService = new NPMService();
        const npmResult = await npmService.publishPackage({
          name: body.name,
          version: body.version,
          files: body.build.files,
          packageJson: body.build.packageJson,
        });
        npmUrl = npmResult.packageUrl;
      }

      // Insert into registry
      const result = await sql.query(
        `
        INSERT INTO autocoder_registry (
          id, project_id, user_id, name, description, version, tags, 
          is_public, github_url, npm_url, published_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `,
        [
          registryId,
          body.projectId,
          session.user.id,
          body.name,
          body.description,
          body.version,
          body.tags,
          body.isPublic,
          githubUrl,
          npmUrl,
        ],
      );

      const publishedPlugin = result[0];

      // Log the publication event
      console.log(
        `Plugin ${body.name} v${body.version} published by user ${session.user.id}`,
      );

      return NextResponse.json(
        {
          id: publishedPlugin.id,
          name: publishedPlugin.name,
          description: publishedPlugin.description,
          version: publishedPlugin.version,
          tags: publishedPlugin.tags,
          isPublic: publishedPlugin.is_public,
          githubUrl: publishedPlugin.github_url,
          npmUrl: publishedPlugin.npm_url,
          downloads: publishedPlugin.downloads,
          rating: parseFloat(publishedPlugin.rating),
          publishedAt: publishedPlugin.published_at,
          updatedAt: publishedPlugin.updated_at,
        },
        { status: 201 },
      );
    } catch (integrationError) {
      console.error('Integration error during publishing:', integrationError);

      // Still create registry entry even if external integrations fail
      const sql = getSql();
      const result = await sql.query(
        `
        INSERT INTO autocoder_registry (
          id, project_id, user_id, name, description, version, tags, 
          is_public, published_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `,
        [
          registryId,
          body.projectId,
          session.user.id,
          body.name,
          body.description,
          body.version,
          body.tags,
          body.isPublic,
        ],
      );

      const publishedPlugin = result[0];

      return NextResponse.json(
        {
          id: publishedPlugin.id,
          name: publishedPlugin.name,
          description: publishedPlugin.description,
          version: publishedPlugin.version,
          tags: publishedPlugin.tags,
          isPublic: publishedPlugin.is_public,
          githubUrl: null,
          npmUrl: null,
          downloads: publishedPlugin.downloads,
          rating: parseFloat(publishedPlugin.rating),
          publishedAt: publishedPlugin.published_at,
          updatedAt: publishedPlugin.updated_at,
          warning: 'Plugin published but external integrations failed',
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error('Failed to publish plugin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
