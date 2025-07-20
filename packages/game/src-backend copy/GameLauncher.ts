import * as path from 'path';
import { SandboxManager, SandboxConfig } from './sandbox/SandboxManager.js';
import * as fs from 'fs/promises';

export interface GameLauncherOptions {
  useContainer: boolean;
  port: number;
  dataVolume?: string;
  environment?: Record<string, string>;
}

export class GameLauncher {
  private sandboxManager: SandboxManager | null = null;
  private options: GameLauncherOptions;

  constructor(options: GameLauncherOptions) {
    this.options = {
      useContainer: false,
      port: 7777,
      ...options,
    };
  }

  /**
   * Initialize the game launcher and set up sandbox if needed
   */
  async initialize(): Promise<void> {
    console.log('[LAUNCHER] Initializing game launcher...');
    console.log('[LAUNCHER] Container mode:', this.options.useContainer ? 'ENABLED' : 'DISABLED');

    if (this.options.useContainer) {
      await this.setupSandbox();
    }
  }

  /**
   * Set up the sandbox container environment
   */
  private async setupSandbox(): Promise<void> {
    console.log('[LAUNCHER] Setting up sandbox environment...');

    // Create data directory for persistent storage
    const dataDir = this.options.dataVolume || path.join(process.cwd(), 'container-data');
    
    try {
      await fs.mkdir(dataDir, { recursive: true });
      console.log('[LAUNCHER] Created data directory:', dataDir);
    } catch (error) {
      console.error('[LAUNCHER] Failed to create data directory:', error);
      throw error;
    }

    // Configure sandbox
    const sandboxConfig: SandboxConfig = {
      containerName: 'eliza-agent',
      imageName: 'eliza-agent:latest',
      ports: [
        { host: this.options.port, container: 7777 },
      ],
      volumes: [
        { host: dataDir, container: '/app/data' },
        { host: path.join(process.cwd(), '.env'), container: '/app/.env' },
      ],
      environment: {
        NODE_ENV: 'production',
        PORT: '7777',
        DATABASE_PATH: '/app/data',
        PGLITE_DATA_DIR: '/app/data',
        ...this.options.environment,
      },
    };

    this.sandboxManager = new SandboxManager(sandboxConfig);

    // Check if container runtime is available
    const runtimeAvailable = await this.sandboxManager.checkRuntimeAvailable();
    
    if (!runtimeAvailable) {
      console.log('[LAUNCHER] No container runtime found, attempting to install Podman...');
      const installSuccess = await this.sandboxManager.installPodman();
      
      if (!installSuccess) {
        throw new Error('Failed to install container runtime. Please install Podman manually.');
      }
      
      console.log('[LAUNCHER] ✅ Container runtime installed successfully');
    }

    console.log('[LAUNCHER] ✅ Sandbox environment ready');
  }

  /**
   * Start the game (either containerized or direct)
   */
  async start(): Promise<void> {
    console.log('[LAUNCHER] Starting game...');

    if (this.options.useContainer && this.sandboxManager) {
      await this.startContainerized();
    } else {
      await this.startDirect();
    }
  }

  /**
   * Start the game in a container
   */
  private async startContainerized(): Promise<void> {
    if (!this.sandboxManager) {
      throw new Error('Sandbox manager not initialized');
    }

    console.log('[LAUNCHER] Starting containerized agent...');

    // Build the container image
    console.log('[LAUNCHER] Building container image...');
    const buildSuccess = await this.sandboxManager.buildImage();
    
    if (!buildSuccess) {
      throw new Error('Failed to build container image');
    }

    console.log('[LAUNCHER] ✅ Container image built successfully');

    // Start the container
    console.log('[LAUNCHER] Starting container...');
    const containerId = await this.sandboxManager.startContainer();
    
    if (!containerId) {
      throw new Error('Failed to start container');
    }

    console.log('[LAUNCHER] ✅ Container started:', containerId);

    // Wait for the agent to be ready
    await this.waitForAgentReady();

    // Monitor container health
    this.monitorContainer();

    console.log('[LAUNCHER] 🎮 Containerized game is ready!');
    console.log(`[LAUNCHER] Agent running at: http://localhost:${this.options.port}`);
  }

