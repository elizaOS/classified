import { elizaLogger } from '@elizaos/core';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { E2BExecutionResult } from '../types.js';

interface LocalSandbox {
  id: string;
  containerId?: string;
  tempDir: string;
  process?: ChildProcess;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Local E2B Simulator for testing with real code execution
 * Uses isolated temporary directories and optionally Docker containers
 */
export class LocalE2BSimulator {
  private sandboxes: Map<string, LocalSandbox> = new Map();
  private useDocker: boolean;
  private dockerImage: string;

  constructor(options: { useDocker?: boolean; dockerImage?: string; template?: string } = {}) {
    // Start with the provided option or false, will check Docker availability later
    this.useDocker = options.useDocker ?? false;

    // Use different images based on template
    if (options.dockerImage) {
      this.dockerImage = options.dockerImage;
    } else if (options.template === 'node-js') {
      // Use an image with both Node.js and Python
      this.dockerImage = 'nikolaik/python-nodejs:python3.11-nodejs20';
    } else {
      // Default to Python image
      this.dockerImage = 'python:3.11-slim';
    }
  }

  async initialize(): Promise<void> {
    // Check Docker availability during initialization
    if (!this.useDocker) {
      this.useDocker = await this.isDockerAvailable();
    }

    if (this.useDocker) {
      elizaLogger.info('LocalE2BSimulator: Using Docker for sandboxed execution');
    } else {
      elizaLogger.info('LocalE2BSimulator: Using local process execution (less isolated)');
    }
  }

