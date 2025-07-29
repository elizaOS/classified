import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession } from '@/lib/auth/config';
import { authOptions } from '@/lib/auth/config';
import { getSql } from '@/lib/database';

interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: string;
  specification?: any;
}

async function handleGET(
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
    const sql = getSql().getSqlClient();

    const result = await sql`
      SELECT 
        p.*,
        array_agg(
          CASE WHEN m.id IS NOT NULL THEN
            json_build_object(
              'id', m.id,
              'type', m.type,
              'message', m.message,
              'timestamp', m.timestamp,
              'metadata', m.metadata
            )
          END
        ) FILTER (WHERE m.id IS NOT NULL) as messages
      FROM autocoder_projects p
      LEFT JOIN autocoder_messages m ON p.id = m.project_id
      WHERE p.id = ${projectId} AND p.user_id = ${session.user.id}
      GROUP BY p.id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = result[0];
    const formattedProject = {
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type,
      status: project.status,
      specification: project.specification
        ? JSON.parse(project.specification)
        : null,
      result: project.build_result ? JSON.parse(project.build_result) : null,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      messages: project.messages || [],
    };

    return NextResponse.json(formattedProject);
  } catch (error) {
    console.error('Failed to fetch project:', error);
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
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = resolvedParams.id;
    const body: UpdateProjectRequest = await request.json();
    const sql = getSql().getSqlClient();

    // Verify project ownership
    const existingProject = await sql`
      SELECT id FROM autocoder_projects 
      WHERE id = ${projectId} AND user_id = ${session.user.id}
    `;

    if (existingProject.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (body.name) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(body.name);
      paramIndex++;
    }

    if (body.description) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(body.description);
      paramIndex++;
    }

    if (body.status) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(body.status);
      paramIndex++;
    }

    if (body.specification) {
      updateFields.push(`specification = $${paramIndex}`);
      updateValues.push(JSON.stringify(body.specification));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      );
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(projectId);

    const query = `
      UPDATE autocoder_projects 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.unsafe(query, updateValues);
    const updatedProject = result[0];

    const formattedProject = {
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      type: updatedProject.type,
      status: updatedProject.status,
      specification: updatedProject.specification
        ? JSON.parse(updatedProject.specification)
        : null,
      result: updatedProject.build_result
        ? JSON.parse(updatedProject.build_result)
        : null,
      createdAt: updatedProject.created_at,
      updatedAt: updatedProject.updated_at,
    };

    return NextResponse.json(formattedProject);
  } catch (error) {
    console.error('Failed to update project:', error);
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
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = resolvedParams.id;

    // Verify project ownership
    const sql = getSql().getSqlClient();
    const existingProject = await sql`
      SELECT id FROM autocoder_projects 
      WHERE id = ${projectId} AND user_id = ${session.user.id}
    `;

    if (existingProject.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete related messages first
    await sql`
      DELETE FROM autocoder_messages WHERE project_id = ${projectId}
    `;

    // Delete build logs
    await sql`
      DELETE FROM autocoder_build_logs WHERE project_id = ${projectId}
    `;

    // Delete the project
    await sql`
      DELETE FROM autocoder_projects WHERE id = ${projectId}
    `;

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