  /**
   * Start the game directly (non-containerized)
   */
  private async startDirect(): Promise<void> {
    console.log('[LAUNCHER] Starting direct agent...');
    
    // Set the PORT environment variable for the server
    process.env.PORT = this.options.port.toString();
    console.log(`[LAUNCHER] Set PORT environment variable to: ${this.options.port}`);
    
    // Import and start the server directly
    const { startServer } = await import('./server.js');
    await startServer();

    console.log('[LAUNCHER] 🎮 Direct game is ready!');
    console.log(`[LAUNCHER] Agent running at: http://localhost:${this.options.port}`);
  }

  /**
   * Wait for the agent to be ready by checking health endpoint
   */
  private async waitForAgentReady(maxAttempts: number = 30, intervalMs: number = 2000): Promise<void> {
    console.log('[LAUNCHER] Waiting for agent to be ready...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://localhost:${this.options.port}/api/server/health`);
        
        if (response.ok) {
          const health = await response.json();
          if (health.data?.status === 'healthy') {
            console.log(`[LAUNCHER] ✅ Agent ready after ${attempt} attempts`);
            return;
          }
        }
      } catch (error) {
        // Expected while container is starting up
      }

      console.log(`[LAUNCHER] Attempt ${attempt}/${maxAttempts} - Agent not ready yet, waiting...`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Agent failed to start after ${maxAttempts} attempts`);
  }

  /**
   * Monitor container health and restart if needed
   */
  private monitorContainer(): void {
    if (!this.sandboxManager) return;

    const healthCheckInterval = 30000; // 30 seconds

    const monitor = async () => {
      try {
        const status = await this.sandboxManager!.getStatus();
        
        if (status.health === 'unhealthy') {
          console.warn('[LAUNCHER] ⚠️ Container unhealthy, attempting restart...');
          
          // Get logs for debugging
          const logs = await this.sandboxManager!.getLogs(50);
          console.log('[LAUNCHER] Container logs (last 50 lines):', logs);
          
          // Restart container
          const containerId = await this.sandboxManager!.startContainer();
          
          if (containerId) {
            console.log('[LAUNCHER] ✅ Container restarted successfully:', containerId);
            await this.waitForAgentReady(15, 2000); // Shorter timeout for restart
          } else {
            console.error('[LAUNCHER] ❌ Failed to restart container');
          }
        }
      } catch (error) {
        console.error('[LAUNCHER] Health monitoring error:', error);
      }
    };

    // Initial health check after startup
    setTimeout(monitor, 60000); // Wait 1 minute after startup

    // Regular health checks
    setInterval(monitor, healthCheckInterval);
    
    console.log('[LAUNCHER] ✅ Container health monitoring started');
  }

  /**
   * Stop the game
   */
  async stop(): Promise<void> {
    console.log('[LAUNCHER] Stopping game...');

    if (this.sandboxManager) {
      const stopSuccess = await this.sandboxManager.stopContainer();
      
      if (stopSuccess) {
        console.log('[LAUNCHER] ✅ Container stopped successfully');
      } else {
        console.warn('[LAUNCHER] ⚠️ Failed to stop container cleanly');
      }
    }

    console.log('[LAUNCHER] Game stopped');
  }

  /**
   * Get current game status
   */
  async getStatus(): Promise<any> {
    if (this.sandboxManager) {
      return await this.sandboxManager.getStatus();
    }

    // For direct mode, try to ping the health endpoint
    try {
      const response = await fetch(`http://localhost:${this.options.port}/api/server/health`);
      const health = await response.json();
      
      return {
        isInstalled: true,
        isRunning: response.ok,
        health: health.data?.status === 'healthy' ? 'healthy' : 'unhealthy',
      };
    } catch (error) {
      return {
        isInstalled: true,
        isRunning: false,
        health: 'unknown',
        error: 'Unable to connect to agent',
      };
    }
  }

  /**
   * Get container logs (only in containerized mode)
   */
  async getLogs(tail: number = 100): Promise<string> {
    if (this.sandboxManager) {
      return await this.sandboxManager.getLogs(tail);
    }
    
    return 'Logs not available in direct mode';
  }

  /**
   * Execute command in container (only in containerized mode)
   */
  async execCommand(command: string): Promise<string> {
    if (this.sandboxManager) {
      return await this.sandboxManager.execInContainer(command);
    }
    
    throw new Error('Command execution only available in containerized mode');
  }
}