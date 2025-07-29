// Note: E2B CodeInterpreter import - may require installation
// import { CodeInterpreter } from '@e2b/code-interpreter'

// Temporary placeholder for CodeInterpreter
const CodeInterpreter = {
  create: async (config: any) => {
    // Placeholder implementation - would need actual E2B package
    throw new Error(
      'E2B CodeInterpreter not available. Install @e2b/code-interpreter package.',
    );
  },
};
import { randomUUID } from 'crypto';

interface ContainerSession {
  id: string;
  projectId: string;
  userId: string;
  interpreter: any | null;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'terminated';
  createdAt: Date;
  lastActivity: Date;
  files: Map<string, string>;
  environment: {
    nodejs: boolean;
    typescript: boolean;
    dependencies: string[];
  };
}

interface BuildExecutionRequest {
  projectId: string;
  userId: string;
  files: Record<string, string>;
  packageJson: any;
  buildCommands: string[];
  testCommands: string[];
}

interface BuildExecutionResult {
  success: boolean;
  buildLogs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    source: string;
  }>;
  testResults?: {
    passed: number;
    failed: number;
    total: number;
    coverage: number;
    details: Array<{
      name: string;
      status: 'passed' | 'failed' | 'skipped';
      message?: string;
      duration: number;
    }>;
  };
  artifacts?: {
    distFiles: Record<string, string>;
    packageBundle?: Buffer;
    documentation?: string;
  };
  error?: string;
}

interface LiveTestingSession {
  sessionId: string;
  projectId: string;
  interpreter: any;
  status: 'active' | 'paused' | 'terminated';
  lastCommand?: string;
  output: Array<{
    type: 'input' | 'output' | 'error';
    content: string;
    timestamp: Date;
  }>;
}

