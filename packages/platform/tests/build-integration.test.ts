/**
 * Build Integration Tests
 * Tests that verify build artifacts and deployment processes work correctly
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_TIMEOUT = 300000; // 5 minutes for build tests

describe('Platform Build Integration', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const tauriRoot = path.resolve(__dirname, '../../platform-native');

  describe('Web Platform Build', () => {
    test(
      'should build web platform successfully',
      async () => {
        const buildResult = await runCommand('npm', ['run', 'build'], {
          cwd: projectRoot,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            BUILD_MODE: 'default',
          },
        });

        expect(buildResult.exitCode).toBe(0);

        // Verify build artifacts exist
        const buildDir = path.join(projectRoot, '.next');
        const buildExists = await fileExists(buildDir);
        expect(buildExists).toBe(true);

        // Check for essential build files
        const essentialFiles = [
          '.next/BUILD_ID',
          '.next/static',
          '.next/server',
        ];

        for (const file of essentialFiles) {
          const filePath = path.join(projectRoot, file);
          const exists = await fileExists(filePath);
          expect(exists).toBe(true);
        }
      },
      TEST_TIMEOUT,
    );

    test(
      'should build static export for Tauri',
      async () => {
        const buildResult = await runCommand('npm', ['run', 'build'], {
          cwd: projectRoot,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            BUILD_MODE: 'export',
          },
        });

        expect(buildResult.exitCode).toBe(0);

        // Verify static export artifacts exist
        const outDir = path.join(projectRoot, 'out');
        const outExists = await fileExists(outDir);
        expect(outExists).toBe(true);

        // Check for essential static files
        const essentialFiles = [
          'out/index.html',
          'out/app-lander/index.html',
          'out/_next/static',
        ];

        for (const file of essentialFiles) {
          const filePath = path.join(projectRoot, file);
          const exists = await fileExists(filePath);
          expect(exists).toBe(true);
        }

        // Verify PWA files are included
        const pwaFiles = ['out/manifest.json', 'out/sw.js'];

        for (const file of pwaFiles) {
          const filePath = path.join(projectRoot, file);
          const exists = await fileExists(filePath);
          expect(exists).toBe(true);
        }
      },
      TEST_TIMEOUT,
    );

    test('should generate correct PWA manifest', async () => {
      const manifestPath = path.join(projectRoot, 'public/manifest.json');
      const manifestExists = await fileExists(manifestPath);
      expect(manifestExists).toBe(true);

      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.name).toBe('ElizaOS Platform');
      expect(manifest.short_name).toBe('ElizaOS');
      expect(manifest.start_url).toBe('/app-lander');
      expect(manifest.display).toBe('standalone');
      expect(manifest.icons).toHaveLength(8);
      expect(manifest.shortcuts).toHaveLength(2);
    });
  });

  describe('Tauri App Build', () => {
    test('should verify Tauri configuration', async () => {
      const configPath = path.join(tauriRoot, 'tauri.conf.json');
      const configExists = await fileExists(configPath);
      expect(configExists).toBe(true);

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.productName).toBe('ElizaOS Platform');
      expect(config.identifier).toBe('com.elizaos.platform');
      expect(config.plugins).toContain('store');
      expect(config.plugins.some((p: any) => p['deep-link'])).toBe(true);
    });

    test('should verify Rust dependencies', async () => {
      const cargoPath = path.join(tauriRoot, 'src-tauri/Cargo.toml');
      const cargoExists = await fileExists(cargoPath);
      expect(cargoExists).toBe(true);

      const cargoContent = await fs.readFile(cargoPath, 'utf-8');

      expect(cargoContent).toContain('tauri =');
      expect(cargoContent).toContain('tauri-plugin-store =');
      expect(cargoContent).toContain('tauri-plugin-deep-link =');
      expect(cargoContent).toContain('serde_json =');
    });

    test('should check prerequisites for Tauri build', async () => {
      // Check if Rust is available
      try {
        const rustCheck = await runCommand('rustc', ['--version']);
        expect(rustCheck.exitCode).toBe(0);
      } catch (error) {
        console.warn('Rust not available, skipping Tauri build tests');
        return;
      }

      // Check if Tauri CLI is available
      try {
        const tauriCheck = await runCommand('npx', ['tauri', '--version'], {
          cwd: tauriRoot,
        });
        expect(tauriCheck.exitCode).toBe(0);
      } catch (error) {
        console.warn('Tauri CLI not available, skipping Tauri build tests');
      }
    });

    test(
      'should build platform for Tauri consumption',
      async () => {
        // First build the platform in export mode
        const platformBuild = await runCommand('npm', ['run', 'build'], {
          cwd: tauriRoot,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            BUILD_MODE: 'export',
          },
        });

        expect(platformBuild.exitCode).toBe(0);

        // Verify dist directory is populated
        const distDir = path.join(tauriRoot, 'dist');
        const distExists = await fileExists(distDir);
        expect(distExists).toBe(true);

        // Check for essential files in dist
        const essentialFiles = [
          'dist/index.html',
          'dist/app-lander/index.html',
        ];

        for (const file of essentialFiles) {
          const filePath = path.join(tauriRoot, file);
          const exists = await fileExists(filePath);
          expect(exists).toBe(true);
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe('Deployment Scripts', () => {
    test('should have deployment scripts configured', async () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const deploymentScripts = [
        'deploy',
        'deploy:vercel',
        'deploy:netlify',
        'deploy:static',
        'docker:build',
        'docker:run',
        'docker:compose',
      ];

      for (const script of deploymentScripts) {
        expect(packageJson.scripts[script]).toBeDefined();
      }
    });

    test('should validate Docker configuration', async () => {
      const dockerfilePath = path.join(projectRoot, 'Dockerfile');
      const dockerfileExists = await fileExists(dockerfilePath);
      expect(dockerfileExists).toBe(true);

      const dockerComposeePath = path.join(projectRoot, 'docker-compose.yml');
      const dockerComposeExists = await fileExists(dockerComposeePath);
      expect(dockerComposeExists).toBe(true);

      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf-8');
      expect(dockerfileContent).toContain('FROM node:23.3.0-alpine');
      expect(dockerfileContent).toContain('EXPOSE 3000');
    });

    test('should validate Vercel configuration', async () => {
      const vercelPath = path.join(projectRoot, 'vercel.json');
      const vercelExists = await fileExists(vercelPath);
      expect(vercelExists).toBe(true);

      const vercelContent = await fs.readFile(vercelPath, 'utf-8');
      const vercelConfig = JSON.parse(vercelContent);

      expect(vercelConfig.name).toBe('elizaos-platform');
      expect(vercelConfig.builds).toBeDefined();
      expect(vercelConfig.functions).toBeDefined();
    });
  });

  describe('Environment Configuration', () => {
    test('should have environment example file', async () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExampleExists = await fileExists(envExamplePath);
      expect(envExampleExists).toBe(true);

      const envContent = await fs.readFile(envExamplePath, 'utf-8');

      // Check for essential environment variables
      const essentialVars = [
        'WORKOS_API_KEY',
        'WORKOS_CLIENT_ID',
        'JWT_SECRET',
        'NEXT_PUBLIC_APP_URL',
        'NEXT_PUBLIC_WORKOS_CLIENT_ID',
        'TAURI_SIGNING_PRIVATE_KEY',
        'BUILD_MODE',
      ];

      for (const envVar of essentialVars) {
        expect(envContent).toContain(envVar);
      }
    });

    test('should validate environment configuration utility', async () => {
      const envConfigPath = path.join(projectRoot, 'src/lib/env-config.ts');
      const envConfigExists = await fileExists(envConfigPath);
      expect(envConfigExists).toBe(true);

      // Test environment configuration functions
      const { getEnvironmentConfig, validateEnvironment } = await import(
        '../src/lib/env-config'
      );

      const config = getEnvironmentConfig();
      expect(config).toHaveProperty('isTauri');
      expect(config).toHaveProperty('isWeb');
      expect(config).toHaveProperty('apiBaseUrl');
      expect(config).toHaveProperty('workosRedirectUri');

      const validation = validateEnvironment();
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
    });
  });

  describe('CI/CD Configuration', () => {
    test('should have GitHub Actions workflow', async () => {
      const workflowPath = path.join(
        projectRoot,
        '../.github/workflows/platform-deploy.yml',
      );
      const workflowExists = await fileExists(workflowPath);
      expect(workflowExists).toBe(true);

      const workflowContent = await fs.readFile(workflowPath, 'utf-8');

      // Check for essential jobs
      expect(workflowContent).toContain('job: test');
      expect(workflowContent).toContain('job: deploy-web');
      expect(workflowContent).toContain('job: build-tauri');
      expect(workflowContent).toContain('job: release');

      // Check for multi-platform support
      expect(workflowContent).toContain('macos-latest');
      expect(workflowContent).toContain('ubuntu-20.04');
      expect(workflowContent).toContain('windows-latest');
    });
  });
});

// Helper functions
async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      });
    });

    child.on('error', (error) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: error.message,
      });
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
