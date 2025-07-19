import { logger } from '@elizaos/core';
import { sql } from 'drizzle-orm';

/**
 * Create todo tables in the database
 */
export async function createTodoTables(db: any): Promise<void> {
  try {
    logger.info('Creating todo plugin tables...');

    // Use PostgreSQL syntax (PGLite support removed)
    await createPostgreSQLTables(db);

    logger.info('Todo plugin tables created successfully');
  } catch (error) {
    logger.error('Failed to create todo plugin tables:', error);
    throw error;
  }
}

async function createPostgreSQLTables(db: any): Promise<void> {
  // Create todos table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS todos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL,
      world_id UUID NOT NULL,
      room_id UUID NOT NULL,
      entity_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      priority INTEGER DEFAULT 4,
      is_urgent BOOLEAN DEFAULT false,
      is_completed BOOLEAN DEFAULT false,
      due_date TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      metadata JSONB DEFAULT '{}' NOT NULL
    )
  `);

  // Create todo_tags table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS todo_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  // Create indexes
  await createIndexes(db);
}

async function createIndexes(db: any): Promise<void> {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_todos_agent ON todos(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_todos_world ON todos(world_id)',
    'CREATE INDEX IF NOT EXISTS idx_todos_room ON todos(room_id)',
    'CREATE INDEX IF NOT EXISTS idx_todos_entity ON todos(entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_todos_type ON todos(type)',
    'CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(is_completed)',
    'CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date)',
    'CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_todo_tags_todo ON todo_tags(todo_id)',
    'CREATE INDEX IF NOT EXISTS idx_todo_tags_tag ON todo_tags(tag)',
    'CREATE UNIQUE INDEX IF NOT EXISTS unique_todo_tag ON todo_tags(todo_id, tag)',
  ];

  for (const indexSQL of indexes) {
    try {
      await db.execute(sql.raw(indexSQL));
    } catch (indexError) {
      logger.debug(`Index might already exist: ${indexError}`);
    }
  }
}