  private async isDockerAvailable(): Promise<boolean> {
    try {
      await this.execCommand('docker', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  private execCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed: ${stderr}`));
        }
      });
    });
  }

  async createSandbox(sandboxId: string): Promise<LocalSandbox> {
    // Create temporary directory for sandbox
    const tempDir = path.join(os.tmpdir(), `e2b-sandbox-${sandboxId}`);
    await fs.mkdir(tempDir, { recursive: true });

    const sandbox: LocalSandbox = {
      id: sandboxId,
      tempDir,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // If using Docker, create a container
    if (this.useDocker) {
      try {
        const containerName = `e2b-sandbox-${sandboxId}`;

        // Create container with volume mount
        await this.execCommand('docker', [
          'create',
          '--name',
          containerName,
          '-v',
          `${tempDir}:/workspace`,
          '-w',
          '/workspace',
          '--network',
          'none', // No network access for security
          this.dockerImage,
          'tail',
          '-f',
          '/dev/null', // Keep container running
        ]);

        // Start container
        await this.execCommand('docker', ['start', containerName]);

        sandbox.containerId = containerName;
        elizaLogger.info(`Created Docker container: ${containerName}`);
      } catch (error) {
        elizaLogger.warn(
          'Failed to create Docker container, falling back to local execution',
          error
        );
        this.useDocker = false;
      }
    }

    this.sandboxes.set(sandboxId, sandbox);
    return sandbox;
  }

  async executeCode(
    sandboxId: string,
    code: string,
    language: string
  ): Promise<E2BExecutionResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox || !sandbox.isActive) {
      throw new Error(`Sandbox ${sandboxId} not found or inactive`);
    }

    sandbox.lastActivity = new Date();
    const startTime = Date.now();

    try {
      let result: E2BExecutionResult;

      switch (language.toLowerCase()) {
        case 'python':
          result = await this.executePython(sandbox, code);
          break;
        case 'javascript':
        case 'typescript':
        case 'js':
        case 'ts':
          result = await this.executeJavaScript(sandbox, code);
          break;
        case 'bash':
        case 'shell':
        case 'sh':
          result = await this.executeBash(sandbox, code);
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      return {
        ...result,
        executionTime: Date.now() - startTime,
        sandboxId,
        language,
      };
    } catch (error) {
      const err = error as Error;
      return {
        text: '',
        results: [],
        logs: {
          stdout: [],
          stderr: [err.message],
        },
        error: {
          name: 'ExecutionError',
          value: err.message,
          traceback: err.stack || '',
        },
        executionTime: Date.now() - startTime,
        sandboxId,
        language,
      };
    }
  }

  private async executePython(sandbox: LocalSandbox, code: string): Promise<E2BExecutionResult> {
    const scriptPath = path.join(sandbox.tempDir, 'script.py');
    await fs.writeFile(scriptPath, code);

    try {
      let output: string;
      let errorOutput: string = '';
      const logs = { stdout: [] as string[], stderr: [] as string[] };

      if (this.useDocker && sandbox.containerId) {
        // Execute in Docker container
        try {
          output = await this.execCommand('docker', [
            'exec',
            sandbox.containerId,
            'python',
            '/workspace/script.py',
          ]);
          logs.stdout = output.split('\n').filter((line) => line);
        } catch (err) {
          errorOutput = (err as Error).message;
          logs.stderr = errorOutput.split('\n').filter((line) => line);
          output = '';
        }
      } else {
        // Execute locally
        try {
          output = await this.execCommand('python3', [scriptPath]);
          logs.stdout = output.split('\n').filter((line) => line);
        } catch (err) {
          // Try python if python3 fails
          try {
            output = await this.execCommand('python', [scriptPath]);
            logs.stdout = output.split('\n').filter((line) => line);
          } catch (err2) {
            errorOutput = (err2 as Error).message;
            logs.stderr = errorOutput.split('\n').filter((line) => line);
            output = '';
          }
        }
      }

      return {
        text: output,
        results: output ? [output.trim()] : [],
        logs,
        error: errorOutput
          ? {
              name: 'PythonError',
              value: errorOutput,
              traceback: errorOutput,
            }
          : undefined,
      };
    } finally {
      // Cleanup
      await fs.unlink(scriptPath).catch(() => {});
    }
  }

  private async executeJavaScript(
    sandbox: LocalSandbox,
    code: string
  ): Promise<E2BExecutionResult> {
    const scriptPath = path.join(sandbox.tempDir, 'script.js');
    await fs.writeFile(scriptPath, code);

    try {
      let output: string;
      let errorOutput: string = '';
      const logs = { stdout: [] as string[], stderr: [] as string[] };

      if (this.useDocker && sandbox.containerId) {
        // First, ensure Node.js is installed in the container
        try {
          await this.execCommand('docker', [
            'exec',
            sandbox.containerId,
            'sh',
            '-c',
            'command -v node || (apt-get update && apt-get install -y nodejs)',
          ]);
        } catch {
          // Ignore installation errors, will fail on execution if not available
        }

        // Execute in Docker container
        try {
          output = await this.execCommand('docker', [
            'exec',
            sandbox.containerId,
            'node',
            '/workspace/script.js',
          ]);
          logs.stdout = output.split('\n').filter((line) => line);
        } catch (err) {
          errorOutput = (err as Error).message;
          logs.stderr = errorOutput.split('\n').filter((line) => line);
          output = '';
        }
      } else {
        // Execute locally
        try {
          output = await this.execCommand('node', [scriptPath]);
          logs.stdout = output.split('\n').filter((line) => line);
        } catch (err) {
          errorOutput = (err as Error).message;
          logs.stderr = errorOutput.split('\n').filter((line) => line);
          output = '';
        }
      }

      return {
        text: output,
        results: output ? [output.trim()] : [],
        logs,
        error: errorOutput
          ? {
              name: 'JavaScriptError',
              value: errorOutput,
              traceback: errorOutput,
            }
          : undefined,
      };
    } finally {
      // Cleanup
      await fs.unlink(scriptPath).catch(() => {});
    }
  }

  private async executeBash(sandbox: LocalSandbox, code: string): Promise<E2BExecutionResult> {
    const scriptPath = path.join(sandbox.tempDir, 'script.sh');
    await fs.writeFile(scriptPath, code);
    await fs.chmod(scriptPath, 0o755);

    try {
      let output: string;
      let errorOutput: string = '';
      const logs = { stdout: [] as string[], stderr: [] as string[] };

      if (this.useDocker && sandbox.containerId) {
        // Execute in Docker container
        try {
          output = await this.execCommand('docker', [
            'exec',
            sandbox.containerId,
            'sh',
            '/workspace/script.sh',
          ]);
          logs.stdout = output.split('\n').filter((line) => line);
        } catch (err) {
          errorOutput = (err as Error).message;
          logs.stderr = errorOutput.split('\n').filter((line) => line);
          output = '';
        }
      } else {
        // Execute locally
        try {
          output = await this.execCommand('sh', [scriptPath]);
          logs.stdout = output.split('\n').filter((line) => line);
        } catch (err) {
          errorOutput = (err as Error).message;
          logs.stderr = errorOutput.split('\n').filter((line) => line);
          output = '';
        }
      }

      return {
        text: output,
        results: output ? [output.trim()] : [],
        logs,
        error: errorOutput
          ? {
              name: 'BashError',
              value: errorOutput,
              traceback: errorOutput,
            }
          : undefined,
      };
    } finally {
      // Cleanup
      await fs.unlink(scriptPath).catch(() => {});
    }
  }

  async destroySandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return;

    sandbox.isActive = false;

    // Clean up Docker container if exists
    if (this.useDocker && sandbox.containerId) {
      try {
        // Check if container still exists before trying to stop/remove
        try {
          await this.execCommand('docker', ['inspect', sandbox.containerId]);
        } catch {
          // Container doesn't exist, skip cleanup
          elizaLogger.debug(`Container ${sandbox.containerId} already removed`);
          this.sandboxes.delete(sandboxId);
          return;
        }

        // Stop container
        try {
          await this.execCommand('docker', ['stop', '-t', '1', sandbox.containerId]);
        } catch (error) {
          elizaLogger.debug(`Failed to stop container ${sandbox.containerId}: ${error}`);
        }

        // Remove container
        try {
          await this.execCommand('docker', ['rm', '-f', sandbox.containerId]);
          elizaLogger.info(`Destroyed Docker container: ${sandbox.containerId}`);
        } catch (error) {
          elizaLogger.debug(`Failed to remove container ${sandbox.containerId}: ${error}`);
        }
      } catch (error) {
        elizaLogger.warn(`Failed to clean up Docker container: ${sandbox.containerId}`, error);
      }
    }

    // Clean up temporary directory
    try {
      await fs.rm(sandbox.tempDir, { recursive: true, force: true });
    } catch (error) {
      elizaLogger.warn(`Failed to clean up temp directory: ${sandbox.tempDir}`, error);
    }

    this.sandboxes.delete(sandboxId);
  }

  async cleanup(): Promise<void> {
    const sandboxIds = Array.from(this.sandboxes.keys());
    await Promise.all(sandboxIds.map((id) => this.destroySandbox(id)));
  }

  getSandbox(sandboxId: string): LocalSandbox | undefined {
    return this.sandboxes.get(sandboxId);
  }

  listSandboxes(): LocalSandbox[] {
    return Array.from(this.sandboxes.values());
  }

  async isHealthy(): Promise<boolean> {
    if (this.useDocker) {
      try {
        await this.execCommand('docker', ['ps']);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
}
