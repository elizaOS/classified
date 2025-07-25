import { pgTable, text, primaryKey, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { channelTable } from './channel';

export const channelParticipantsTable = pgTable(
  'channel_participants',
  {
    channelId: text('channel_id')
      .notNull()
      .references(() => channelTable.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(), // Fixed property name to match database column
    joinedAt: timestamp('joined_at', { mode: 'date' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    role: text('role'),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.channelId, table.userId] }),
  })
); 