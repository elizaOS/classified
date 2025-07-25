#!/usr/bin/env node
/**
 * Production Development Runner
 *
 * This script provides a complete development environment with:
 * - Container orchestration (PostgreSQL, Ollama)
 * - Backend server with lifecycle management
 * - Frontend development server
 * - Graceful shutdown handling
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ProductionDevRunner {
  constructor() {
    this.processes = new Map();
    this.isShuttingDown = false;
    this.ports = {
      frontend: 5173,
      backend: 7777,
      postgres: 5432,
      ollama: 11434,
    };
    this.setupShutdownHandlers();
  }

  /**
   * Start the complete development environment
   */
  async run() {
    console.log('🚀 Starting ELIZA production development environment...\n');

    try {
      // 0. Fix port conflicts BEFORE starting anything
      console.log('🔌 Step 0: Checking and resolving port conflicts...');
      await this.resolvePortConflicts();

      // 1. Start frontend FIRST so user sees game immediately
      console.log('🌐 Step 1: Starting frontend server (game UI)...');
      await this.startFrontend();

      console.log('\n🎮 Game UI is now available at: http://localhost:5173');
      console.log('👀 You can watch the boot sequence in the game interface!\n');

      // 2. Start backend WITH containers (REQUIRED for security)
      console.log('📦 Step 2: Starting backend services...');
      console.log('🔐 SECURITY: Auto-starting containers (required for secure operation)');
      console.log('📊 Container status updates will stream to the frontend UI');

      // Auto-start containers FIRST for security, then start backend
      const startupPromises = [this.startContainersAndBackend()];

      await Promise.all(startupPromises);

      console.log('\n✅ All services started successfully!');
      console.log('🎮 Game available at: http://localhost:5173');
      console.log('🔧 Backend API at: http://localhost:7777');
      console.log('\nPress Ctrl+C to stop all services\n');

      // Keep process alive
      await this.keepAlive();
    } catch (error) {
      console.error('❌ Failed to start development environment:', error.message);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Start containers using the orchestrator
   */
  async startContainers() {
    return new Promise((resolve, reject) => {
      const orchestrator = spawn('bun', ['run', 'src-backend/ContainerOrchestrator.ts', 'start'], {
        cwd: process.cwd(),
        stdio: ['inherit', 'inherit', 'inherit'],
      });

      orchestrator.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Containers started successfully');
          resolve();
        } else {
          reject(new Error(`Container orchestrator failed with code ${code}`));
        }
      });

      orchestrator.on('error', (error) => {
        reject(new Error(`Container orchestrator error: ${error.message}`));
      });
    });
  }

  /**
   * Start containers in background (DEPRECATED - containers are now mandatory)
   */
  async startContainersInBackground() {
    console.warn(
      '⚠️  DEPRECATED: Containers are now mandatory for security - use startContainersAndBackend()'
    );
    try {
      console.log('🔐 Starting required containers for security...');
      await this.startContainers();
      console.log('✅ Container security established');
    } catch (error) {
      // Check if containers are already running
      if (error.message.includes('already in use') || error.message.includes('Conflict')) {
        console.log('ℹ️  Podman containers are already running from previous session');
      } else {
        console.error('❌ SECURITY FAILURE: Container startup failed:', error.message);
        console.error('🚨 Cannot continue without container security');
        throw error; // Don't allow unsafe operation
      }
    }
  }

  /**
   * Start containers AND backend for security compliance
   */
  async startContainersAndBackend() {
    try {
      // The backend server will handle container orchestration internally
      // No need to run the CLI orchestrator separately, which was causing restart loops
      console.log('🔐 SECURITY: Container orchestration will be handled by backend server...');

      // Start backend server which will handle container startup internally
      console.log('🖥️  Starting backend server (will handle container orchestration)...');
      await this.startBackend();

      console.log('✅ Backend server started - containers managed internally');
    } catch (error) {
      console.error('❌ Backend startup failed:', error.message);
      throw error;
    }
  }

  /**
   * Start backend when containers are ready (DEPRECATED - use startContainersAndBackend)
   */
  async startBackendWhenReady() {
    console.warn('⚠️  DEPRECATED: Use startContainersAndBackend() for security compliance');
    return this.startContainersAndBackend();
  }

  /**
   * Build the backend
   */
  async buildBackend() {
    return new Promise((resolve, reject) => {
      const build = spawn('npm', ['run', 'build:backend'], {
        cwd: process.cwd(),
        stdio: ['inherit', 'inherit', 'inherit'],
      });

      build.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Backend built successfully');
          resolve();
        } else {
          reject(new Error(`Backend build failed with code ${code}`));
        }
      });

      build.on('error', (error) => {
        reject(new Error(`Backend build error: ${error.message}`));
      });
    });
  }

  /**
   * Start the backend server
   */
  async startBackend() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting backend server...');

      const backend = spawn('bun', ['run', 'src-backend/server.ts'], {
        cwd: process.cwd(),
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          PORT: '7777',
        },
        detached: false, // Keep attached for proper signal handling
        windowsHide: true, // Hide on Windows
      });

      let startupComplete = false;
      let output = '';

      backend.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);

        if (text.includes('Game backend server is ready') && !startupComplete) {
          startupComplete = true;
          console.log('✅ Backend server started successfully');
          resolve();
        }
      });

      backend.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stderr.write(text);

        if (text.includes('EADDRINUSE') || text.includes('Error:')) {
          if (!startupComplete) {
            reject(new Error(`Backend server failed to start: ${text}`));
          }
        }
      });

      backend.on('close', (code) => {
        if (!this.isShuttingDown) {
          if (code !== 0) {
            console.error(`❌ Backend server exited with code ${code}`);
          } else {
            console.log('ℹ️  Backend server exited gracefully');
          }
        }
      });

      backend.on('error', (error) => {
        if (!startupComplete) {
          reject(new Error(`Backend server error: ${error.message}`));
        }
      });

      this.processes.set('backend', backend);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (!startupComplete) {
          reject(new Error('Backend server startup timeout'));
        }
      }, 60000);
    });
  }

  /**
   * Resolve port conflicts automatically
   */
  async resolvePortConflicts() {
    // First, aggressively clean up any existing processes that might interfere
    console.log('🧹 Cleaning up any existing processes...');
    await this.killProcessOnPort(5173); // Frontend
    await this.killProcessOnPort(7777); // Backend
    await this.killProcessOnPort(8888); // Hardware bridge

    for (const [service, port] of Object.entries(this.ports)) {
      const isAvailable = await this.isPortAvailable(port);

      if (!isAvailable) {
        // Special handling for Ollama - reuse existing instance
        if (service === 'ollama') {
          console.log(`✅ Ollama already running on port ${port}, will reuse existing instance`);
          continue;
        }

        console.log(`⚠️  Port ${port} (${service}) is in use, finding alternative...`);
        const newPort = await this.findAvailablePort(port);

        if (newPort) {
          console.log(`✅ Using port ${newPort} for ${service} instead`);
          this.ports[service] = newPort;
        } else {
          // Kill the process using the port
          await this.killProcessOnPort(port);
          console.log(`🔥 Freed up port ${port} for ${service}`);
        }
      } else {
        console.log(`✅ Port ${port} (${service}) is available`);
      }
    }
  }

  /**
   * Check if a port is available
   */
  async isPortAvailable(port) {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      // Use lsof to check if port is actually in use
      const lsof = spawn('lsof', ['-ti', `:${port}`], { stdio: 'pipe' });

      let output = '';
      lsof.stdout.on('data', (data) => {
        output += data.toString();
      });

      lsof.on('close', (code) => {
        // If lsof finds processes (code 0), port is in use
        // If no processes found (code 1), port is available
        resolve(code !== 0);
      });

      lsof.on('error', () => {
        // Fallback to net check if lsof fails
        const net = require('net');
        const server = net.createServer();
        server.listen(port, () => {
          server.once('close', () => resolve(true));
          server.close();
        });
        server.on('error', () => resolve(false));
      });
    });
  }

  /**
   * Find an available port in a range
   */
  async findAvailablePort(startPort) {
    for (let port = startPort + 1; port <= startPort + 20; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    return null;
  }

  /**
   * Kill process using a specific port
   */
  async killProcessOnPort(port) {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const platform = process.platform;
      let command, args;

      if (platform === 'darwin' || platform === 'linux') {
        command = 'lsof';
        args = ['-ti', `:${port}`];
      } else {
        resolve(); // Skip on Windows for now
        return;
      }

      const lsof = spawn(command, args);
      let pid = '';

      lsof.stdout.on('data', (data) => {
        pid = data.toString().trim();
      });

      lsof.on('close', () => {
        if (pid) {
          const kill = spawn('kill', ['-9', pid]);
          kill.on('close', () => resolve());
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Start the frontend development server
   */
  async startFrontend() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Launching game interface...');

      const frontend = spawn('npm', ['run', 'dev:frontend'], {
        cwd: process.cwd(),
        stdio: ['inherit', 'inherit', 'inherit'], // Use inherit for all streams to prevent buffering issues
        env: {
          ...process.env,
          NODE_ENV: 'development',
          PORT: this.ports.frontend, // Use resolved port
          VITE_PORT: this.ports.frontend,
          VITE_DEV_SERVER_PORT: this.ports.frontend, // Additional env var for Vite
          // Add backend port information for the frontend
          REACT_APP_SERVER_PORT: this.ports.backend,
          REACT_APP_BACKEND_PORT: this.ports.backend,
          VITE_REACT_APP_SERVER_PORT: this.ports.backend,
          VITE_REACT_APP_BACKEND_PORT: this.ports.backend,
        },
        detached: false, // Keep attached to prevent premature termination
        windowsHide: true, // Hide on Windows
      });

      let startupComplete = false;
      let startupTimeout;

      // Set up startup detection with a timeout
      startupTimeout = setTimeout(() => {
        if (!startupComplete) {
          startupComplete = true;
          console.log('✅ Game interface started successfully (timeout-based)');
          console.log('🎮 Opening at: http://localhost:5173');
          resolve();
        }
      }, 3000); // Give it 3 seconds to start

      frontend.on('spawn', () => {
        console.log('🎮 Frontend process spawned successfully');
        if (!startupComplete) {
          setTimeout(() => {
            if (!startupComplete) {
              startupComplete = true;
              clearTimeout(startupTimeout);
              console.log('✅ Game interface started successfully');
              console.log('🎮 Opening at: http://localhost:5173');
              resolve();
            }
          }, 2000); // Wait 2 seconds after spawn
        }
      });

      frontend.on('close', (code) => {
        if (!this.isShuttingDown) {
          console.error(`❌ Frontend server exited with code ${code}`);
          // Don't auto-restart, just log it
        }
      });

      frontend.on('error', (error) => {
        console.error('❌ Frontend server error:', error.message);
        if (!startupComplete) {
          clearTimeout(startupTimeout);
          reject(new Error(`Frontend server error: ${error.message}`));
        }
      });

      this.processes.set('frontend', frontend);
    });
  }

  /**
   * Keep the process alive
   */
  async keepAlive() {
    return new Promise((resolve) => {
      // This promise never resolves, keeping the process alive
      // until shutdown is called
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const shutdownHandler = async (signal) => {
      if (this.isShuttingDown) {return;}

      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  /**
   * Force kill any processes still using the game ports
   */
  async forceKillPortProcesses() {
    const ports = [this.ports.frontend, this.ports.backend, 8888]; // Include hardware bridge port

    for (const port of ports) {
      console.log(`🔍 Checking for processes on port ${port}...`);
      await this.killProcessOnPort(port);
    }
  }

  /**
   * Shutdown all processes
   */
  async shutdown() {
    if (this.isShuttingDown) {return;}
    this.isShuttingDown = true;

    console.log('\n🛑 Shutting down all services...');

    // Stop backend and frontend servers
    const processShutdowns = [];

    for (const [name, process] of this.processes) {
      console.log(`🛑 Stopping ${name} server...`);

      processShutdowns.push(
        new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log(`⚡ Force killing ${name} process...`);
            try {
              // Try SIGKILL first on the process
              process.kill('SIGKILL');

              // Also try to kill the process group if it exists
              if (process.pid) {
                try {
                  process.kill(-process.pid, 'SIGKILL'); // Kill process group
                } catch (e) {
                  // Process group kill might fail, that's ok
                }
              }
            } catch (e) {
              // Process might already be dead
            }
            resolve();
          }, 5000); // Reduced timeout to 5 seconds

          const handleExit = () => {
            clearTimeout(timeout);
            console.log(`✅ ${name} server stopped`);
            resolve();
          };

          process.on('exit', handleExit);
          process.on('close', handleExit); // Also listen for close event

          try {
            // Try graceful shutdown first
            process.kill('SIGTERM');

            // Also try SIGINT after a short delay
            setTimeout(() => {
              try {
                process.kill('SIGINT');
              } catch (e) {
                // Process might be gone already
              }
            }, 1000);
          } catch (e) {
            // Process might already be dead
            resolve();
          }
        })
      );
    }

    // Wait for all processes to stop
    await Promise.all(processShutdowns);

    // Clear the processes map
    this.processes.clear();

    // Additional cleanup: kill any remaining processes on our ports
    console.log('🧹 Checking for any remaining processes on game ports...');
    await this.forceKillPortProcesses();

    // Stop containers
    console.log('🛑 Stopping containers...');
    try {
      await new Promise((resolve, reject) => {
        const orchestrator = spawn('bun', ['run', 'src-backend/ContainerOrchestrator.ts', 'stop'], {
          cwd: process.cwd(),
          stdio: ['inherit', 'inherit', 'inherit'],
        });

        const timeout = setTimeout(() => {
          orchestrator.kill('SIGKILL');
          reject(new Error('Container shutdown timeout'));
        }, 30000);

        orchestrator.on('close', (code) => {
          clearTimeout(timeout);
          console.log('✅ Containers stopped');
          resolve();
        });
      });
    } catch (error) {
      console.error('❌ Error stopping containers:', error.message);
    }

    console.log('✅ Graceful shutdown completed');
  }
}

// Run if called directly (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ProductionDevRunner();
  runner.run().catch((error) => {
    console.error('❌ Development environment failed:', error);
    process.exit(1);
  });
}

export default ProductionDevRunner;
