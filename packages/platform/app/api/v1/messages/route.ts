import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database';
import { messages, conversations, agents } from '@/lib/database/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

const getMessagesSchema = z.object({
  conversationId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const createMessageSchema = z.object({
  conversationId: z.string().uuid(),
  agentId: z.string().uuid(),
  content: z.object({
    text: z.string().optional(),
    thought: z.string().optional(),
    actions: z.array(z.string()).optional(),
    providers: z.array(z.string()).optional(),
    attachments: z
      .array(
        z.object({
          type: z.string(),
          url: z.string(),
          name: z.string().optional(),
          size: z.number().optional(),
        }),
      )
      .optional(),
  }),
  role: z.enum(['user', 'agent', 'system']),
  parentMessageId: z.string().uuid().optional(),
});

// GET /api/v1/messages - Get user's messages with proper scoping
async function handleGET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = getMessagesSchema.parse({
      conversationId: searchParams.get('conversationId'),
      agentId: searchParams.get('agentId'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      order: searchParams.get('order'),
    });

    const db = await getDatabase();

    // Build query with proper user isolation
    let query = db
      .select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        parentMessageId: messages.parentMessageId,
        tokenCount: messages.tokenCount,
        cost: messages.cost,
        processingTime: messages.processingTime,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        conversationId: messages.conversationId,
        agentId: messages.agentId,
      })
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, session.organizationId),
          eq(messages.userId, session.userId), // User isolation
        ),
      );

    // Add optional filters
    if (params.conversationId) {
      query = query.where(
        and(
          eq(messages.organizationId, session.organizationId),
          eq(messages.userId, session.userId),
          eq(messages.conversationId, params.conversationId),
        ),
      );
    }

    if (params.agentId) {
      query = query.where(
        and(
          eq(messages.organizationId, session.organizationId),
          eq(messages.userId, session.userId),
          eq(messages.agentId, params.agentId),
        ),
      );
    }

    // Apply ordering and pagination
    query = query
      .orderBy(
        params.order === 'asc'
          ? asc(messages.createdAt)
          : desc(messages.createdAt),
      )
      .limit(params.limit)
      .offset(params.offset);

    const results = await query;

    return NextResponse.json({
      success: true,
      data: {
        messages: results,
        pagination: {
          limit: params.limit,
          offset: params.offset,
          hasMore: results.length === params.limit,
        },
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

    console.error('Failed to fetch messages:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch messages',
      },
      { status: 500 },
    );
  }
}

// POST /api/v1/messages - Create a new message with proper scoping
async function handlePOST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const data = createMessageSchema.parse(body);

    const db = await getDatabase();

    // Verify conversation belongs to user
    const conversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, data.conversationId),
          eq(conversations.organizationId, session.organizationId),
          eq(conversations.userId, session.userId), // User isolation
        ),
      )
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        {
          error: 'Conversation not found or access denied',
        },
        { status: 404 },
      );
    }

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

    // Create the message with proper isolation
    const [newMessage] = await db
      .insert(messages)
      .values({
        organizationId: session.organizationId,
        conversationId: data.conversationId,
        agentId: data.agentId,
        userId: session.userId, // User isolation
        content: data.content,
        role: data.role,
        parentMessageId: data.parentMessageId,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: { message: newMessage },
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

    console.error('Failed to create message:', error);
    return NextResponse.json(
      {
        error: 'Failed to create message',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