export class E2BContainerService {
  private static instance: E2BContainerService;
  private sessions: Map<string, ContainerSession> = new Map();
  private liveTestingSessions: Map<string, LiveTestingSession> = new Map();
  private apiKey: string;
  private maxConcurrentSessions = 5;
  private sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.apiKey = process.env.E2B_API_KEY || '';
    if (!this.apiKey) {
      console.warn(
        'E2B_API_KEY not found. Container features will be disabled.',
      );
    }
    this.startCleanup();
  }

  static getInstance(): E2BContainerService {
    if (!E2BContainerService.instance) {
      E2BContainerService.instance = new E2BContainerService();
    }
    return E2BContainerService.instance;
  }

  async createSession(projectId: string, userId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('E2B API key not configured');
    }

    // Check session limits
    const userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId && s.status !== 'terminated',
    );

    if (userSessions.length >= this.maxConcurrentSessions) {
      throw new Error('Maximum number of concurrent sessions reached');
    }

    const sessionId = randomUUID();

    const session: ContainerSession = {
      id: sessionId,
      projectId,
      userId,
      interpreter: null,
      status: 'initializing',
      createdAt: new Date(),
      lastActivity: new Date(),
      files: new Map(),
      environment: {
        nodejs: true,
        typescript: true,
        dependencies: [],
      },
    };

    this.sessions.set(sessionId, session);

    try {
      // Initialize E2B Code Interpreter
      const interpreter = await CodeInterpreter.create({
        apiKey: this.apiKey,
        metadata: {
          projectId,
          userId,
          sessionId,
        },
      });

      session.interpreter = interpreter;
      session.status = 'ready';

      // Set up basic Node.js environment
      await this.setupEnvironment(session);

      console.log(`E2B session ${sessionId} created for project ${projectId}`);
      return sessionId;
    } catch (error) {
      session.status = 'error';
      console.error('Failed to create E2B session:', error);
      throw new Error(
        `Failed to create container session: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async executeCodeBuild(
    sessionId: string,
    request: BuildExecutionRequest,
  ): Promise<BuildExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.interpreter) {
      throw new Error('Session not found or not ready');
    }

    if (session.status !== 'ready') {
      throw new Error(`Session is not ready (status: ${session.status})`);
    }

    session.status = 'busy';
    session.lastActivity = new Date();

    const buildLogs: Array<any> = [];
    const logMessage = (level: string, message: string, source = 'e2b') => {
      const logEntry = {
        timestamp: new Date(),
        level: level as any,
        message,
        source,
      };
      buildLogs.push(logEntry);
      console.log(`[${level.toUpperCase()}] ${source}: ${message}`);
    };

    try {
      logMessage('info', 'Starting build execution in container environment');

      // 1. Upload all files to the container
      logMessage('info', 'Uploading project files to container...');
      await this.uploadFiles(session, request.files);

      // 2. Create package.json
      logMessage('info', 'Setting up package.json and dependencies...');
      await session.interpreter.notebook.execCell({
        code: `
import json
package_json = ${JSON.stringify(request.packageJson, null, 2)}
with open('package.json', 'w') as f:
    json.dump(package_json, f, indent=2)
print("✅ package.json created")
        `,
      });

      // 3. Install dependencies
      logMessage('info', 'Installing dependencies...');
      const installResult = await session.interpreter.notebook.execCell({
        code: `
import subprocess
import sys

def run_command(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=300)
        print(f"Command: {cmd}")
        print(f"Exit code: {result.returncode}")
        if result.stdout:
            print(f"STDOUT:\\n{result.stdout}")
        if result.stderr:
            print(f"STDERR:\\n{result.stderr}")
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        print(f"Command timed out: {cmd}")
        return False, "", "Command timed out"
    except Exception as e:
        print(f"Error running command: {e}")
        return False, "", str(e)

# Install Node.js dependencies
success, stdout, stderr = run_command("npm install")
if not success:
    print("❌ npm install failed")
    sys.exit(1)
else:
    print("✅ Dependencies installed successfully")
        `,
      });

      if (installResult.error) {
        throw new Error(
          `Dependency installation failed: ${installResult.error}`,
        );
      }

      // 4. Run build commands
      logMessage('info', 'Executing build commands...');
      for (const command of request.buildCommands) {
        logMessage('info', `Running: ${command}`);

        const buildResult = await session.interpreter.notebook.execCell({
          code: `
success, stdout, stderr = run_command("${command}")
if not success:
    print(f"❌ Build command failed: ${command}")
    print(f"Error: {stderr}")
else:
    print(f"✅ Build command completed: ${command}")
          `,
        });

        if (buildResult.error) {
          logMessage('error', `Build command failed: ${command}`);
          throw new Error(`Build failed: ${buildResult.error}`);
        }
      }

      // 5. Run tests
      logMessage('info', 'Running test suite...');
      let testResults = undefined;

      if (request.testCommands.length > 0) {
        for (const testCommand of request.testCommands) {
          logMessage('info', `Running tests: ${testCommand}`);

          const testResult = await session.interpreter.notebook.execCell({
            code: `
import json
import re

# Run tests and capture results
success, stdout, stderr = run_command("${testCommand}")

# Parse test results (simplified for Jest/npm test)
test_output = stdout + stderr
passed_match = re.search(r'(\\d+) passing', test_output)
failed_match = re.search(r'(\\d+) failing', test_output)

passed = int(passed_match.group(1)) if passed_match else 0
failed = int(failed_match.group(1)) if failed_match else 0
total = passed + failed

# Extract coverage if available
coverage_match = re.search(r'All files\\s+\\|\\s+([\\d.]+)', test_output)
coverage = float(coverage_match.group(1)) if coverage_match else 0

test_results = {
    "passed": passed,
    "failed": failed,
    "total": total,
    "coverage": coverage,
    "details": [],
    "success": success
}

print(f"✅ Tests completed: {passed} passed, {failed} failed")
print(f"Coverage: {coverage}%")
print(json.dumps(test_results))
            `,
          });

          // Parse test results from the output
          try {
            const output = testResult.logs?.[0]?.content || '';
            const jsonMatch = output.match(/\{.*\}/);
            if (jsonMatch) {
              const parsedResults = JSON.parse(jsonMatch[0]);
              testResults = {
                passed: parsedResults.passed || 0,
                failed: parsedResults.failed || 0,
                total: parsedResults.total || 0,
                coverage: parsedResults.coverage || 0,
                details: [],
              };
            }
          } catch (error) {
            logMessage('warn', 'Could not parse test results, using defaults');
            testResults = {
              passed: 0,
              failed: 0,
              total: 0,
              coverage: 0,
              details: [],
            };
          }
        }
      }

      // 6. Collect build artifacts
      logMessage('info', 'Collecting build artifacts...');
      const artifacts = await this.collectArtifacts(session);

      session.status = 'ready';
      logMessage('info', '🎉 Build execution completed successfully!');

      return {
        success: true,
        buildLogs,
        testResults,
        artifacts,
      };
    } catch (error) {
      session.status = 'ready';
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logMessage('error', `Build execution failed: ${errorMessage}`);

      return {
        success: false,
        buildLogs,
        error: errorMessage,
      };
    }
  }

  async createLiveTestingSession(
    projectId: string,
    files: Record<string, string>,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('E2B API key not configured');
    }

    const sessionId = randomUUID();

    try {
      const interpreter = await CodeInterpreter.create({
        apiKey: this.apiKey,
        metadata: {
          projectId,
          sessionId,
          type: 'live-testing',
        },
      });

      // Upload files for testing
      for (const [filename, content] of Object.entries(files)) {
        await (interpreter as any).notebook.execCell({
          code: `
with open('${filename}', 'w') as f:
    f.write("""${content.replace(/"/g, '\\"')}""")
print(f"✅ Uploaded {filename}")
          `,
        });
      }

      const liveSession: LiveTestingSession = {
        sessionId,
        projectId,
        interpreter,
        status: 'active',
        output: [
          {
            type: 'output',
            content:
              '🚀 Live testing session ready! You can now run commands to test your plugin.',
            timestamp: new Date(),
          },
        ],
      };

      this.liveTestingSessions.set(sessionId, liveSession);

      console.log(
        `Live testing session ${sessionId} created for project ${projectId}`,
      );
      return sessionId;
    } catch (error) {
      console.error('Failed to create live testing session:', error);
      throw new Error(
        `Failed to create live testing session: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async executeLiveCommand(
    sessionId: string,
    command: string,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const session = this.liveTestingSessions.get(sessionId);
    if (!session) {
      throw new Error('Live testing session not found');
    }

    if (session.status !== 'active') {
      throw new Error('Live testing session is not active');
    }

    try {
      session.lastCommand = command;
      session.output.push({
        type: 'input',
        content: command,
        timestamp: new Date(),
      });

      const result = await session.interpreter.notebook.execCell({
        code: command,
      });

      const output =
        result.logs?.map((log: any) => log.content).join('\n') || '';
      const error = result.error;

      session.output.push({
        type: error ? 'error' : 'output',
        content: error || output,
        timestamp: new Date(),
      });

      return {
        success: !error,
        output: error || output,
        error,
      };
    } catch (error) {
      const errorMessage = `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`;

      session.output.push({
        type: 'error',
        content: errorMessage,
        timestamp: new Date(),
      });

      return {
        success: false,
        output: '',
        error: errorMessage,
      };
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        if (session.interpreter) {
          await session.interpreter.close();
        }
        session.status = 'terminated';
        this.sessions.delete(sessionId);
        console.log(`E2B session ${sessionId} terminated`);
      } catch (error) {
        console.error(`Failed to terminate session ${sessionId}:`, error);
      }
    }

    const liveSession = this.liveTestingSessions.get(sessionId);
    if (liveSession) {
      try {
        await liveSession.interpreter.close();
        liveSession.status = 'terminated';
        this.liveTestingSessions.delete(sessionId);
        console.log(`Live testing session ${sessionId} terminated`);
      } catch (error) {
        console.error(`Failed to terminate live session ${sessionId}:`, error);
      }
    }
  }

  private async setupEnvironment(session: ContainerSession): Promise<void> {
    if (!session.interpreter) {
      return;
    }

    // Set up Node.js and TypeScript environment
    await session.interpreter.notebook.execCell({
      code: `
import subprocess
import os

# Ensure Node.js and npm are available
try:
    subprocess.run(['node', '--version'], check=True)
    subprocess.run(['npm', '--version'], check=True)
    print("✅ Node.js and npm are available")
except subprocess.CalledProcessError:
    print("❌ Node.js or npm not found")

# Set up TypeScript globally
try:
    subprocess.run(['npm', 'install', '-g', 'typescript'], check=True)
    print("✅ TypeScript installed globally")
except subprocess.CalledProcessError:
    print("⚠️ Failed to install TypeScript globally")

# Create working directory
os.makedirs('/workspace', exist_ok=True)
os.chdir('/workspace')
print("✅ Working directory set up at /workspace")
      `,
    });
  }

  private async uploadFiles(
    session: ContainerSession,
    files: Record<string, string>,
  ): Promise<void> {
    if (!session.interpreter) {
      return;
    }

    for (const [filename, content] of Object.entries(files)) {
      // Create directory structure if needed
      const dir = filename.substring(0, filename.lastIndexOf('/'));
      if (dir) {
        await session.interpreter.notebook.execCell({
          code: `
import os
os.makedirs('${dir}', exist_ok=True)
          `,
        });
      }

      // Upload file content
      await session.interpreter.notebook.execCell({
        code: `
with open('${filename}', 'w', encoding='utf-8') as f:
    f.write("""${content.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}""")
print(f"✅ Uploaded {filename}")
        `,
      });

      session.files.set(filename, content);
    }
  }

  private async collectArtifacts(session: ContainerSession): Promise<any> {
    if (!session.interpreter) {
      return {};
    }

    try {
      // Collect built files
      const artifactResult = await session.interpreter.notebook.execCell({
        code: `
import os
import json
import base64

artifacts = {
    'distFiles': {},
    'documentation': ''
}

# Collect dist files
if os.path.exists('dist'):
    for root, dirs, files in os.walk('dist'):
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, 'dist')
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    artifacts['distFiles'][rel_path] = f.read()
            except:
                # Binary file, encode as base64
                with open(file_path, 'rb') as f:
                    artifacts['distFiles'][rel_path] = base64.b64encode(f.read()).decode('utf-8')

# Collect README if exists
if os.path.exists('README.md'):
    with open('README.md', 'r', encoding='utf-8') as f:
        artifacts['documentation'] = f.read()

print(json.dumps(artifacts))
        `,
      });

      // Parse artifacts from output
      const output = artifactResult.logs?.[0]?.content || '{}';
      try {
        return JSON.parse(output);
      } catch (error) {
        console.warn('Failed to parse artifacts:', error);
        return {};
      }
    } catch (error) {
      console.error('Failed to collect artifacts:', error);
      return {};
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupStaleSession();
      },
      5 * 60 * 1000,
    ); // Check every 5 minutes
  }

  private async cleanupStaleSession(): Promise<void> {
    const now = new Date();

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();

      if (timeSinceActivity > this.sessionTimeoutMs) {
        console.log(`Cleaning up stale session ${sessionId}`);
        await this.terminateSession(sessionId);
      }
    }

    for (const [sessionId, session] of this.liveTestingSessions.entries()) {
      const timeSinceCreated =
        now.getTime() - session.output[0]?.timestamp.getTime();

      if (timeSinceCreated > this.sessionTimeoutMs) {
        console.log(`Cleaning up stale live testing session ${sessionId}`);
        await this.terminateSession(sessionId);
      }
    }
  }

  async getSessionStatus(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (session) {
      return {
        id: session.id,
        projectId: session.projectId,
        status: session.status,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        fileCount: session.files.size,
      };
    }

    const liveSession = this.liveTestingSessions.get(sessionId);
    if (liveSession) {
      return {
        id: liveSession.sessionId,
        projectId: liveSession.projectId,
        status: liveSession.status,
        outputCount: liveSession.output.length,
        lastCommand: liveSession.lastCommand,
      };
    }

    return null;
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Terminate all sessions
    const terminationPromises = [];

    for (const sessionId of this.sessions.keys()) {
      terminationPromises.push(this.terminateSession(sessionId));
    }

    for (const sessionId of this.liveTestingSessions.keys()) {
      terminationPromises.push(this.terminateSession(sessionId));
    }

    await Promise.all(terminationPromises);

    console.log('E2B Container Service shut down');
  }
}
