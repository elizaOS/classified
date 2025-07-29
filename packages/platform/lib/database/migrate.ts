/**
 * Database migration utilities
 */

import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase, getSql } from './';
import * as schema from './schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Apply a single migration file
 */
export async function applyMigration(migrationPath: string): Promise<void> {
  try {
    const sqlAdapter = getSql();
    const sql = sqlAdapter.getSqlClient();
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log(`📦 Applying migration: ${migrationPath}`);

    // Execute the migration
    await sql.unsafe(migrationSQL);

    console.log(`✅ Migration applied successfully: ${migrationPath}`);
  } catch (error) {
    console.error(`❌ Failed to apply migration ${migrationPath}:`, error);
    throw error;
  }
}

/**
 * Apply all pending migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Apply migrations in order

    console.log(`🔄 Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      const migrationPath = join(migrationsDir, file);
      await applyMigration(migrationPath);
    }

    // Apply RLS policies
    console.log('🔐 Applying Row Level Security policies...');
    const rlsPath = join(__dirname, 'rls-policies.sql');
    await applyMigration(rlsPath);

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Reset database (DROP and recreate all tables)
 * WARNING: This will delete all data!
 */
export async function resetDatabase(): Promise<void> {
  console.log('⚠️  WARNING: This will delete all data in the database!');

  try {
    const sqlAdapter = getSql();
    const sql = sqlAdapter.getSqlClient();

    // Drop all tables in cascade mode
    console.log('🗑️  Dropping all tables...');
    await sql.unsafe(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);

    console.log('🔄 Running migrations on clean database...');
    await runMigrations();

    console.log('✅ Database reset complete!');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

/**
 * Check if database is properly migrated
 */
export async function checkMigrationStatus(): Promise<{
  isReady: boolean;
  missingTables: string[];
  error?: string;
}> {
  try {
    const sqlAdapter = getSql();
    const sql = sqlAdapter.getSqlClient();

    // Check for essential tables
    const requiredTables = [
      'organizations',
      'users',
      'user_sessions',
      'api_keys',
      'agents',
      'plugins',
      'organization_plugins',
      'uploads',
      'credit_transactions',
      'audit_logs',
      'webhooks',
    ];

    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;

    const existingTables = result.map(
      (row: { table_name: string }) => row.table_name,
    );
    const missingTables = requiredTables.filter(
      (table) => !existingTables.includes(table),
    );

    return {
      isReady: missingTables.length === 0,
      missingTables,
    };
  } catch (error) {
    return {
      isReady: false,
      missingTables: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new organization with admin user
 * Useful for initial setup
 */
export async function createInitialOrganization(data: {
  organizationName: string;
  organizationSlug: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}): Promise<{ organizationId: string; userId: string }> {
  try {
    const db = await getDatabase();

    // Create organization
    const [organization] = await db
      .insert(schema.organizations)
      .values({
        name: data.organizationName,
        slug: data.organizationSlug,
        subscriptionTier: 'pro', // Give initial organization pro features
        maxUsers: 50,
        maxAgents: 25,
        maxApiRequests: 100000,
        creditBalance: '100.00', // Give some initial credits
      })
      .returning();

    // Create admin user
    const [user] = await db
      .insert(schema.users)
      .values({
        organizationId: organization.id,
        email: data.adminEmail,
        firstName: data.adminFirstName,
        lastName: data.adminLastName,
        role: 'owner',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .returning();

    console.log(
      `✅ Created organization "${data.organizationName}" with admin user "${data.adminEmail}"`,
    );

    return {
      organizationId: organization.id,
      userId: user.id,
    };
  } catch (error) {
    console.error('❌ Failed to create initial organization:', error);
    throw error;
  }
}

/**
 * Setup development database with sample data
 */
export async function setupDevelopmentData(): Promise<void> {
  try {
    console.log('🔧 Setting up development data...');

    // Create a development organization
    const { organizationId, userId } = await createInitialOrganization({
      organizationName: 'ElizaOS Development',
      organizationSlug: 'elizaos-dev',
      adminEmail: 'admin@elizaos.dev',
      adminFirstName: 'Admin',
      adminLastName: 'User',
    });

    const db = await getDatabase();

    // Add some sample plugins
    const samplePlugins = [
      {
        name: 'plugin-openai',
        displayName: 'OpenAI Integration',
        description: 'Connect to OpenAI GPT models',
        version: '1.0.0',
        isApproved: true,
        isPublic: true,
        capabilities: ['text-generation', 'chat-completion'],
      },
      {
        name: 'plugin-discord',
        displayName: 'Discord Bot',
        description: 'Deploy agents to Discord',
        version: '1.0.0',
        isApproved: true,
        isPublic: true,
        capabilities: ['messaging', 'discord-integration'],
      },
      {
        name: 'plugin-twitter',
        displayName: 'Twitter Integration',
        description: 'Post and interact on Twitter',
        version: '1.0.0',
        isApproved: true,
        isPublic: true,
        capabilities: ['social-media', 'twitter-integration'],
      },
    ];

    for (const plugin of samplePlugins) {
      await db.insert(schema.plugins).values(plugin);
    }

    console.log('✅ Development data setup complete!');
    console.log('📧 Admin email: admin@elizaos.dev');
    console.log('🏢 Organization: ElizaOS Development (elizaos-dev)');
  } catch (error) {
    console.error('❌ Failed to setup development data:', error);
    throw error;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      runMigrations().catch(process.exit);
      break;
    case 'reset':
      resetDatabase().catch(process.exit);
      break;
    case 'status':
      checkMigrationStatus()
        .then((status) => {
          console.log('Migration Status:', status);
          if (!status.isReady) {
            process.exit(1);
          }
        })
        .catch(process.exit);
      break;
    case 'dev-setup':
      Promise.resolve()
        .then(() => runMigrations())
        .then(() => setupDevelopmentData())
        .catch(process.exit);
      break;
    default:
      console.log('Usage: node migrate.js [migrate|reset|status|dev-setup]');
      process.exit(1);
  }
}
