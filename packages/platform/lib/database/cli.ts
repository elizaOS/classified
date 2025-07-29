#!/usr/bin/env tsx
/**
 * Database CLI tool for managing migrations and setup
 * Supports both SQLite (local) and PostgreSQL (cloud)
 */

import {
  initializeDatabase,
  runMigrations,
  resetDatabase,
  seedDatabase,
  closeDatabase,
  getDatabaseAdapterInstance,
} from './server';

async function main() {
  const command = process.argv[2];
  const engine = process.argv.includes('--pglite')
    ? 'pglite'
    : process.argv.includes('--postgres')
      ? 'postgresql'
      : 'auto';

  console.log(`🔧 Database CLI - Engine: ${engine}`);

  try {
    switch (command) {
      case 'migrate':
        console.log('🔄 Running database migrations...');
        await initializeDatabase({ engine });
        await runMigrations();
        console.log('✅ Migrations completed');
        break;

      case 'reset':
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ Reset is not allowed in production');
          process.exit(1);
        }
        console.log('🔄 Resetting database...');
        await initializeDatabase({ engine });
        await resetDatabase();
        console.log('✅ Database reset completed');
        break;

      case 'seed':
        console.log('🌱 Seeding database...');
        await initializeDatabase({ engine });
        await seedDatabase();
        console.log('✅ Database seeding completed');
        break;

      case 'status':
        console.log('📊 Checking database status...');
        const adapter = await initializeDatabase({ engine });
        const health = await adapter.healthCheck();
        console.log(`Engine: ${adapter.engine}`);
        console.log(`Cloud: ${adapter.isCloud ? 'Yes' : 'No'}`);
        console.log(`Healthy: ${health.isHealthy ? 'Yes' : 'No'}`);
        if (health.latency) {
          console.log(`Latency: ${health.latency}ms`);
        }
        if (health.error) {
          console.log(`Error: ${health.error}`);
        }
        break;

      case 'dev-setup':
        console.log('🛠️  Setting up development database...');
        await initializeDatabase({ engine: 'pglite' });
        await runMigrations();
        await seedDatabase();
        console.log('✅ Development setup completed');
        break;

      case 'generate':
        console.log('📝 Generating migrations...');
        const currentAdapter = await initializeDatabase({ engine });
        if (currentAdapter.engine === 'pglite') {
          console.log(
            'Use: bun drizzle-kit generate --config=drizzle.config.pglite.ts',
          );
        } else {
          console.log(
            'Use: bun drizzle-kit generate --config=drizzle.config.ts',
          );
        }
        break;

      case 'studio':
        console.log('🎨 Starting Drizzle Studio...');
        const studioAdapter = await initializeDatabase({ engine });
        if (studioAdapter.engine === 'pglite') {
          console.log(
            'Use: bun drizzle-kit studio --config=drizzle.config.pglite.ts',
          );
        } else {
          console.log('Use: bun drizzle-kit studio --config=drizzle.config.ts');
        }
        break;

      default:
        console.log(`
Database CLI Usage:
  bun run db:cli <command> [--pglite|--postgres]

Commands:
  migrate     Run database migrations
  reset       Reset database (development only)
  seed        Seed database with sample data
  status      Check database connection status
  dev-setup   Setup development database (SQLite + migrations + seed)
  generate    Show command to generate new migrations
  studio      Show command to start Drizzle Studio

Flags:
  --pglite    Force SQLite usage
  --postgres  Force PostgreSQL usage
  (default: auto-detect based on environment)

Examples:
  bun run db:cli migrate
  bun run db:cli dev-setup --pglite
  bun run db:cli status --postgres
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
