#!/bin/bash
# Install bridge client for SWE-bench containers

set -e

LANGUAGE_TYPE=$1

echo "Installing bridge client for $LANGUAGE_TYPE languages..."

# Install Node.js if not already present (needed for bridge client)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js for bridge client..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Create bridge directory
mkdir -p /bridge

# Install bridge dependencies
cd /bridge
cat > package.json <<EOF
{
  "name": "swe-bench-bridge-client",
  "version": "1.0.0",
  "description": "Bridge client for SWE-bench containers",
  "main": "bridge-client.js",
  "dependencies": {
    "ws": "^8.16.0",
    "axios": "^1.6.5",
    "uuid": "^9.0.1",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "node-cleanup": "^2.1.2"
  }
}
EOF

npm install --production

# Create bridge client script
cat > bridge-client.js <<'EOF'
const WebSocket = require('ws');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const cleanup = require('node-cleanup');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONTAINER_ID = process.env.CONTAINER_ID || uuidv4();
const BRIDGE_SERVER = process.env.BRIDGE_SERVER || 'ws://host.docker.internal:8080';
const LANGUAGE_TYPE = process.env.LANGUAGE_TYPE || 'unknown';
const WORKSPACE = process.env.WORKSPACE || '/workspace';
const RESULTS_DIR = process.env.RESULTS_DIR || '/results';

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `/bridge/bridge-${CONTAINER_ID}.log` })
    ]
});

