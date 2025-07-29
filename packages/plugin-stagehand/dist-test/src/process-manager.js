import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '@elizaos/core';
import { platform } from 'os';
export class StagehandProcessManager {
    process = null;
    isRunning = false;
    serverPort;
    binaryPath = null;
    constructor(serverPort = 3456) {
        this.serverPort = serverPort;
        this.binaryPath = this.findBinary();
    }
    findBinary() {
        // Get the directory where this module is located
        const moduleDir = dirname(fileURLToPath(import.meta.url));
        // Check if we're in a Docker container
        const isDocker = process.env.DOCKER_CONTAINER === 'true' || existsSync('/.dockerenv');
        // Possible locations for the binary
        const possiblePaths = [
            // Docker/container paths first
            ...(isDocker
                ? [
                    '/usr/local/bin/stagehand-server',
                    '/usr/local/bin/stagehand-server-linux',
                    '/app/stagehand-server',
                    `/app/binaries/${this.getBinaryName()}`,
                ]
                : []),
            // When running from plugin directory
            join(moduleDir, '../stagehand-server/binaries', this.getBinaryName()),
            // When packaged with agentserver
            join(moduleDir, '../../../stagehand-server', this.getBinaryName()),
            // Development fallback - run via node
            join(moduleDir, '../stagehand-server/dist/index.js'),
            // Docker fallback - if binary not found, try JS file
            ...(isDocker
                ? [
                    '/app/packages/plugin-stagehand/stagehand-server/dist/index.js',
                    '/app/stagehand-server/dist/index.js',
                ]
                : []),
        ];
        for (const path of possiblePaths) {
            if (existsSync(path)) {
                logger.info(`Found Stagehand server at: ${path}`);
                return path;
            }
        }
        logger.error('Could not find Stagehand server binary or JS file');
        return null;
    }
    getBinaryName() {
        const platformName = platform();
        const ext = platformName === 'win32' ? '.exe' : '';
        return `stagehand-server-${platformName}${ext}`;
    }
    async start() {
        if (this.isRunning) {
            logger.warn('Stagehand server is already running');
            return;
        }
        if (!this.binaryPath) {
            throw new Error('Stagehand server binary not found');
        }
        return new Promise((resolve, reject) => {
            const env = {
                ...process.env,
                STAGEHAND_SERVER_PORT: this.serverPort.toString(),
                NODE_ENV: process.env.NODE_ENV || 'production',
                // Pass through relevant environment variables
                BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
                BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
                OPENAI_API_KEY: process.env.OPENAI_API_KEY,
                ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
                BROWSER_HEADLESS: process.env.BROWSER_HEADLESS,
                CAPSOLVER_API_KEY: process.env.CAPSOLVER_API_KEY,
                OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
                OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3.2-vision',
            };
            // Determine if we're running a binary or a JS file
            const isBinary = !this.binaryPath.endsWith('.js');
            if (isBinary) {
                // Run the binary directly
                this.process = spawn(this.binaryPath, [], { env });
            }
            else {
                // Run via node (development mode)
                this.process = spawn('node', [this.binaryPath], { env });
            }
            this.process.stdout?.on('data', (data) => {
                const message = data.toString().trim();
                logger.debug(`[StagehandServer] ${message}`);
                // Check if server is ready
                if (message.includes('listening on port')) {
                    this.isRunning = true;
                    resolve();
                }
            });
            this.process.stderr?.on('data', (data) => {
                logger.error(`[StagehandServer Error] ${data.toString()}`);
            });
            this.process.on('error', (error) => {
                logger.error('Failed to start Stagehand server:', error);
                this.isRunning = false;
                reject(error);
            });
            this.process.on('exit', (code) => {
                logger.info(`Stagehand server exited with code ${code}`);
                this.isRunning = false;
            });
            // Wait for server to be ready
            this.waitForServer()
                .then(() => resolve())
                .catch((error) => {
                this.isRunning = false;
                if (this.process) {
                    this.process.kill('SIGTERM');
                }
                reject(error);
            });
        });
    }
    async waitForServer() {
        const maxAttempts = 30;
        const delay = 1000;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                // Try to establish WebSocket connection for health check
                const WebSocket = (await import('ws')).default;
                const ws = new WebSocket(`ws://localhost:${this.serverPort}`);
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        ws.close();
                        reject(new Error('Connection timeout'));
                    }, 5000);
                    ws.on('open', () => {
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    });
                    ws.on('error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                });
                logger.info('Stagehand server is ready');
                return;
            }
            catch (error) {
                // Server not ready yet, continue waiting
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        throw new Error('Stagehand server failed to start');
    }
    async stop() {
        if (!this.process || !this.isRunning) {
            return;
        }
        return new Promise((resolve) => {
            this.process.on('exit', () => {
                this.isRunning = false;
                resolve();
            });
            // Try graceful shutdown first
            this.process.kill('SIGTERM');
            // Force kill after timeout
            setTimeout(() => {
                if (this.isRunning && this.process) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        });
    }
    isServerRunning() {
        return this.isRunning;
    }
    getServerUrl() {
        return `ws://localhost:${this.serverPort}`;
    }
}
