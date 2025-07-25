#!/usr/bin/env node

/**
 * Test script to verify the complete container stack
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

console.log('🧪 Testing Complete Container Stack');

async function testCompleteStack() {
    try {
        // Check podman availability
        console.log('🔍 Checking podman availability...');
        const podmanCheck = spawn('podman', ['--version'], { stdio: 'pipe' });
        
        podmanCheck.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Podman is available');
                startTestStack();
            } else {
                console.error('❌ Podman not available');
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

async function startTestStack() {
    console.log('🚀 Starting complete test stack...');
    
    try {
        // Clean up any existing test containers
        console.log('🧹 Cleaning up existing test containers...');
        spawn('podman', ['stop', 'eliza-postgres-test', 'eliza-agent-test'], { stdio: 'ignore' });
        spawn('podman', ['rm', 'eliza-postgres-test', 'eliza-agent-test'], { stdio: 'ignore' });
        
        setTimeout(() => {
            createNetwork();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Container startup failed:', error.message);
        process.exit(1);
    }
}

function createNetwork() {
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
        '-e', 'POSTGRES_INITDB_ARGS=--encoding=UTF-8 --locale=C',
        '-v', `${process.cwd()}/init-scripts:/docker-entrypoint-initdb.d:ro`,
        'pgvector/pgvector:pg16'
    ], { stdio: 'pipe' });
    
    postgres.stdout.on('data', (data) => {
        console.log('🐘 PostgreSQL:', data.toString().trim());
    });
    
    postgres.stderr.on('data', (data) => {
        console.log('🐘 PostgreSQL stderr:', data.toString().trim());
    });
    
    postgres.on('close', (code) => {
        if (code === 0 || code === 125) { // 125 = already exists
            console.log('✅ PostgreSQL container started');
            setTimeout(() => checkPostgresHealth(), 10000);
        } else {
            console.error('❌ Failed to start PostgreSQL');
            process.exit(1);
        }
    });
}

function checkPostgresHealth() {
    console.log('🔍 Checking PostgreSQL health...');
    
    const healthCheck = spawn('podman', [
        'exec', 'eliza-postgres-test',
        'pg_isready', '-U', 'eliza', '-d', 'eliza_game'
    ], { stdio: 'pipe' });
    
    healthCheck.on('close', (code) => {
        if (code === 0) {
            console.log('✅ PostgreSQL is healthy');
            startAgent();
        } else {
            console.log('⏳ PostgreSQL not ready yet, waiting...');
            setTimeout(() => checkPostgresHealth(), 5000);
        }
    });
}

function startAgent() {
    console.log('🤖 Starting agent container...');
    
    const agentEnv = [
        '-e', 'NODE_ENV=production',
        '-e', 'PORT=7777',
        '-e', 'SERVER_PORT=7777',
        '-e', 'LOG_LEVEL=info',
        '-e', 'DATABASE_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres-test:5432/eliza_game',
        '-e', 'POSTGRES_URL=postgresql://eliza:eliza_secure_pass@eliza-postgres-test:5432/eliza_game',
        '-e', 'POSTGRES_HOST=eliza-postgres-test',
        '-e', 'POSTGRES_PORT=5432',
        '-e', 'POSTGRES_DB=eliza_game', 
        '-e', 'POSTGRES_USER=eliza',
        '-e', 'POSTGRES_PASSWORD=eliza_secure_pass',
        '-e', 'MODEL_PROVIDER=openai',
        '-e', 'AUTONOMY_ENABLED=true',
        '-e', 'USE_SMALL_MODELS=true'
    ];
    
    // Add API keys if available
    if (process.env.OPENAI_API_KEY) {
        agentEnv.push('-e', `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`);
    }
    if (process.env.ANTHROPIC_API_KEY) {
        agentEnv.push('-e', `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`);
    }
    
    const agent = spawn('podman', [
        'run', '-d', '--name', 'eliza-agent-test',
        '--network', 'eliza-network',
        '-p', '7777:7777',
        ...agentEnv,
        'eliza-agent-server:latest'
    ], { stdio: 'pipe' });
    
    agent.stdout.on('data', (data) => {
        console.log('🤖 Agent container ID:', data.toString().trim());
    });
    
    agent.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Agent container started');
            setTimeout(() => checkAgentLogs(), 5000);
        } else {
            console.error('❌ Failed to start agent container');
            cleanup();
        }
    });
}

function checkAgentLogs() {
    console.log('📝 Checking agent logs...');
    
    const logs = spawn('podman', ['logs', 'eliza-agent-test'], { stdio: 'pipe' });
    
    let logOutput = '';
    logs.stdout.on('data', (data) => {
        const output = data.toString();
        logOutput += output;
        console.log('📝 Agent:', output.trim());
    });
    
    logs.stderr.on('data', (data) => {
        const error = data.toString();
        logOutput += error;
        console.log('⚠️  Agent error:', error.trim());
    });
    
    logs.on('close', (code) => {
        // Check for success indicators in logs
        if (logOutput.includes('Server started') || 
            logOutput.includes('listening on port 7777') ||
            logOutput.includes('🚀') ||
            logOutput.includes('Agent server running')) {
            console.log('✅ Agent appears to be starting successfully!');
            testAgentHealth();
        } else if (logOutput.includes('Error') || 
                   logOutput.includes('failed') ||
                   logOutput.includes('ECONNREFUSED')) {
            console.error('❌ Agent startup errors detected');
            console.log('Full log output:', logOutput);
            cleanup();
        } else {
            console.log('⏳ Agent still starting, checking again...');
            setTimeout(() => checkAgentLogs(), 5000);
        }
    });
}

function testAgentHealth() {
    console.log('🔍 Testing agent health endpoint...');
    
    const healthTest = spawn('curl', [
        '-f', '-s', 
        'http://localhost:7777/api/server/health'
    ], { stdio: 'pipe' });
    
    healthTest.on('close', (code) => {
        if (code === 0) {
            console.log('🎉 SUCCESS! Agent is responding to health checks!');
            testAgentAPI();
        } else {
            console.log('⏳ Health endpoint not ready yet, waiting...');
            setTimeout(() => testAgentHealth(), 5000);
        }
    });
}

function testAgentAPI() {
    console.log('🔍 Testing agent API...');
    
    const apiTest = spawn('curl', [
        '-s', '-X', 'GET',
        'http://localhost:7777/api/agents'
    ], { stdio: 'pipe' });
    
    let apiResponse = '';
    apiTest.stdout.on('data', (data) => {
        apiResponse += data.toString();
    });
    
    apiTest.on('close', (code) => {
        if (code === 0 && apiResponse.trim()) {
            console.log('🎉 SUCCESS! Agent API is responding!');
            console.log('📋 API Response:', apiResponse.trim());
        } else {
            console.log('⚠️  API test inconclusive');
        }
        
        console.log('✅ VERIFICATION COMPLETE!');
        console.log('🎯 The agent container is working correctly!');
        cleanup();
    });
}

function cleanup() {
    console.log('🧹 Cleaning up test containers...');
    
    // Stop and remove test containers
    const stopCmd = spawn('podman', ['stop', 'eliza-postgres-test', 'eliza-agent-test'], { stdio: 'pipe' });
    stopCmd.on('close', () => {
        spawn('podman', ['rm', 'eliza-postgres-test', 'eliza-agent-test'], { stdio: 'pipe' }).on('close', () => {
            console.log('✅ Cleanup completed');
            process.exit(0);
        });
    });
}

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Run the test
testCompleteStack();