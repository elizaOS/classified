import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession, authOptions } from '@/lib/auth/auth-config';
import { getSql } from '@/lib/database';
import { randomUUID } from 'crypto';

interface CreateProjectRequest {
  userId: string;
  name: string;
  description: string;
  type: 'mcp' | 'plugin' | 'service';
}

async function handleGET(request: NextRequest) {
  try {
    // For development and testing, provide mock data when database is not available
    if (process.env.NODE_ENV === 'development') {
      try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('userId') || session.user.id;

        // Verify user can access these projects
        if (userId !== session.user.id && !session.user.isAdmin) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const sql = getSql().getSqlClient();

        const projects = await sql`
          SELECT 
            id,
            name,
            description,
            type,
            status,
            specification,
            created_at,
            updated_at,
            build_result
          FROM autocoder_projects 
          WHERE user_id = ${userId}
          ORDER BY updated_at DESC
        `;

        const formattedProjects = projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          status: project.status,
          specification: project.specification
            ? JSON.parse(project.specification)
            : null,
          result: project.build_result
            ? JSON.parse(project.build_result)
            : null,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        }));

        return NextResponse.json({
          success: true,
          data: { projects: formattedProjects },
        });
      } catch (dbError) {
        console.warn('Database not available, using mock data:', dbError);

        // Return mock projects for testing
        const mockProjects = [
          {
            id: 'project-1',
            name: 'Test Plugin',
            description: 'A sample plugin project',
            type: 'plugin',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'project-2',
            name: 'Weather App',
            description: 'Weather application project',
            type: 'app',
            status: 'building',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ];

        return NextResponse.json({
          success: true,
          data: { projects: mockProjects },
        });
      }
    }

    // Production logic
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || session.user.id;

    // Verify user can access these projects
    if (userId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sql = getSql().getSqlClient();

    const projects = await sql`
      SELECT 
        id,
        name,
        description,
        type,
        status,
        specification,
        created_at,
        updated_at,
        build_result
      FROM autocoder_projects 
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;

    const formattedProjects = projects.map((project: any) => ({
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
    }));

    return NextResponse.json({
      success: true,
      data: { projects: formattedProjects },
    });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    // For development, provide mock project creation
    if (process.env.NODE_ENV === 'development') {
      try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: CreateProjectRequest = await request.json();

        // Validate request
        if (!body.name || !body.description || !body.type) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 },
          );
        }

        // Verify user authorization
        if (body.userId !== session.user.id && !session.user.isAdmin) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Generate unique project ID
        const projectId = randomUUID();

        const sql = getSql().getSqlClient();

        // Create project in database
        const result = await sql`
          INSERT INTO autocoder_projects (
            id, user_id, name, description, type, status, created_at, updated_at
          ) VALUES (${projectId}, ${body.userId}, ${body.name}, ${body.description}, ${body.type}, 'planning', NOW(), NOW())
          RETURNING *
        `;

        const project = {
          id: result[0].id,
          name: result[0].name,
          description: result[0].description,
          type: result[0].type,
          status: result[0].status,
          specification: null,
          result: null,
          createdAt: result[0].created_at,
          updatedAt: result[0].updated_at,
        };

        // Initialize agent conversation for this project
        await initializeAgentConversation(projectId, body.userId);

        return NextResponse.json(
          {
            success: true,
            data: project,
          },
          { status: 201 },
        );
      } catch (dbError) {
        console.warn(
          'Database not available, using mock data for POST:',
          dbError,
        );

        const body: CreateProjectRequest = await request.json();

        // Return mock project creation response
        const mockProject = {
          id: 'new-project-123',
          name: body.name || 'New Project',
          description: body.description || 'Newly created project',
          type: body.type || 'plugin',
          status: 'initializing',
        };

        return NextResponse.json(
          {
            success: true,
            data: mockProject,
          },
          { status: 201 },
        );
      }
    }

    // Production logic
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateProjectRequest = await request.json();

    // Validate request
    if (!body.name || !body.description || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Verify user authorization
    if (body.userId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate unique project ID
    const projectId = randomUUID();

    const sql = getSql().getSqlClient();

    // Create project in database
    const result = await sql`
      INSERT INTO autocoder_projects (
        id, user_id, name, description, type, status, created_at, updated_at
      ) VALUES (${projectId}, ${body.userId}, ${body.name}, ${body.description}, ${body.type}, 'planning', NOW(), NOW())
      RETURNING *
    `;

    const project = {
      id: result[0].id,
      name: result[0].name,
      description: result[0].description,
      type: result[0].type,
      status: result[0].status,
      specification: null,
      result: null,
      createdAt: result[0].created_at,
      updatedAt: result[0].updated_at,
    };

    // Initialize agent conversation for this project
    await initializeAgentConversation(projectId, body.userId);

    return NextResponse.json(
      {
        success: true,
        data: project,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

async function initializeAgentConversation(projectId: string, userId: string) {
  try {
    // Create initial system message for the agent
    const systemMessage = {
      id: randomUUID(),
      projectId,
      userId,
      type: 'system',
      message: `Welcome! I'm your Autocoder AI assistant. I'm here to help you research, plan, and build your project step by step. 

Let's start by discussing what you want to create. I can help you:
- Research existing solutions and best practices
- Define detailed specifications and requirements  
- Plan the implementation approach
- Generate high-quality code with tests
- Integrate with external APIs and services

What would you like to build?`,
      timestamp: new Date(),
      metadata: {
        step: 'initialization',
        capabilities: [
          'research',
          'planning',
          'code_generation',
          'testing',
          'documentation',
        ],
      },
    };

    // Store in database
    const sql = getSql().getSqlClient();
    await sql`
      INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp, metadata
      ) VALUES (${systemMessage.id}, ${systemMessage.projectId}, ${systemMessage.userId}, ${systemMessage.type}, ${systemMessage.message}, ${systemMessage.timestamp}, ${JSON.stringify(systemMessage.metadata)})
    `;

    console.log(`Initialized agent conversation for project ${projectId}`);
  } catch (error) {
    console.error('Failed to initialize agent conversation:', error);
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
