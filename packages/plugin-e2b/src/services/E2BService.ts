import { Service, elizaLogger, type IAgentRuntime, EventType, type Memory } from '@elizaos/core';
import { Sandbox } from '@e2b/code-interpreter';
import type {
  E2BServiceType,
  E2BSandboxOptions,
  E2BExecutionResult,
  E2BSandboxHandle,
} from '../types.js';
import { ErrorInstrumentation } from '../utils/errorInstrumentation.js';
import { loadE2BConfig, type E2BConfig } from '../config/E2BConfig.js';
import { LocalE2BSimulator } from './LocalE2BSimulator.js';

/**
 * Production E2B Service for secure code execution with resource management
 */
export class E2BService extends Service implements E2BServiceType {
  static serviceType = 'e2b';

  // Resource management
  private sandboxPool: Map<string, { sandbox: Sandbox; handle: E2BSandboxHandle }> = new Map();
  private activeSandboxes = 0;

  // Security validation
  private e2bConfig: E2BConfig;

  // Local mode support
  private localSimulator?: LocalE2BSimulator;
  private isLocalMode = false;

  // Cleanup and health
  private cleanupTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date = new Date();
  private isHealthyStatus = false;

  get capabilityDescription(): string {
    return 'E2B service for secure cloud-based code execution with sandbox isolation, resource management, and ElizaOS integration';
  }

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.e2bConfig = loadE2BConfig(runtime);

    // Check if we should use local mode - check both process.env and runtime settings
    const e2bMode = process.env.E2B_MODE || runtime.getSetting('E2B_MODE');
    this.isLocalMode = e2bMode === 'local';

