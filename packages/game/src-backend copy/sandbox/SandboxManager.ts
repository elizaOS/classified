import { spawn, exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SandboxConfig {
  containerName: string;
  imageName: string;
  ports: { host: number; container: number }[];
  volumes: { host: string; container: string }[];
  environment: Record<string, string>;
}

export interface SandboxStatus {
  isInstalled: boolean;
  isRunning: boolean;
  containerId?: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  error?: string;
}

export class SandboxManager {
  private config: SandboxConfig;
  private containerRuntime: 'podman' | 'docker' | null = null;

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  /**
   * Check if container runtime is available and working
   */
  async checkRuntimeAvailable(): Promise<boolean> {
    console.log('[SANDBOX] Checking for container runtime...');

    // Try Podman first (preferred)
    try {
      await execAsync('podman --version');
      this.containerRuntime = 'podman';
      console.log('[SANDBOX] ✅ Podman found');
      return true;
    } catch (error) {
      console.log('[SANDBOX] Podman not found, trying Docker...');
    }

    // Fall back to Docker
    try {
      await execAsync('docker --version');
      this.containerRuntime = 'docker';
      console.log('[SANDBOX] ✅ Docker found');
      return true;
    } catch (error) {
      console.log('[SANDBOX] ❌ No container runtime found');
      this.containerRuntime = null;
      return false;
    }
  }

  /**
   * Auto-install Podman based on platform
   */
  async installPodman(): Promise<boolean> {
    console.log('[SANDBOX] Installing Podman...');

    const platform = process.platform;
    
    try {
      switch (platform) {
        case 'darwin': // macOS
          return await this.installPodmanMac();
        case 'win32': // Windows
          return await this.installPodmanWindows();
        case 'linux': // Linux
          return await this.installPodmanLinux();
        default:
          console.error(`[SANDBOX] Unsupported platform: ${platform}`);
          return false;
      }
    } catch (error) {
      console.error('[SANDBOX] Failed to install Podman:', error);
      return false;
    }
  }

  private async installPodmanMac(): Promise<boolean> {
    console.log('[SANDBOX] Installing Podman for macOS...');
    
    try {
      // Try Homebrew first
      await execAsync('brew --version');
      console.log('[SANDBOX] Using Homebrew to install Podman...');
      await execAsync('brew install podman');
      
      // Initialize Podman machine
      await execAsync('podman machine init --memory 2048 --disk-size 20');
      await execAsync('podman machine start');
      
      this.containerRuntime = 'podman';
      return true;
    } catch (brewError) {
      console.log('[SANDBOX] Homebrew not available, trying manual install...');
      
      // TODO: Download and install Podman Desktop installer
      // For now, guide user to manual installation
      console.error('[SANDBOX] Please install Podman Desktop from: https://podman-desktop.io/downloads');
      return false;
    }
  }

  private async installPodmanWindows(): Promise<boolean> {
    console.log('[SANDBOX] Installing Podman for Windows...');
    
    // TODO: Download and run Podman Desktop installer for Windows
    // For now, guide user to manual installation
    console.error('[SANDBOX] Please install Podman Desktop from: https://podman-desktop.io/downloads');
    return false;
  }

  private async installPodmanLinux(): Promise<boolean> {
    console.log('[SANDBOX] Installing Podman for Linux...');
    
    try {
      // Detect Linux distribution and install appropriately
      const { stdout } = await execAsync('cat /etc/os-release');
      
      if (stdout.includes('Ubuntu') || stdout.includes('Debian')) {
        console.log('[SANDBOX] Installing Podman on Ubuntu/Debian...');
        await execAsync('sudo apt update && sudo apt install -y podman');
      } else if (stdout.includes('CentOS') || stdout.includes('RHEL') || stdout.includes('Fedora')) {
        console.log('[SANDBOX] Installing Podman on RHEL/CentOS/Fedora...');
        await execAsync('sudo dnf install -y podman');
      } else {
        console.error('[SANDBOX] Unsupported Linux distribution');
        return false;
      }
      
      this.containerRuntime = 'podman';
      return true;
    } catch (error) {
      console.error('[SANDBOX] Failed to install Podman on Linux:', error);
      return false;
    }
  }

  /**
   * Build the agent container image
   */
  async buildImage(): Promise<boolean> {
    if (!this.containerRuntime) {
      console.error('[SANDBOX] No container runtime available');
      return false;
    }

    console.log('[SANDBOX] Building agent container image...');

    try {
      const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
      const contextPath = path.join(__dirname, '..', '..');

      const buildCommand = `${this.containerRuntime} build -t ${this.config.imageName} -f ${dockerfilePath} ${contextPath}`;
      console.log('[SANDBOX] Running:', buildCommand);

      const { stdout, stderr } = await execAsync(buildCommand);
      console.log('[SANDBOX] Build output:', stdout);
      if (stderr) console.log('[SANDBOX] Build warnings:', stderr);

      console.log('[SANDBOX] ✅ Image built successfully');
      return true;
    } catch (error) {
      console.error('[SANDBOX] Failed to build image:', error);
      return false;
    }
  }

  /**
   * Start the sandboxed agent container
   */
  async startContainer(): Promise<string | null> {
    if (!this.containerRuntime) {
      console.error('[SANDBOX] No container runtime available');
      return null;
    }

    console.log('[SANDBOX] Starting agent container...');

    try {
      // Stop any existing container first
      await this.stopContainer();

      // Build run command
      const portMappings = this.config.ports
        .map(p => `-p ${p.host}:${p.container}`)
        .join(' ');

      const volumeMappings = this.config.volumes
        .map(v => `-v ${v.host}:${v.container}`)
        .join(' ');

      const envVars = Object.entries(this.config.environment)
        .map(([key, value]) => `-e ${key}="${value}"`)
        .join(' ');

      const runCommand = `${this.containerRuntime} run -d --name ${this.config.containerName} ${portMappings} ${volumeMappings} ${envVars} ${this.config.imageName}`;
      
      console.log('[SANDBOX] Running:', runCommand);

      const { stdout } = await execAsync(runCommand);
      const containerId = stdout.trim();

      console.log('[SANDBOX] ✅ Container started:', containerId);
      return containerId;
    } catch (error) {
      console.error('[SANDBOX] Failed to start container:', error);
      return null;
    }
  }

  /**
   * Stop the agent container
   */
  async stopContainer(): Promise<boolean> {
    if (!this.containerRuntime) return false;

    console.log('[SANDBOX] Stopping agent container...');

    try {
      // Check if container exists and is running
      const { stdout } = await execAsync(`${this.containerRuntime} ps -q -f name=${this.config.containerName}`);
      
      if (stdout.trim()) {
        await execAsync(`${this.containerRuntime} stop ${this.config.containerName}`);
        console.log('[SANDBOX] ✅ Container stopped');
      }

      // Remove the container
      try {
        await execAsync(`${this.containerRuntime} rm ${this.config.containerName}`);
        console.log('[SANDBOX] ✅ Container removed');
      } catch (removeError) {
        // Container might not exist, that's OK
      }

      return true;
    } catch (error) {
      console.error('[SANDBOX] Failed to stop container:', error);
      return false;
    }
  }

  /**
   * Get container status and health
   */
  async getStatus(): Promise<SandboxStatus> {
    const status: SandboxStatus = {
      isInstalled: await this.checkRuntimeAvailable(),
      isRunning: false,
      health: 'unknown'
    };

    if (!status.isInstalled || !this.containerRuntime) {
      return status;
    }

    try {
      // Check if container is running
      const { stdout } = await execAsync(`${this.containerRuntime} ps -q -f name=${this.config.containerName}`);
      const containerId = stdout.trim();

      if (containerId) {
        status.isRunning = true;
        status.containerId = containerId;

        // Check health by pinging the service
        try {
          const healthResponse = await fetch(`http://localhost:${this.config.ports[0].host}/api/server/health`);
          status.health = healthResponse.ok ? 'healthy' : 'unhealthy';
        } catch (healthError) {
          status.health = 'unhealthy';
          status.error = 'Service not responding';
        }
      }

      return status;
    } catch (error) {
      status.error = error instanceof Error ? error.message : 'Unknown error';
      return status;
    }
  }

  /**
   * Get container logs
   */
  async getLogs(tail: number = 100): Promise<string> {
    if (!this.containerRuntime) return '';

    try {
      const { stdout } = await execAsync(`${this.containerRuntime} logs --tail ${tail} ${this.config.containerName}`);
      return stdout;
    } catch (error) {
      console.error('[SANDBOX] Failed to get logs:', error);
      return '';
    }
  }

  /**
   * Execute command in running container
   */
  async execInContainer(command: string): Promise<string> {
    if (!this.containerRuntime) return '';

    try {
      const { stdout } = await execAsync(`${this.containerRuntime} exec ${this.config.containerName} ${command}`);
      return stdout;
    } catch (error) {
      console.error('[SANDBOX] Failed to execute command in container:', error);
      return '';
    }
  }
}