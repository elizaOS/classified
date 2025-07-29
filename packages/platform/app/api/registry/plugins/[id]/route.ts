import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession, authOptions } from '@/lib/auth/auth-config';
import { getSql } from '@/lib/database';

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const pluginId = resolvedParams.id;

    const sql = getSql();
    const result = await sql.query(
      `
      SELECT 
        r.*,
        p.name as project_name,
        p.type as project_type,
        p.build_result
      FROM autocoder_registry r
      LEFT JOIN autocoder_projects p ON r.project_id = p.id
      WHERE r.id = $1
    `,
      [pluginId],
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const plugin = result[0];

    // Increment download count
    await sql.query(
      `
      UPDATE autocoder_registry 
      SET downloads = downloads + 1 
      WHERE id = $1
    `,
      [pluginId],
    );

    // Parse build result to get files and documentation
    const buildResult = plugin.build_result
      ? JSON.parse(plugin.build_result)
      : null;

    return NextResponse.json({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      version: plugin.version,
      tags: plugin.tags,
      isPublic: plugin.is_public,
      githubUrl: plugin.github_url,
      npmUrl: plugin.npm_url,
      downloads: plugin.downloads + 1, // Include the increment
      rating: parseFloat(plugin.rating),
      publishedAt: plugin.published_at,
      updatedAt: plugin.updated_at,
      projectType: plugin.project_type,
      author: plugin.user_id,
      files: buildResult?.files || {},
      documentation: buildResult?.documentation || {},
      packageJson: buildResult?.packageJson || {},
      quality: buildResult?.quality || {},
    });
  } catch (error) {
    console.error('Failed to get plugin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const pluginId = resolvedParams.id;
    const body = await request.json();

    // Verify ownership
    const sql = getSql();
    const existing = await sql.query(
      `
      SELECT * FROM autocoder_registry 
      WHERE id = $1 AND user_id = $2
    `,
      [pluginId, session.user.id],
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (body.description) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(body.description);
      paramIndex++;
    }

    if (body.tags && Array.isArray(body.tags)) {
      updateFields.push(`tags = $${paramIndex}`);
      updateValues.push(body.tags);
      paramIndex++;
    }

    if (typeof body.isPublic === 'boolean') {
      updateFields.push(`is_public = $${paramIndex}`);
      updateValues.push(body.isPublic);
      paramIndex++;
    }

    if (body.githubUrl) {
      updateFields.push(`github_url = $${paramIndex}`);
      updateValues.push(body.githubUrl);
      paramIndex++;
    }

    if (body.npmUrl) {
      updateFields.push(`npm_url = $${paramIndex}`);
      updateValues.push(body.npmUrl);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      );
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(pluginId);

    const query = `
      UPDATE autocoder_registry 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, updateValues);
    const updatedPlugin = result[0];

    return NextResponse.json({
      id: updatedPlugin.id,
      name: updatedPlugin.name,
      description: updatedPlugin.description,
      version: updatedPlugin.version,
      tags: updatedPlugin.tags,
      isPublic: updatedPlugin.is_public,
      githubUrl: updatedPlugin.github_url,
      npmUrl: updatedPlugin.npm_url,
      downloads: updatedPlugin.downloads,
      rating: parseFloat(updatedPlugin.rating),
      publishedAt: updatedPlugin.published_at,
      updatedAt: updatedPlugin.updated_at,
    });
  } catch (error) {
    console.error('Failed to update plugin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const pluginId = resolvedParams.id;

    // Verify ownership or admin access
    const sql = getSql();
    const existing = await sql.query(
      `
      SELECT * FROM autocoder_registry 
      WHERE id = $1 AND (user_id = $2 OR $3 = true)
    `,
      [pluginId, session.user.id, session.user.isAdmin || false],
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Delete the plugin from registry
    await sql.query(
      `
      DELETE FROM autocoder_registry WHERE id = $1
    `,
      [pluginId],
    );

    console.log(
      `Plugin ${pluginId} deleted from registry by user ${session.user.id}`,
    );

    return NextResponse.json({ message: 'Plugin deleted successfully' });
  } catch (error) {
    console.error('Failed to delete plugin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
