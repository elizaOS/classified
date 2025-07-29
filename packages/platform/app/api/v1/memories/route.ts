import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database';
import { memories, agents } from '@/lib/database/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';

const getMemoriesSchema = z.object({
  agentId: z.string().uuid(),
  type: z.enum(['conversation', 'fact', 'preference', 'skill']).optional(),
  roomId: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  order: z.enum(['asc', 'desc']).default('desc'),
  minImportance: z.coerce.number().min(1).max(10).optional(),
});

const createMemorySchema = z.object({
  agentId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  content: z.object({
    text: z.string().optional(),
    thought: z.string().optional(),
    actions: z.array(z.string()).optional(),
    providers: z.array(z.string()).optional(),
    source: z.string().optional(),
    inReplyTo: z.string().optional(),
    attachments: z.array(z.any()).optional(),
  }),
  type: z
    .enum(['conversation', 'fact', 'preference', 'skill'])
    .default('conversation'),
  importance: z.number().min(1).max(10).default(5),
  isUnique: z.boolean().default(false),
  roomId: z.string().optional(),
  worldId: z.string().optional(),
  entityId: z.string().optional(),
  embedding: z.string().optional(), // JSON string representation of vector
});

// searchMemoriesSchema moved to /api/v1/memories/search/route.ts

// GET /api/v1/memories - Get agent memories with user isolation
async function handleGET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = getMemoriesSchema.parse({
      agentId: searchParams.get('agentId'),
      type: searchParams.get('type'),
      roomId: searchParams.get('roomId'),
      entityId: searchParams.get('entityId'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      order: searchParams.get('order'),
      minImportance: searchParams.get('minImportance'),
    });

    const db = await getDatabase();

    // Verify agent belongs to user's organization
    const agent = await db
      .select({ id: agents.id, createdByUserId: agents.createdByUserId })
      .from(agents)
      .where(
        and(
          eq(agents.id, params.agentId),
          eq(agents.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    if (agent.length === 0) {
      return NextResponse.json(
        {
          error: 'Agent not found or access denied',
        },
        { status: 404 },
      );
    }

    // Build query with triple isolation: organization + agent + user
    let query = db
      .select({
        id: memories.id,
        content: memories.content,
        type: memories.type,
        importance: memories.importance,
        isUnique: memories.isUnique,
        roomId: memories.roomId,
        worldId: memories.worldId,
        entityId: memories.entityId,
        similarity: memories.similarity,
        createdAt: memories.createdAt,
        updatedAt: memories.updatedAt,
      })
      .from(memories)
      .where(
        and(
          eq(memories.organizationId, session.organizationId), // Organization isolation
          eq(memories.agentId, params.agentId), // Agent isolation
          eq(memories.userId, session.userId), // User isolation
        ),
      );

    // Add optional filters
    const conditions = [
      eq(memories.organizationId, session.organizationId),
      eq(memories.agentId, params.agentId),
      eq(memories.userId, session.userId),
    ];

    if (params.type) {
      conditions.push(eq(memories.type, params.type));
    }

    if (params.roomId) {
      conditions.push(eq(memories.roomId, params.roomId));
    }

    if (params.entityId) {
      conditions.push(eq(memories.entityId, params.entityId));
    }

    if (params.minImportance) {
      conditions.push(sql`${memories.importance} >= ${params.minImportance}`);
    }

    query = query.where(and(...conditions));

    // Apply ordering and pagination
    query = query
      .orderBy(
        params.order === 'asc'
          ? asc(memories.createdAt)
          : desc(memories.createdAt),
      )
      .limit(params.limit)
      .offset(params.offset);

    const results = await query;

    return NextResponse.json({
      success: true,
      data: {
        memories: results,
        pagination: {
          limit: params.limit,
          offset: params.offset,
          hasMore: results.length === params.limit,
        },
        agentId: params.agentId,
        userId: session.userId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error('Failed to fetch memories:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch memories',
      },
      { status: 500 },
    );
  }
}

// POST /api/v1/memories - Create a new memory with proper scoping
async function handlePOST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const data = createMemorySchema.parse(body);

    const db = await getDatabase();

    // Verify agent belongs to user's organization
    const agent = await db
      .select({ id: agents.id })
      .from(agents)
      .where(
        and(
          eq(agents.id, data.agentId),
          eq(agents.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    if (agent.length === 0) {
      return NextResponse.json(
        {
          error: 'Agent not found or access denied',
        },
        { status: 404 },
      );
    }

    // Create the memory with triple isolation
    const [newMemory] = await db
      .insert(memories)
      .values({
        organizationId: session.organizationId, // Organization isolation
        agentId: data.agentId, // Agent isolation
        userId: session.userId, // User isolation
        conversationId: data.conversationId,
        content: data.content,
        type: data.type,
        importance: data.importance,
        isUnique: data.isUnique,
        roomId: data.roomId,
        worldId: data.worldId,
        entityId: data.entityId,
        embedding: data.embedding,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: { memory: newMemory },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error('Failed to create memory:', error);
    return NextResponse.json(
      {
        error: 'Failed to create memory',
      },
      { status: 500 },
    );
  }
}

// Search functionality moved to /api/v1/memories/search/route.ts

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
