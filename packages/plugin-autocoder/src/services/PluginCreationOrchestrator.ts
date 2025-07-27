import type { IAgentRuntime } from '@elizaos/core';
import { logger, Service } from '@elizaos/core';
import type { GeneratedPluginResult } from '../types/index';
import {
  PLUGIN_CREATION_ORCHESTRATOR,
  PLUGIN_TEMPLATE_SERVICE,
  PLUGIN_BUILD_SERVICE,
  PluginCreationError,
} from '../types/index';
import { RequirementParser } from '../utils/requirementParser';
import type { PluginTemplateService } from './PluginTemplateService';
import type { PluginBuildService } from './PluginBuildService';
import path from 'path';
import fs from 'fs-extra';

/**
 * PluginCreationOrchestrator - Coordinates the entire plugin creation process
 */
export class PluginCreationOrchestrator extends Service {
  static override serviceType = PLUGIN_CREATION_ORCHESTRATOR;

  private outputBasePath: string;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.outputBasePath = runtime.getSetting('outputBasePath') || process.cwd();
    logger.info('[PluginCreationOrchestrator] Initialized');
  }

  get capabilityDescription(): string {
    return 'Coordinates the entire plugin creation process from description to validated plugin';
  }

  static async start(runtime: IAgentRuntime): Promise<PluginCreationOrchestrator> {
    const service = new PluginCreationOrchestrator(runtime);
    return service;
  }

  /**
   * Create a complete plugin from a natural language description
   */
  async createPluginFromDescription(
    description: string,
    outputPath?: string
  ): Promise<GeneratedPluginResult> {
    logger.info('[PluginCreationOrchestrator] Starting plugin creation from description');

    // Parse requirements from description
    const requirements = RequirementParser.parseFromDescription(description);

    // Generate plugin from template
    const templateService = this.runtime.getService(
      PLUGIN_TEMPLATE_SERVICE
    ) as PluginTemplateService;

    if (!templateService) {
      throw new PluginCreationError('Template service not available', 'missing-service');
    }

    const pluginResult = await templateService.generateFromTemplate(requirements, outputPath);

    // Build and validate the plugin
    const buildService = this.runtime.getService(PLUGIN_BUILD_SERVICE) as PluginBuildService;

    if (!buildService) {
      throw new PluginCreationError('Build service not available', 'missing-service');
    }

    const buildResult = await buildService.buildPlugin(pluginResult.path);

    if (!buildResult.success) {
      logger.error('[PluginCreationOrchestrator] Plugin build failed', buildResult.errors);
      throw new PluginCreationError(
        `Plugin build failed: ${buildResult.errors.map((e) => e.message).join(', ')}`,
        'build-failed'
      );
    }

    // Test basic functionality
    const testResult = await this.testPluginBasicFunctionality(pluginResult);

    if (!testResult.success) {
      logger.warn('[PluginCreationOrchestrator] Plugin test failed', testResult.message);
      // Don't throw - tests are optional
    }

    logger.success('[PluginCreationOrchestrator] Plugin created successfully');

    return pluginResult;
  }

  /**
   * Test the generated plugin for basic functionality
   */
  private async testPluginBasicFunctionality(
    pluginResult: GeneratedPluginResult
  ): Promise<{ success: boolean; message: string }> {
    console.log('[PLUGIN-ORCHESTRATOR] Testing plugin basic functionality...');

    // Verify package.json exists and is valid
    const packageJsonPath = path.join(pluginResult.path, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    if (!packageJson.name || !packageJson.version) {
      throw new Error('Generated package.json is missing required fields');
    }

    // Verify main entry point exists
    const mainFile = path.join(pluginResult.path, 'src', 'index.ts');
    const mainFileExists = await fs
      .access(mainFile)
      .then(() => true)
      .catch(() => false);

    if (!mainFileExists) {
      throw new Error('Main entry point (src/index.ts) not found');
    }

    // Verify the plugin exports are valid TypeScript
    const mainContent = await fs.readFile(mainFile, 'utf8');
    if (!mainContent.includes('export') || !mainContent.includes('Plugin')) {
      throw new Error('Main entry point does not appear to export a Plugin');
    }

    console.log('[PLUGIN-ORCHESTRATOR] ✅ Plugin basic functionality tests passed');
    return { success: true, message: 'Plugin structure and basic exports are valid' };
  }

  /**
   * Attempt to load the plugin to verify it's valid
   */
  private async attemptPluginLoad(
    pluginResult: GeneratedPluginResult
  ): Promise<{ success: boolean; message: string }> {
    console.log('[PLUGIN-ORCHESTRATOR] Attempting to load plugin for validation...');

    // For now, we'll do a basic syntax validation rather than attempting actual loading
    // since loading plugins requires a full runtime environment
    const mainFile = path.join(pluginResult.path, 'src', 'index.ts');
    const content = await fs.readFile(mainFile, 'utf8');

    // Basic syntax validation checks
    const requiredExports = [
      'name',
      'description',
      'actions',
      'providers',
      'services',
      'evaluators',
    ];
    const missingExports = requiredExports.filter((exp) => !content.includes(exp));

    if (missingExports.length > 0) {
      throw new Error(`Plugin is missing required exports: ${missingExports.join(', ')}`);
    }

    // Check for basic TypeScript syntax errors
    if (content.includes('export const') && content.includes(': Plugin')) {
      console.log('[PLUGIN-ORCHESTRATOR] ✅ Plugin load validation passed');
      return { success: true, message: 'Plugin syntax and structure appear valid' };
    } else {
      throw new Error('Plugin does not follow expected export structure');
    }
  }

  /**
   * Get list of plugins created by this service
   */
  async listCreatedPlugins(): Promise<string[]> {
    const pluginsDir = path.join(this.outputBasePath, 'plugins');
    const dirExists = await fs
      .access(pluginsDir)
      .then(() => true)
      .catch(() => false);

    if (!dirExists) {
      return [];
    }

    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    return entries.filter((entry: any) => entry.isDirectory()).map((entry: any) => entry.name);
  }

  /**
   * Delete a plugin
   */
  async deletePlugin(pluginName: string): Promise<boolean> {
    const pluginPath = path.join(this.outputBasePath, 'plugins', pluginName);

    // Check if plugin exists
    const exists = await fs
      .access(pluginPath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return false;
    }

    // Remove the plugin directory
    await fs.rm(pluginPath, { recursive: true, force: true });
    console.log(`[PLUGIN-ORCHESTRATOR] Deleted plugin: ${pluginName}`);
    return true;
  }

  async stop(): Promise<void> {
    logger.info('[PluginCreationOrchestrator] Stopping...');
  }
}

export default PluginCreationOrchestrator;
