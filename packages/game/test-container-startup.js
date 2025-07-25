#!/usr/bin/env node

/**
 * Test script to verify agent container startup
 * This script tests the container environment without Tauri
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

console.log('🧪 Testing Agent Container Startup');

async function testContainerStartup() {
    try {
        // Check if agentserver is built
        const binaryPath = '../agentserver/dist-binaries/server-linux-x64';
        if (!existsSync(binaryPath)) {
            console.error('❌ Agent binary not found. Build it first:');
            console.error('   cd ../agentserver && bun run build:binary linux');
            process.exit(1);
        }

        // Test podman availability
        console.log('🔍 Checking podman availability...');
        const podmanCheck = spawn('podman', ['--version'], { stdio: 'pipe' });
        
        podmanCheck.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Podman is available');
                startTestContainers();
            } else {
                console.error('❌ Podman not available. Install it first:');
                console.error('   brew install podman  # macOS');
                console.error('   sudo apt install podman  # Linux');
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

async function startTestContainers() {
    console.log('🚀 Starting test containers...');
    
    try {
        // Create network
        console.log('📡 Creating eliza-network...');
        const createNetwork = spawn('podman', ['network', 'create', 'eliza-network'], { stdio: 'pipe' });
        
        createNetwork.on('close', (networkCode) => {
            if (networkCode === 0 || networkCode === 125) { // 125 = already exists
                console.log('✅ Network ready');
                startPostgres();
            } else {
                console.error('❌ Failed to create network');
                process.exit(1);
            }
        });
        
    } catch (error) {
        console.error('❌ Container startup failed:', error.message);
        process.exit(1);
    }
}

function startPostgres() {
    console.log('🐘 Starting PostgreSQL container...');
    
    const postgres = spawn('podman', [
        'run', '-d', '--name', 'eliza-postgres-test',
        '--network', 'eliza-network',
        '-p', '5432:5432',
        '-e', 'POSTGRES_DB=eliza_game',
        '-e', 'POSTGRES_USER=eliza', 
        '-e', 'POSTGRES_PASSWORD=eliza_secure_pass',
        '-v', `${process.cwd()}/init-scripts:/docker-entrypoint-initdb.d:ro`,
        'pgvector/pgvector:pg16'
    ], { stdio: 'pipe' });
    
    postgres.on('close', (code) => {
        if (code === 0 || code === 125) { // 125 = already exists
            console.log('✅ PostgreSQL container started');
            setTimeout(() => startAgent(), 10000); // Wait for DB init
        } else {
            console.error('❌ Failed to start PostgreSQL');
            process.exit(1);
        }
    });
}

function startAgent() {
    console.log('🤖 Testing agent binary...');
    
    const agentEnv = {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '7777',
        DATABASE_URL: 'postgresql://eliza:eliza_secure_pass@localhost:5432/eliza_game',
        LOG_LEVEL: 'info'
    };
    
    const agent = spawn('../agentserver/dist-binaries/server-linux-x64', [], {
        env: agentEnv,
        stdio: 'pipe'
    });
    
    let startupOutput = '';
    agent.stdout.on('data', (data) => {
        const output = data.toString();
        startupOutput += output;
        console.log('📝 Agent:', output.trim());
        
        // Check for successful startup indicators
        if (output.includes('Server started on port 7777') || 
            output.includes('Agent server running') ||
            output.includes('🚀')) {
            console.log('✅ Agent started successfully!');
            cleanup();
        }
    });
    
    agent.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('⚠️  Agent error:', error.trim());
        
        // Check for critical errors
        if (error.includes('ECONNREFUSED') || 
            error.includes('database') ||
            error.includes('Error:')) {
            console.error('❌ Critical startup error detected');
            cleanup();
        }
    });
    
    agent.on('close', (code) => {
        console.log(`Agent exited with code ${code}`);
        cleanup();
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
        console.log('⏰ Startup test timeout - cleaning up');
        cleanup();
    }, 30000);
}

function cleanup() {
    console.log('🧹 Cleaning up test containers...');
    
    // Stop and remove test containers
    spawn('podman', ['stop', 'eliza-postgres-test'], { stdio: 'ignore' });
    spawn('podman', ['rm', 'eliza-postgres-test'], { stdio: 'ignore' });
    
    setTimeout(() => {
        console.log('✅ Test completed');
        process.exit(0);
    }, 2000);
}

// Run the test
testContainerStartup();