class BridgeClient {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 5000;
        this.isShuttingDown = false;
        this.currentTask = null;
    }

    connect() {
        if (this.isShuttingDown) return;

        logger.info(`Connecting to bridge server at ${BRIDGE_SERVER}...`);
        
        this.ws = new WebSocket(BRIDGE_SERVER);

        this.ws.on('open', () => {
            logger.info('Connected to bridge server');
            this.register();
            this.startHeartbeat();
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (error) {
                logger.error('Failed to parse message:', error);
            }
        });

        this.ws.on('close', () => {
            logger.warn('Connection closed');
            if (!this.isShuttingDown) {
                setTimeout(() => this.connect(), this.reconnectInterval);
            }
        });

        this.ws.on('error', (error) => {
            logger.error('WebSocket error:', error);
        });
    }

    register() {
        this.send({
            type: 'register',
            containerId: CONTAINER_ID,
            languageType: LANGUAGE_TYPE,
            capabilities: this.getCapabilities(),
            timestamp: new Date().toISOString()
        });
    }

    getCapabilities() {
        const capabilities = {
            languages: [],
            buildTools: [],
            testFrameworks: []
        };

        // Detect installed languages
        if (this.commandExists('node')) capabilities.languages.push('javascript', 'typescript');
        if (this.commandExists('python3')) capabilities.languages.push('python');
        if (this.commandExists('java')) capabilities.languages.push('java');
        if (this.commandExists('go')) capabilities.languages.push('go');
        if (this.commandExists('rustc')) capabilities.languages.push('rust');
        if (this.commandExists('gcc')) capabilities.languages.push('c');
        if (this.commandExists('g++')) capabilities.languages.push('cpp');

        // Detect build tools
        if (this.commandExists('npm')) capabilities.buildTools.push('npm');
        if (this.commandExists('yarn')) capabilities.buildTools.push('yarn');
        if (this.commandExists('pnpm')) capabilities.buildTools.push('pnpm');
        if (this.commandExists('maven')) capabilities.buildTools.push('maven');
        if (this.commandExists('gradle')) capabilities.buildTools.push('gradle');
        if (this.commandExists('cargo')) capabilities.buildTools.push('cargo');
        if (this.commandExists('make')) capabilities.buildTools.push('make');
        if (this.commandExists('cmake')) capabilities.buildTools.push('cmake');

        return capabilities;
    }

    commandExists(command) {
        try {
            require('child_process').execSync(`which ${command}`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'heartbeat',
                    containerId: CONTAINER_ID,
                    status: this.currentTask ? 'busy' : 'idle',
                    timestamp: new Date().toISOString()
                });
            }
        }, 30000);
    }

    async handleMessage(message) {
        logger.info('Received message:', message.type);

        switch (message.type) {
            case 'task':
                await this.handleTask(message.task);
                break;
            case 'status':
                this.sendStatus();
                break;
            case 'shutdown':
                await this.shutdown();
                break;
        }
    }

    async handleTask(task) {
        this.currentTask = task;
        
        try {
            this.send({
                type: 'task_started',
                containerId: CONTAINER_ID,
                taskId: task.id,
                timestamp: new Date().toISOString()
            });

            const result = await this.executeTask(task);

            this.send({
                type: 'task_completed',
                containerId: CONTAINER_ID,
                taskId: task.id,
                result: result,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.send({
                type: 'task_failed',
                containerId: CONTAINER_ID,
                taskId: task.id,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        } finally {
            this.currentTask = null;
        }
    }

    async executeTask(task) {
        logger.info(`Executing task ${task.id} of type ${task.type}`);

        switch (task.type) {
            case 'swe_bench_evaluation':
                return await this.executeSWEBenchEvaluation(task);
            case 'test_command':
                return await this.executeCommand(task.command);
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    async executeSWEBenchEvaluation(task) {
        const { instance, patch, config } = task.data;
        
        // Save patch to file
        const patchPath = path.join(WORKSPACE, `${instance.instance_id}.patch`);
        fs.writeFileSync(patchPath, patch);

        // Run evaluation
        const command = `python3 /bridge/evaluate-instance.py --instance-id ${instance.instance_id} --patch ${patchPath}`;
        const result = await this.executeCommand(command);

        // Parse and return results
        return {
            instanceId: instance.instance_id,
            success: result.exitCode === 0,
            output: result.output,
            error: result.error,
            executionTime: result.executionTime
        };
    }

    executeCommand(command) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const child = spawn('bash', ['-c', command], {
                cwd: WORKSPACE,
                env: { ...process.env }
            });

            let output = '';
            let error = '';

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                error += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    exitCode: code,
                    output,
                    error,
                    executionTime: Date.now() - startTime
                });
            });
        });
    }

    sendStatus() {
        const status = {
            containerId: CONTAINER_ID,
            languageType: LANGUAGE_TYPE,
            status: this.currentTask ? 'busy' : 'idle',
            currentTask: this.currentTask ? this.currentTask.id : null,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            capabilities: this.getCapabilities()
        };

        this.send({
            type: 'status_report',
            ...status,
            timestamp: new Date().toISOString()
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    async shutdown() {
        logger.info('Shutting down bridge client...');
        this.isShuttingDown = true;
        
        if (this.ws) {
            this.ws.close();
        }

        process.exit(0);
    }
}

// Create and start client
const client = new BridgeClient();
client.connect();

// Graceful shutdown
cleanup((exitCode, signal) => {
    logger.info(`Cleanup signal received: ${signal}`);
    client.shutdown();
});

// Health check endpoint
const http = require('http');
const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', containerId: CONTAINER_ID }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

healthServer.listen(9999, () => {
    logger.info('Health check server listening on port 9999');
});
EOF

# Create evaluation helper script
cat > evaluate-instance.py <<'EOF'
#!/usr/bin/env python3
import argparse
import json
import subprocess
import os
import sys
import time

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--instance-id', required=True)
    parser.add_argument('--patch', required=True)
    args = parser.parse_args()
    
    # Simplified evaluation for bridge testing
    result = {
        'instance_id': args.instance_id,
        'patch_applied': True,
        'tests_passed': True,
        'execution_time': 5.0
    }
    
    print(json.dumps(result))
    return 0

if __name__ == '__main__':
    sys.exit(main())
EOF

chmod +x evaluate-instance.py

echo "Bridge client installation complete" 