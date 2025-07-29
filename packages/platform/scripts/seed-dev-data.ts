#!/usr/bin/env tsx

/**
 * Seed development data
 * Creates the dev organization and user expected by the dev authentication
 */

import { getDatabaseAdapter } from '../lib/database/adapters/factory';
import { organizations, users } from '../lib/database/schema-pglite';
import { eq } from 'drizzle-orm';

async function seedDevData() {
  console.log('🌱 Seeding development data...');

  const adapter = getDatabaseAdapter();
  await adapter.connect();

  const db = adapter.getDatabase();

  try {
    // Create dev organization
    const devOrgId = 'a0000000-0000-4000-8000-000000000002';
    const devUserId = 'a0000000-0000-4000-8000-000000000001';

    // Check if org already exists
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, devOrgId))
      .limit(1);

    if (existingOrg.length === 0) {
      console.log('Creating dev organization...');
      await db.insert(organizations).values({
        id: devOrgId,
        name: 'Dev Organization',
        slug: 'dev-org',
        subscriptionTier: 'pro',
        creditBalance: '1000.00',
        settings: {
          features: {
            maxAgents: 10,
            maxUsers: 10,
            apiAccess: true,
          },
        },
      });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, devUserId))
      .limit(1);

    if (existingUser.length === 0) {
      console.log('Creating dev user...');
      await db.insert(users).values({
        id: devUserId,
        organizationId: devOrgId,
        email: 'dev@example.com',
        name: 'Dev User',
        role: 'owner',
        isActive: true,
      });
    }

    console.log('✅ Development data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding dev data:', error);
    throw error;
  } finally {
    await adapter.disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDevData().catch(console.error);
}

export { seedDevData };
