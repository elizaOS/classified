#!/usr/bin/env node

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

async function resetDatabase() {
  console.log('🔥 PostgreSQL Database Reset Tool');
  console.log('================================\n');

  // Get database configuration
  const databaseUrl = process.env.DATABASE_URL || 
                     process.env.POSTGRES_URL || 
                     'postgresql://eliza:eliza_secure_pass@localhost:5433/eliza_game';
  
  const dbName = 'eliza_game';
  const baseUrl = databaseUrl.substring(0, databaseUrl.lastIndexOf('/'));
  
  console.log(`📍 Database URL: ${databaseUrl}`);
  console.log(`📦 Database name: ${dbName}`);
  console.log(`🔗 Base URL: ${baseUrl}\n`);

  try {
    // Connect to postgres database to drop/create eliza_game
    console.log('🔌 Connecting to postgres database...');
    const client = new Client({
      connectionString: `${baseUrl}/postgres`
    });
    
    await client.connect();
    console.log('✅ Connected to postgres database\n');
    
    // Terminate all connections to the target database
    console.log(`🔪 Terminating all connections to ${dbName}...`);
    const terminateResult = await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
      AND pid <> pg_backend_pid()
    `, [dbName]);
    console.log(`✅ Terminated ${terminateResult.rowCount} connections\n`);
    
    // Drop the database if it exists
    console.log(`🗑️  Dropping database ${dbName}...`);
    await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log('✅ Database dropped\n');
    
    // Recreate the database
    console.log(`🏗️  Creating fresh database ${dbName}...`);
    await client.query(`CREATE DATABASE ${dbName}`);
    console.log('✅ Database created\n');
    
    await client.end();
    
    // Connect to the new database and ensure extensions
    console.log('🔌 Connecting to new database...');
    const newClient = new Client({
      connectionString: databaseUrl
    });
    await newClient.connect();
    console.log('✅ Connected to new database\n');
    
    // Create necessary extensions
    console.log('🧩 Creating PostgreSQL extensions...');
    await newClient.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log('  ✅ uuid-ossp');
    
    await newClient.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);
    console.log('  ✅ vector');
    
    await newClient.query(`CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch"`);
    console.log('  ✅ fuzzystrmatch\n');
    
    await newClient.end();
    
    console.log('🎉 Database reset complete!');
    console.log('📝 Note: Tables will be created when you start the server.');
    
  } catch (error) {
    console.error('\n❌ Error resetting database:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure PostgreSQL is running:');
      console.error('   - Local: Check if PostgreSQL service is started');
      console.error('   - Docker: docker-compose up -d postgres');
      console.error('   - Podman: podman-compose up -d postgres');
    }
    process.exit(1);
  }
}

// Run the reset
resetDatabase().catch(console.error); 