    if (this.isLocalMode) {
      elizaLogger.info('E2B Service configured for local mode');
    }
  }

  static async start(runtime: IAgentRuntime): Promise<E2BService> {
    const service = new E2BService(runtime);
    await service.initialize();
    return service;
  }

  async initialize(): Promise<void> {
    try {
      elizaLogger.info('Initializing E2B service', {
        environment: this.e2bConfig.environment,
        sandboxPoolSize: this.e2bConfig.resources.sandboxPoolSize,
        mode: this.isLocalMode ? 'local' : 'cloud',
      });

      // If local mode is requested, use LocalE2BSimulator
      if (this.isLocalMode) {
        elizaLogger.info('Using local E2B simulator for real code execution');

        this.localSimulator = new LocalE2BSimulator({
          useDocker:
            (process.env.E2B_LOCAL_USE_DOCKER ||
              this.runtime.getSetting('E2B_LOCAL_USE_DOCKER')) !== 'false',
          dockerImage:
            process.env.E2B_LOCAL_DOCKER_IMAGE || this.runtime.getSetting('E2B_LOCAL_DOCKER_IMAGE'),
          template: 'node-js', // Default to node-js for better compatibility
        });

        await this.localSimulator.initialize();

        // Initialize local sandbox pool
        await this.initializeLocalSandboxPool();

        // Start timers
        this.startCleanupTimer();
        this.startHealthCheckTimer();

        this.isHealthyStatus = await this.localSimulator.isHealthy();
        elizaLogger.info('E2B service initialized in local mode', {
          isHealthy: this.isHealthyStatus,
          sandboxCount: this.sandboxPool.size,
        });

        ErrorInstrumentation.logMetrics('E2BService', 'initialize', {
          sandboxCount: this.sandboxPool.size,
          serviceReady: true,
          localMode: true,
        });

        return;
      }

      // In test/development mode without API key, use mock sandboxes
      if (
        !this.e2bConfig.apiKey &&
        (this.e2bConfig.environment === 'test' || this.e2bConfig.environment === 'development')
      ) {
        elizaLogger.warn(
          'E2B_API_KEY not provided. Using mock sandboxes for test/development environment.'
        );

        // Initialize mock sandbox pool
        await this.initializeMockSandboxPool();

        // Start timers even in mock mode
        this.startCleanupTimer();
        this.startHealthCheckTimer();

        this.isHealthyStatus = true;
        elizaLogger.info('E2B service initialized in mock mode');

        ErrorInstrumentation.logMetrics('E2BService', 'initialize', {
          sandboxCount: this.sandboxPool.size,
          serviceReady: true,
          mockMode: true,
        });

        return;
      }

      if (!this.e2bConfig.apiKey) {
        throw new Error('E2B_API_KEY not configured');
      }

      // Initialize sandbox pool
      await this.initializeSandboxPool();

      // Start cleanup timer
      this.startCleanupTimer();

      // Start health check timer
      this.startHealthCheckTimer();

      this.isHealthyStatus = true;
      elizaLogger.info('E2B service initialized successfully');

      ErrorInstrumentation.logMetrics('E2BService', 'initialize', {
        sandboxCount: this.sandboxPool.size,
        serviceReady: true,
      });
    } catch (error) {
      elizaLogger.error('Failed to initialize E2B service', error);
      throw ErrorInstrumentation.instrumentError(error, {
        service: 'E2BService',
        operation: 'initialize',
      });
    }
  }

  async stop(): Promise<void> {
    try {
      elizaLogger.info('Stopping E2B service');

      // Stop timers
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      // Kill all sandboxes
      await this.killAllSandboxes();

      // Clean up local simulator if in local mode
      if (this.localSimulator) {
        await this.localSimulator.cleanup();
        this.localSimulator = undefined;
      }

      elizaLogger.info('E2B service stopped');
    } catch (error) {
      elizaLogger.error('Error stopping E2B service', error);
    }
  }

  async executeCode(code: string, language = 'python'): Promise<E2BExecutionResult> {
    // Security validation
    this.validateCodeExecution(code, language);

    // Check rate limiting
    await this.checkRateLimit();

    return ErrorInstrumentation.retryWithBackoff(
      async () => this.executeCodeInternal(code, language),
      {
        service: 'E2BService',
        operation: 'executeCode',
        metadata: { language, codeLength: code.length },
      },
      this.e2bConfig.environment === 'production' ? 3 : 1
    );
  }

  private async executeCodeInternal(code: string, language: string): Promise<E2BExecutionResult> {
    const startTime = Date.now();
    let sandboxId: string | null = null;

    try {
      elizaLogger.debug('Executing code', {
        language,
        codeLength: code.length,
      });

      // Get sandbox from pool or create new one
      sandboxId = await this.acquireSandbox();
      const sandboxData = this.sandboxPool.get(sandboxId);

      if (!sandboxData) {
        throw new Error('Failed to acquire sandbox');
      }

      // Execute code with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Execution timeout')),
          this.e2bConfig.security.maxExecutionTime
        );
      });

      const executionPromise = this.executeInSandbox(sandboxData.sandbox, code, language);
      const result = (await Promise.race([executionPromise, timeoutPromise])) as E2BExecutionResult;

      const executionTime = Date.now() - startTime;

      // Update sandbox activity
      sandboxData.handle.lastActivity = new Date();

      // Store execution in memory if enabled
      if (this.e2bConfig.integration.enableMemoryFormation) {
        await this.storeExecutionMemory(code, language, result, executionTime);
      }

      ErrorInstrumentation.logMetrics('E2BService', 'executeCode', {
        language,
        codeLength: code.length,
        executionTime,
        hasError: !!result.error,
        sandboxId,
      });

      return {
        ...result,
        executionTime,
        sandboxId,
        language,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      elizaLogger.error('Code execution failed', {
        error,
        language,
        executionTime,
        sandboxId,
      });

      if (this.e2bConfig.integration.enableErrorPropagation) {
        throw error;
      }

      return {
        text: '',
        results: [],
        logs: { stdout: [], stderr: [] },
        error: {
          name: 'ExecutionError',
          value: error instanceof Error ? error.message : String(error),
          traceback: error instanceof Error ? error.stack || '' : '',
        },
        executionTime,
        language,
      };
    } finally {
      // Release sandbox back to pool
      if (sandboxId) {
        await this.releaseSandbox(sandboxId);
      }
    }
  }

  private async executeInSandbox(
    sandbox: Sandbox,
    code: string,
    language: string
  ): Promise<E2BExecutionResult> {
    let actualCode = code;

    // Handle JavaScript by wrapping in Node.js execution
    if (language === 'javascript' || language === 'js') {
      const encodedCode = Buffer.from(code).toString('base64');
      actualCode = `
import subprocess
import base64
import tempfile
import os
import sys

# Check if Node.js is available, install if not
try:
    result = subprocess.run(['node', '--version'], capture_output=True, text=True, timeout=10)
    if result.returncode != 0:
        raise Exception("Node.js not found")
except:
    # Install Node.js via package manager
    print("Installing Node.js...")
    subprocess.run(['apt-get', 'update'], check=False, capture_output=True)
    subprocess.run(['apt-get', 'install', '-y', 'nodejs'], check=False, capture_output=True)

# Decode JavaScript code from base64
js_code_encoded = "${encodedCode}"
js_code = base64.b64decode(js_code_encoded).decode('utf-8')

with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
    f.write(js_code)
    js_file = f.name

try:
    # Execute JavaScript with Node.js
    result = subprocess.run(['node', js_file], capture_output=True, text=True, timeout=30)
    
    # Print stdout
    if result.stdout:
        print(result.stdout)
    
    # Print stderr if there are errors
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    
    # Set exit code for error detection
    if result.returncode != 0:
        print(f"JavaScript execution failed with exit code: {result.returncode}")
        
finally:
    # Clean up temporary file
    try:
        os.unlink(js_file)
    except:
        pass
`;
    }

    // Execute code in sandbox
    const result = await sandbox.runCode(actualCode);

    return {
      text: result.text,
      results: result.results || [],
      logs: {
        stdout: result.logs?.stdout || [],
        stderr: result.logs?.stderr || [],
      },
      error: result.error,
      executionCount: result.executionCount || 1,
    };
  }

  // Resource management methods

  private async initializeSandboxPool(): Promise<void> {
    const poolSize = Math.min(this.e2bConfig.resources.sandboxPoolSize, 2); // Start with smaller pool

    for (let i = 0; i < poolSize; i++) {
      try {
        await this.createPooledSandbox();
      } catch (error) {
        elizaLogger.warn(`Failed to create sandbox ${i + 1}/${poolSize}`, error);
      }
    }

    if (this.sandboxPool.size === 0) {
      throw new Error('Failed to create any sandboxes');
    }
  }

  private async initializeMockSandboxPool(): Promise<void> {
    const poolSize = Math.min(this.e2bConfig.resources.sandboxPoolSize, 2);

    for (let i = 0; i < poolSize; i++) {
      const mockSandboxId = `mock-sandbox-${i}`;
      const mockSandbox = this.createMockSandbox(mockSandboxId);

      const handle: E2BSandboxHandle = {
        sandboxId: mockSandboxId,
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: { pooled: 'true', mock: 'true' },
        template: 'base',
      };

      this.sandboxPool.set(mockSandboxId, { sandbox: mockSandbox as any, handle });
    }

    elizaLogger.info(`Initialized mock sandbox pool with ${this.sandboxPool.size} sandboxes`);
  }

  private async initializeLocalSandboxPool(): Promise<void> {
    if (!this.localSimulator) {
      throw new Error('Local simulator not initialized');
    }

    const poolSize = Math.min(this.e2bConfig.resources.sandboxPoolSize, 2);

    for (let i = 0; i < poolSize; i++) {
      const sandboxId = `local-sandbox-${i}`;
      const localSandbox = await this.localSimulator.createSandbox(sandboxId);

      const handle: E2BSandboxHandle = {
        sandboxId: localSandbox.id,
        isActive: localSandbox.isActive,
        createdAt: localSandbox.createdAt,
        lastActivity: localSandbox.lastActivity,
        metadata: { pooled: 'true', local: 'true' },
        template: 'base',
      };

      // Create a wrapper that implements the Sandbox interface
      const sandboxWrapper = {
        sandboxId: localSandbox.id,
        kill: async () => {
          await this.localSimulator!.destroySandbox(localSandbox.id);
        },
        runCode: async (code: string) => {
          // Default to Python if language is not specified
          return await this.localSimulator!.executeCode(localSandbox.id, code, 'python');
        },
      };

      this.sandboxPool.set(sandboxId, { sandbox: sandboxWrapper as any, handle });
    }

    elizaLogger.info(`Initialized local sandbox pool with ${this.sandboxPool.size} sandboxes`);
  }

  private createMockSandbox(sandboxId: string): any {
    // Create a mock sandbox object that mimics the E2B Sandbox interface
    return {
      sandboxId,
      kill: async () => {
        elizaLogger.debug(`Mock sandbox ${sandboxId} killed`);
      },
      runCode: async (code: string) => {
        elizaLogger.debug(`Mock sandbox ${sandboxId} executing code`, { codeLength: code.length });

        // Simple mock execution - just return the code as output
        return {
          text: `[MOCK EXECUTION]\nCode executed successfully in test mode.\nInput length: ${code.length} characters`,
          results: [],
          logs: {
            stdout: [`Mock execution of ${code.length} characters of code`],
            stderr: [],
          },
          error: null,
          executionCount: 1,
        };
      },
      // Add other methods as needed for testing
    };
  }

  private async createPooledSandbox(): Promise<string> {
    // In local mode, create local sandboxes
    if (this.isLocalMode && this.localSimulator) {
      const sandboxId = `local-sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const localSandbox = await this.localSimulator.createSandbox(sandboxId);

      const handle: E2BSandboxHandle = {
        sandboxId: localSandbox.id,
        isActive: localSandbox.isActive,
        createdAt: localSandbox.createdAt,
        lastActivity: localSandbox.lastActivity,
        metadata: { pooled: 'true', local: 'true' },
        template: 'base',
      };

      // Create a wrapper that implements the Sandbox interface
      const sandboxWrapper = {
        sandboxId: localSandbox.id,
        kill: async () => {
          await this.localSimulator!.destroySandbox(localSandbox.id);
        },
        runCode: async (code: string) => {
          // Default to Python if language is not specified
          return await this.localSimulator!.executeCode(localSandbox.id, code, 'python');
        },
      };

      this.sandboxPool.set(sandboxId, { sandbox: sandboxWrapper as any, handle });
      return sandboxId;
    }

    // In mock mode, create mock sandboxes
    if (
      !this.e2bConfig.apiKey &&
      (this.e2bConfig.environment === 'test' || this.e2bConfig.environment === 'development')
    ) {
      const mockSandboxId = `mock-sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const mockSandbox = this.createMockSandbox(mockSandboxId);

      const handle: E2BSandboxHandle = {
        sandboxId: mockSandboxId,
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: { pooled: 'true', mock: 'true' },
        template: 'base',
      };

      this.sandboxPool.set(mockSandboxId, { sandbox: mockSandbox as any, handle });
      return mockSandboxId;
    }

    const sandbox = await Sandbox.create({
      apiKey: this.e2bConfig.apiKey,
      timeoutMs: this.e2bConfig.security.sandboxTimeoutMs,
    });

    const handle: E2BSandboxHandle = {
      sandboxId: sandbox.sandboxId,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: { pooled: 'true' },
      template: 'base',
    };

    this.sandboxPool.set(sandbox.sandboxId, { sandbox, handle });
    return sandbox.sandboxId;
  }

  private async acquireSandbox(): Promise<string> {
    // Check concurrent execution limit
    if (this.activeSandboxes >= this.e2bConfig.security.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    // Try to get an idle sandbox from pool
    for (const [id, data] of this.sandboxPool) {
      if (data.handle.isActive && data.handle.metadata?.inUse !== 'true') {
        data.handle.metadata = { ...data.handle.metadata, inUse: 'true' };
        this.activeSandboxes++;
        return id;
      }
    }

    // Create new sandbox if under limit
    if (this.sandboxPool.size < this.e2bConfig.resources.maxActiveSandboxes) {
      const id = await this.createPooledSandbox();
      const data = this.sandboxPool.get(id)!;
      data.handle.metadata = { ...data.handle.metadata, inUse: 'true' };
      this.activeSandboxes++;
      return id;
    }

    throw new Error('No available sandboxes');
  }

  private async releaseSandbox(sandboxId: string): Promise<void> {
    const data = this.sandboxPool.get(sandboxId);
    if (data && data.handle.metadata?.inUse === 'true') {
      data.handle.metadata.inUse = 'false';
      this.activeSandboxes--;
    }
  }

  private async killAllSandboxes(): Promise<void> {
    const promises = Array.from(this.sandboxPool.entries()).map(async ([id, data]) => {
      try {
        await data.sandbox.kill();
      } catch (error) {
        elizaLogger.error(`Failed to kill sandbox ${id}`, error);
      }
    });

    await Promise.all(promises);
    this.sandboxPool.clear();
    this.activeSandboxes = 0;
  }

  // Security validation methods

  private validateCodeExecution(code: string, language: string): void {
    // Check code size
    if (code.length > this.e2bConfig.security.maxCodeSize) {
      throw new Error(
        `Code size exceeds limit of ${this.e2bConfig.security.maxCodeSize} characters`
      );
    }

    // Check allowed languages
    if (!this.e2bConfig.security.allowedLanguages.includes(language)) {
      throw new Error(
        `Language '${language}' is not allowed. Allowed languages: ${this.e2bConfig.security.allowedLanguages.join(', ')}`
      );
    }
  }

  private async checkRateLimit(): Promise<void> {
    // Implement rate limiting logic here
    // For now, just track in metrics
    ErrorInstrumentation.logMetrics('E2BService', 'rateLimit', {
      activeSandboxes: this.activeSandboxes,
      poolSize: this.sandboxPool.size,
    });
  }

  // ElizaOS integration methods

  private async storeExecutionMemory(
    code: string,
    language: string,
    result: E2BExecutionResult,
    executionTime: number
  ): Promise<void> {
    try {
      const memory: Memory = {
        id: crypto.randomUUID() as any,
        entityId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        roomId: this.runtime.agentId, // Use agentId as roomId for service executions
        content: {
          text: `Code execution (${language}):\n\`\`\`${language}\n${code}\n\`\`\`\n\nResult:\n${result.text || 'No output'}`,
          source: 'e2b-execution',
          metadata: {
            language,
            success: !result.error,
            executionTime,
            error: result.error,
          },
        },
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(memory, 'e2b-executions');
    } catch (error) {
      elizaLogger.error('Failed to store execution memory', error);
    }
  }

  // Cleanup and health check methods

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(
      () => this.performCleanup().catch((e) => elizaLogger.error('Cleanup error', e)),
      this.e2bConfig.resources.cleanupIntervalMs
    );
  }

  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck().catch((e) => elizaLogger.error('Health check error', e)),
      60000 // Every minute
    );
  }

  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, data] of this.sandboxPool) {
      const idleTime = now - data.handle.lastActivity.getTime();

      if (
        idleTime > this.e2bConfig.resources.idleSandboxTimeout &&
        data.handle.metadata?.inUse !== 'true'
      ) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      try {
        const data = this.sandboxPool.get(id);
        if (data) {
          await data.sandbox.kill();
          this.sandboxPool.delete(id);
        }
      } catch (error) {
        elizaLogger.error(`Failed to cleanup sandbox ${id}`, error);
      }
    }

    // Ensure minimum pool size
    while (this.sandboxPool.size < this.e2bConfig.resources.sandboxPoolSize) {
      try {
        await this.createPooledSandbox();
      } catch (error) {
        elizaLogger.warn('Failed to maintain sandbox pool size', error);
        break;
      }
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check if we can create a sandbox
      if (this.sandboxPool.size === 0) {
        await this.createPooledSandbox();
      }

      // Test a simple execution
      const testResult = await this.executeCode('print("health check")', 'python');

      this.isHealthyStatus = !testResult.error;
      this.lastHealthCheck = new Date();

      if (this.e2bConfig.integration.enableMetricsCollection) {
        ErrorInstrumentation.logMetrics('E2BService', 'healthCheck', {
          healthy: this.isHealthyStatus,
          sandboxCount: this.sandboxPool.size,
          activeSandboxes: this.activeSandboxes,
        });
      }
    } catch (error) {
      this.isHealthyStatus = false;
      elizaLogger.error('Health check failed', error);
    }
  }

  // Service interface methods

  async createSandbox(opts: E2BSandboxOptions = {}): Promise<string> {
    // Check sandbox limit
    if (this.sandboxPool.size >= this.e2bConfig.resources.maxActiveSandboxes) {
      await this.performCleanup();
      if (this.sandboxPool.size >= this.e2bConfig.resources.maxActiveSandboxes) {
        throw new Error(
          `Maximum sandbox limit (${this.e2bConfig.resources.maxActiveSandboxes}) reached`
        );
      }
    }

    elizaLogger.info('Creating new sandbox', opts);

    // In local mode, create local sandboxes
    if (this.isLocalMode && this.localSimulator) {
      const sandboxId = `local-sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // If a specific template is requested and it's different from the current one, recreate the simulator
      if (opts.template && opts.template !== 'base') {
        this.localSimulator = new LocalE2BSimulator({
          useDocker:
            (process.env.E2B_LOCAL_USE_DOCKER ||
              this.runtime.getSetting('E2B_LOCAL_USE_DOCKER')) !== 'false',
          dockerImage:
            process.env.E2B_LOCAL_DOCKER_IMAGE || this.runtime.getSetting('E2B_LOCAL_DOCKER_IMAGE'),
          template: opts.template,
        });
        await this.localSimulator.initialize();
      }

      const localSandbox = await this.localSimulator.createSandbox(sandboxId);

      const handle: E2BSandboxHandle = {
        sandboxId: localSandbox.id,
        isActive: localSandbox.isActive,
        createdAt: localSandbox.createdAt,
        lastActivity: localSandbox.lastActivity,
        metadata: { ...opts.metadata, local: 'true' },
        template: opts.template || 'base',
      };

      // Create a wrapper that implements the Sandbox interface
      const sandboxWrapper = {
        sandboxId: localSandbox.id,
        kill: async () => {
          await this.localSimulator!.destroySandbox(localSandbox.id);
        },
        runCode: async (code: string) => {
          // Default to Python if language is not specified
          return await this.localSimulator!.executeCode(localSandbox.id, code, 'python');
        },
      };

      this.sandboxPool.set(sandboxId, { sandbox: sandboxWrapper as any, handle });

      elizaLogger.info('Local sandbox created successfully', {
        sandboxId,
        useDocker:
          (process.env.E2B_LOCAL_USE_DOCKER || this.runtime.getSetting('E2B_LOCAL_USE_DOCKER')) !==
          'false',
      });

      return sandboxId;
    }

    // In mock mode, create mock sandboxes
    if (
      !this.e2bConfig.apiKey &&
      (this.e2bConfig.environment === 'test' || this.e2bConfig.environment === 'development')
    ) {
      const mockSandboxId = `mock-sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const mockSandbox = this.createMockSandbox(mockSandboxId);

      const handle: E2BSandboxHandle = {
        sandboxId: mockSandboxId,
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: { ...opts.metadata, mock: 'true' },
        template: opts.template || 'base',
      };

      this.sandboxPool.set(mockSandboxId, { sandbox: mockSandbox as any, handle });

      elizaLogger.info('Mock sandbox created successfully', {
        sandboxId: mockSandboxId,
      });

      return mockSandboxId;
    }

    const sandboxOptions: any = {
      apiKey: this.e2bConfig.apiKey,
      timeoutMs: opts.timeoutMs || this.e2bConfig.security.sandboxTimeoutMs,
    };

    if (opts.template) {
      sandboxOptions.template = opts.template;
    }

    if (opts.envs) {
      sandboxOptions.envs = opts.envs;
    }

    const sandbox = await Sandbox.create(sandboxOptions);

    const handle: E2BSandboxHandle = {
      sandboxId: sandbox.sandboxId,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: opts.metadata,
      template: opts.template || 'base',
    };

    this.sandboxPool.set(sandbox.sandboxId, { sandbox, handle });

    elizaLogger.info('Sandbox created successfully', {
      sandboxId: sandbox.sandboxId,
    });

    return sandbox.sandboxId;
  }

  async killSandbox(sandboxId: string): Promise<void> {
    try {
      const sandboxData = this.sandboxPool.get(sandboxId);
      if (!sandboxData) {
        elizaLogger.warn('Attempted to kill non-existent sandbox', {
          sandboxId,
        });
        return;
      }

      elizaLogger.info('Killing sandbox', { sandboxId });

      await sandboxData.sandbox.kill();
      sandboxData.handle.isActive = false;
      this.sandboxPool.delete(sandboxId);

      elizaLogger.info('Sandbox killed successfully', { sandboxId });
    } catch (error) {
      elizaLogger.error('Failed to kill sandbox', error);
      this.sandboxPool.delete(sandboxId); // Remove from map even if kill fails
    }
  }

  getSandbox(sandboxId: string): E2BSandboxHandle | null {
    const sandboxData = this.sandboxPool.get(sandboxId);
    return sandboxData?.handle || null;
  }

  listSandboxes(): E2BSandboxHandle[] {
    return Array.from(this.sandboxPool.values()).map((data) => data.handle);
  }

  async writeFileToSandbox(sandboxId: string, path: string, content: string): Promise<void> {
    try {
      const sandboxData = this.sandboxPool.get(sandboxId);
      if (!sandboxData) {
        throw new Error(`Sandbox ${sandboxId} not found`);
      }

      // Use code execution to write file
      const code = `
with open("${path}", "w") as f:
    f.write("""${content}""")
`;
      await sandboxData.sandbox.runCode(code);
      sandboxData.handle.lastActivity = new Date();

      elizaLogger.debug('File written to sandbox', {
        sandboxId,
        path,
        size: content.length,
      });
    } catch (error) {
      elizaLogger.error('Failed to write file to sandbox', error);
      throw error;
    }
  }

  async readFileFromSandbox(sandboxId: string, path: string): Promise<string> {
    try {
      const sandboxData = this.sandboxPool.get(sandboxId);
      if (!sandboxData) {
        throw new Error(`Sandbox ${sandboxId} not found`);
      }

      // Use code execution to read file
      const code = `
with open("${path}", "r") as f:
    content = f.read()
print(content)
`;
      const result = await sandboxData.sandbox.runCode(code);
      const content = result.logs?.stdout?.join('\n') || '';
      sandboxData.handle.lastActivity = new Date();

      elizaLogger.debug('File read from sandbox', {
        sandboxId,
        path,
        size: content.length,
      });
      return content;
    } catch (error) {
      elizaLogger.error('Failed to read file from sandbox', error);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.isHealthyStatus;
  }
}
