import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { messageServerTable } from './messageServer';

export const serverAgentsTable = pgTable(
  'server_agents',
  {
    serverId: uuid('server_id')
      .notNull()
      .references(() => messageServerTable.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull(),
    // Foreign key will be added via raw SQL in migration since agent table is in plugin-sql
  },
  (table) => ({
    pk: primaryKey({ columns: [table.serverId, table.agentId] }),
  })
); 