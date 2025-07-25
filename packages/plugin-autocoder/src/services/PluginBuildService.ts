import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import {
  PLUGIN_BUILD_SERVICE,
  type BuildResult,
  type BuildError,
  PluginCreationError,
} from '../types/index';

/**
 * PluginBuildService - Validates plugins with real TypeScript compilation and testing
 */
export class PluginBuildService extends Service {
  static override serviceType = PLUGIN_BUILD_SERVICE;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    logger.info('[PluginBuildService] Initialized');
  }

  get capabilityDescription(): string {
    return 'Validates plugins with real TypeScript compilation and testing';
  }

  static async start(runtime: IAgentRuntime): Promise<PluginBuildService> {
    const service = new PluginBuildService(runtime);
    return service;
  }

  /**
   * Build and validate a plugin with real TypeScript compilation
   */
  async buildPlugin(pluginPath: string): Promise<BuildResult> {
    console.log(`[BUILD_SERVICE] Starting build for plugin at: ${pluginPath}`);

    const errors: BuildError[] = [];
    const startTime = Date.now();

    // Check if path exists
    if (!fs.existsSync(pluginPath)) {
      throw new Error(`Plugin path does not exist: ${pluginPath}`);
    }

    // Check for package.json
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('No package.json found in plugin directory');
    }

    // Install dependencies
    console.log('[BUILD_SERVICE] Installing dependencies...');
    const installResult = await this.installDependencies(pluginPath);
    if (!installResult.success) {
      errors.push(...installResult.errors);
    }

    // Run TypeScript compilation
    console.log('[BUILD_SERVICE] Running TypeScript compilation...');
    const compileResult = await this.runTypeScriptCompilation(pluginPath);
    if (!compileResult.success) {
      errors.push(...compileResult.errors);
    }

    // Run tests if they exist
    const hasTests =
      fs.existsSync(path.join(pluginPath, 'src', '__tests__')) ||
      fs.existsSync(path.join(pluginPath, 'test')) ||
      fs.existsSync(path.join(pluginPath, 'tests'));

    if (hasTests) {
      console.log('[BUILD_SERVICE] Running tests...');
      const testResult = await this.runTests(pluginPath);
      if (!testResult.success) {
        errors.push(...testResult.errors);
      }
    }

    // Run security validation
    console.log('[BUILD_SERVICE] Running security validation...');
    const securityResult = await this.runSecurityValidation(pluginPath);
    if (!securityResult.success) {
      errors.push(...securityResult.errors);
    }

    const buildTime = Date.now() - startTime;
    const success = errors.length === 0;

    console.log(`[BUILD_SERVICE] Build ${success ? 'succeeded' : 'failed'} in ${buildTime}ms`);

    return {
      success,
      errors,
      warnings: [],
      outputs: [],
    };
  }

  /**
   * Install plugin dependencies
   */
  private async installDependencies(pluginPath: string): Promise<{
    success: boolean;
    output: string;
    errors: BuildError[];
  }> {
    // FAIL FAST - no try-catch
    // Check if package.json exists
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (!(await fs.pathExists(packageJsonPath))) {
      throw new Error('package.json not found');
    }

    // Run npm install
    const { stdout, stderr } = await execa('npm', ['install'], {
      cwd: pluginPath,
      timeout: 60000, // 1 minute timeout
    });

    return {
      success: true,
      output: `Dependencies installed:\n${stdout}${stderr ? '\n' + stderr : ''}`,
      errors: [],
    };
  }

  /**
   * Run TypeScript compilation
   */
  private async runTypeScriptCompilation(pluginPath: string): Promise<{
    success: boolean;
    output: string;
    errors: BuildError[];
  }> {
    // FAIL FAST - no try-catch
    // Check if tsconfig.json exists
    const tsconfigPath = path.join(pluginPath, 'tsconfig.json');
    if (!(await fs.pathExists(tsconfigPath))) {
      // Create a basic tsconfig.json
      const basicTsConfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'node',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          outDir: 'dist',
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      };

      await fs.writeJson(tsconfigPath, basicTsConfig, { spaces: 2 });
    }

    // FAIL FAST - check local TypeScript
    // Check if local typescript exists
    const localTscPath = path.join(pluginPath, 'node_modules/.bin/tsc');
    let tscCommand = 'npx';
    let tscArgs = ['tsc', '--noEmit'];

    if (await fs.pathExists(localTscPath)) {
      tscCommand = localTscPath;
      tscArgs = ['--noEmit'];
    }

    const { stdout, stderr } = await execa(tscCommand, tscArgs, {
      cwd: pluginPath,
      timeout: 30000, // 30 seconds timeout
    });

    return {
      success: true,
      output: `TypeScript compilation successful:\n${stdout}${stderr ? '\n' + stderr : ''}`,
      errors: [],
    };
  }

  /**
   * Parse TypeScript compilation errors
   */
  private parseTypeScriptErrors(errorOutput: string): BuildError[] {
    const errors: BuildError[] = [];
    const lines = errorOutput.split('\n');

    for (const line of lines) {
      // Parse TypeScript error format: file(line,column): error TS####: message
      const match = line.match(/^(.+)\\((\\d+),(\\d+)\\):\\s*error\\s+TS\\d+:\\s*(.+)$/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[4],
          type: 'typescript',
        });
      }
    }

    // If no structured errors found, create a generic one
    if (errors.length === 0 && errorOutput.trim()) {
      errors.push({
        file: 'unknown',
        line: 0,
        column: 0,
        message: errorOutput.trim(),
        type: 'typescript',
      });
    }

    return errors;
  }

  /**
   * Run plugin tests
   */
  private async runTests(pluginPath: string): Promise<{
    success: boolean;
    output: string;
    errors: BuildError[];
  }> {
    // FAIL FAST - no try-catch
    const packageJsonPath = path.join(pluginPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    // Check if test script exists
    if (!packageJson.scripts?.test) {
      return {
        success: true,
        output: 'No test script found - skipping tests',
        errors: [],
      };
    }

    const { stdout, stderr } = await execa('npm', ['test'], {
      cwd: pluginPath,
      timeout: 30000, // 30 seconds timeout
    });

    return {
      success: true,
      output: `Tests passed:\n${stdout}${stderr ? '\n' + stderr : ''}`,
      errors: [],
    };
  }

  /**
   * Parse test errors
   */
  private parseTestErrors(errorOutput: string): BuildError[] {
    const errors: BuildError[] = [];

    // This is a simplified parser - could be enhanced for specific test frameworks
    if (errorOutput.includes('FAIL') || errorOutput.includes('failing')) {
      errors.push({
        file: 'test',
        line: 0,
        column: 0,
        message: 'One or more tests failed',
        type: 'test',
      });
    }

    return errors;
  }

  /**
   * Run basic security validation
   */
  private async runSecurityValidation(pluginPath: string): Promise<{
    success: boolean;
    output: string;
    errors: BuildError[];
  }> {
    const warnings: BuildError[] = [];
    const outputs: string[] = [];

    // FAIL FAST - no try-catch
    // Check for common security issues

    // 1. Check for hardcoded secrets
    const srcPath = path.join(pluginPath, 'src');
    if (await fs.pathExists(srcPath)) {
      const files = await fs.readdir(srcPath, { recursive: true });

      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.js'))) {
          const filePath = path.join(srcPath, file);
          const content = await fs.readFile(filePath, 'utf-8');

          // Check for potential secrets
          const secretPatterns = [
            /api[_-]?key['"]\s*:\s*['"][^'"]{20,}/i,
            /password['"]\s*:\s*['"][^'"]*/i,
            /secret['"]\s*:\s*['"][^'"]*/i,
            /token['"]\s*:\s*['"][^'"]{20,}/i,
          ];

          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              warnings.push({
                file: file,
                line: 0,
                column: 0,
                message: 'Potential hardcoded secret detected',
                type: 'runtime',
              });
            }
          }
        }
      }
    }

    // 2. Check dependencies for known vulnerabilities (simplified)
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);

      // Check for suspicious dependencies
      const suspiciousDeps = ['eval', 'vm2', 'node-pty'];
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const dep of Object.keys(deps || {})) {
        if (suspiciousDeps.some((suspicious) => dep.includes(suspicious))) {
          warnings.push({
            file: 'package.json',
            line: 0,
            column: 0,
            message: `Potentially unsafe dependency: ${dep}`,
            type: 'runtime',
          });
        }
      }
    }

    outputs.push(`Security validation completed. ${warnings.length} warnings found.`);

    return {
      success: true,
      output: outputs.join('\n'),
      errors: warnings,
    };
  }

  async stop(): Promise<void> {
    logger.info('[PluginBuildService] Stopping...');
  }
}

export default PluginBuildService;
