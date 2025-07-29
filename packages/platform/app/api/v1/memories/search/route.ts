import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database';
import { memories, agents } from '@/lib/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const searchMemoriesSchema = z.object({
  agentId: z.string().uuid(),
  query: z.string().min(1),
  embedding: z.string(), // JSON string representation of query vector
  matchThreshold: z.coerce.number().min(0).max(1).default(0.7),
  limit: z.coerce.number().min(1).max(50).default(10),
});

// POST /api/v1/memories/search - Search memories with vector similarity
async function handlePOST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const data = searchMemoriesSchema.parse(body);

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

    // Perform vector similarity search with triple isolation
    // Note: This is a simplified example. In production, you'd use a proper vector database
    // or PostgreSQL with vector extensions like pgvector
    const results = await db
      .select({
        id: memories.id,
        content: memories.content,
        type: memories.type,
        importance: memories.importance,
        roomId: memories.roomId,
        entityId: memories.entityId,
        embedding: memories.embedding,
        similarity: sql<number>`
          1 - (
            ${memories.embedding}::vector <-> ${data.embedding}::vector
          )
        `.as('similarity'),
        createdAt: memories.createdAt,
      })
      .from(memories)
      .where(
        and(
          eq(memories.organizationId, session.organizationId), // Organization isolation
          eq(memories.agentId, data.agentId), // Agent isolation
          eq(memories.userId, session.userId), // User isolation
          sql`${memories.embedding} IS NOT NULL`,
        ),
      )
      .orderBy(desc(sql`similarity`))
      .having(sql`similarity >= ${data.matchThreshold}`)
      .limit(data.limit);

    return NextResponse.json({
      success: true,
      data: {
        memories: results,
        query: data.query,
        matchThreshold: data.matchThreshold,
        agentId: data.agentId,
        userId: session.userId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid search parameters',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error('Failed to search memories:', error);
    return NextResponse.json(
      {
        error: 'Failed to search memories',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
