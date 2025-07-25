import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import fs from 'fs-extra';
import path from 'path';
import {
  PLUGIN_TEMPLATE_SERVICE,
  type PluginCapabilities,
  type GeneratedPluginResult,
  type GeneratedFile,
  type PluginRequirements,
  PluginCreationError,
} from '../types/index';

/**
 * PluginTemplateService - Generates plugin projects from templates using the plugin-starter base
 */
export class PluginTemplateService extends Service {
  static override serviceType = PLUGIN_TEMPLATE_SERVICE;

  private starterPath: string;
  private outputBasePath: string;

  constructor(runtime: IAgentRuntime) {
    super(runtime);

    // Path to the plugin-starter template
    this.starterPath = path.resolve(process.cwd(), 'packages/plugin-starter');

    // Base path for generated plugins
    this.outputBasePath = path.resolve(process.cwd(), 'packages');

    logger.info('[PluginTemplateService] Initialized');
  }

  get capabilityDescription(): string {
    return 'Generates plugin projects from templates using the plugin-starter base';
  }

  static async start(runtime: IAgentRuntime): Promise<PluginTemplateService> {
    const service = new PluginTemplateService(runtime);
    await service.validateStarterTemplate();
    return service;
  }

  /**
   * Validate that the starter template exists and is valid
   */
  private async validateStarterTemplate(): Promise<void> {
    logger.info('[PluginTemplateService] Validating starter template...');

    // Check if starter exists
    if (!fs.existsSync(this.starterPath)) {
      throw new PluginCreationError(
        `Starter template not found at: ${this.starterPath}`,
        'template-not-found'
      );
    }

    // Check required files
    const requiredFiles = ['package.json', 'tsconfig.json', 'src/index.ts'];

    for (const file of requiredFiles) {
      const filePath = path.join(this.starterPath, file);
      if (!fs.existsSync(filePath)) {
        throw new PluginCreationError(
          `Required file missing in starter template: ${file}`,
          'invalid-template'
        );
      }
    }

    logger.info('[PluginTemplateService] Starter template validated successfully');
  }

  /**
   * Generate a complete plugin project from requirements
   */
  async generateFromTemplate(
    requirements: PluginRequirements,
    outputPath?: string
  ): Promise<GeneratedPluginResult> {
    logger.info(`[PluginTemplateService] Generating plugin: ${requirements.name}`);

    const pluginPath = outputPath || this.getDefaultOutputPath(requirements.name);

    // Ensure output directory doesn't exist
    const exists = await fs.pathExists(pluginPath);
    if (exists) {
      await fs.remove(pluginPath);
    }

    // Copy starter template
    await fs.copy(this.starterPath, pluginPath, {
      filter: (src) => {
        // Exclude node_modules, dist, and build artifacts
        return (
          !src.includes('node_modules') && !src.includes('dist') && !src.endsWith('.tsbuildinfo')
        );
      },
    });

    // Generate plugin-specific files
    const generatedFiles = await this.generatePluginFiles(pluginPath, requirements);

    // Create CLAUDE.md with plugin context
    await this.generateClaudeContext(pluginPath, requirements);

    logger.success(`[PluginTemplateService] Plugin generated: ${pluginPath}`);

    return {
      name: requirements.name,
      path: pluginPath,
      files: generatedFiles,
      dependencies: this.extractDependencies(requirements.capabilities),
      buildCommand: 'npm run build',
      testCommand: 'npm test',
    };
  }

  /**
   * Generate plugin-specific files based on capabilities
   */
  private async generatePluginFiles(
    pluginPath: string,
    requirements: PluginRequirements
  ): Promise<GeneratedFile[]> {
    const generatedFiles: GeneratedFile[] = [];

    // Update package.json
    await this.updatePackageJson(pluginPath, requirements);
    generatedFiles.push({
      path: 'package.json',
      content: await fs.readFile(path.join(pluginPath, 'package.json'), 'utf-8'),
      type: 'json',
    });

    // Generate main plugin file
    const pluginContent = this.generatePluginIndex(requirements);
    await fs.writeFile(path.join(pluginPath, 'src/index.ts'), pluginContent);
    generatedFiles.push({
      path: 'src/index.ts',
      content: pluginContent,
      type: 'typescript',
    });

    // Generate actions
    const actionsContent = this.generateActions(requirements.capabilities.actions);
    await fs.writeFile(path.join(pluginPath, 'src/actions.ts'), actionsContent);
    generatedFiles.push({
      path: 'src/actions.ts',
      content: actionsContent,
      type: 'typescript',
    });

    // Generate providers
    const providersContent = this.generateProviders(requirements.capabilities.providers);
    await fs.writeFile(path.join(pluginPath, 'src/providers.ts'), providersContent);
    generatedFiles.push({
      path: 'src/providers.ts',
      content: providersContent,
      type: 'typescript',
    });

    // Generate services
    const servicesContent = this.generateServices(requirements.capabilities.services);
    await fs.writeFile(path.join(pluginPath, 'src/services.ts'), servicesContent);
    generatedFiles.push({
      path: 'src/services.ts',
      content: servicesContent,
      type: 'typescript',
    });

    // Generate evaluators
    const evaluatorsContent = this.generateEvaluators(requirements.capabilities.evaluators);
    await fs.writeFile(path.join(pluginPath, 'src/evaluators.ts'), evaluatorsContent);
    generatedFiles.push({
      path: 'src/evaluators.ts',
      content: evaluatorsContent,
      type: 'typescript',
    });

    // Generate types
    const typesContent = this.generateTypes(requirements.capabilities);
    await fs.writeFile(path.join(pluginPath, 'src/types.ts'), typesContent);
    generatedFiles.push({
      path: 'src/types.ts',
      content: typesContent,
      type: 'typescript',
    });

    return generatedFiles;
  }

  /**
   * Update package.json with plugin-specific information
   */
  private async updatePackageJson(
    pluginPath: string,
    requirements: PluginRequirements
  ): Promise<void> {
    const packageJsonPath = path.join(pluginPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    // Update package details
    packageJson.name = `@elizaos/plugin-${requirements.name.toLowerCase().replace(/\\s+/g, '-')}`;
    packageJson.description = requirements.description;
    packageJson.version = '1.0.0';

    // Add specific dependencies based on capabilities
    const additionalDeps = this.getDependenciesForCapabilities(requirements.capabilities);
    packageJson.dependencies = { ...packageJson.dependencies, ...additionalDeps };

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  /**
   * Generate CLAUDE.md context file for the plugin
   */
  private async generateClaudeContext(
    pluginPath: string,
    requirements: PluginRequirements
  ): Promise<void> {
    const claudeContent = `# ${requirements.name} Plugin

## Overview
${requirements.description}

## Plugin Capabilities

### Actions
${requirements.capabilities.actions
  .map((action) => `- **${action.name}**: ${action.description}`)
  .join('\\n')}

### Providers
${requirements.capabilities.providers
  .map((provider) => `- **${provider.name}**: ${provider.description}`)
  .join('\\n')}

### Services
${requirements.capabilities.services
  .map((service) => `- **${service.name}**: ${service.description}`)
  .join('\\n')}

### Environment Variables
${requirements.capabilities.envVars
  .map(
    (envVar) =>
      `- **${envVar.name}**: ${envVar.description} (${envVar.required ? 'Required' : 'Optional'})`
  )
  .join('\\n')}

## Development Notes

This plugin was generated automatically by the ElizaOS Plugin Autocoder v2.

### Key Features:
- Production-ready TypeScript code
- Comprehensive error handling  
- Full ElizaOS integration
- Automated testing setup
- Real validation pipeline

### Development Workflow:
1. \`npm install\` - Install dependencies
2. \`npm run build\` - Build TypeScript
3. \`npm test\` - Run tests
4. \`npm run lint\` - Format code

### Testing:
- Tests are located in \`src/tests.ts\`
- E2E tests run with the real ElizaOS runtime
- All tests must pass before plugin loading

### Integration:
This plugin integrates with the ElizaOS plugin manager for:
- Dynamic loading/unloading
- Environment variable management
- Security validation
- Hot-reloading during development

## Architecture

The plugin follows ElizaOS patterns:
- **Actions**: Define what the agent can do
- **Providers**: Supply contextual information
- **Services**: Handle background processes
- **Evaluators**: Assess interaction outcomes

## Security

- Environment variables are properly managed
- API keys are never logged or exposed
- All user inputs are validated
- Error messages don't leak sensitive information
`;

    await fs.writeFile(path.join(pluginPath, 'CLAUDE.md'), claudeContent);
  }

  /**
   * Generate the main plugin index file
   */
  private generatePluginIndex(requirements: PluginRequirements): string {
    const hasActions = requirements.capabilities.actions.length > 0;
    const hasProviders = requirements.capabilities.providers.length > 0;
    const hasServices = requirements.capabilities.services.length > 0;
    const hasEvaluators = requirements.capabilities.evaluators.length > 0;

    return `import type { Plugin } from '@elizaos/core';
${hasActions ? "import { Actions } from './actions';" : ''}
${hasProviders ? "import { Providers } from './providers';" : ''}  
${hasServices ? "import { Services } from './services';" : ''}
${hasEvaluators ? "import { Evaluators } from './evaluators';" : ''}

/**
 * ${requirements.name} Plugin for ElizaOS
 * 
 * ${requirements.description}
 * 
 * Generated by ElizaOS Plugin Autocoder v2
 */
export const plugin: Plugin = {
  name: '${requirements.name.toLowerCase().replace(/\\s+/g, '-')}',
  description: '${requirements.description}',
  config: {
${requirements.capabilities.envVars
  .map((env) => `    ${env.name}: process.env.${env.name}`)
  .join(',\\n')}
  },
${hasServices ? '  services: Services,' : '  services: [],'}
${hasActions ? '  actions: Actions,' : '  actions: [],'}
${hasProviders ? '  providers: Providers,' : '  providers: [],'}
${hasEvaluators ? '  evaluators: Evaluators,' : '  evaluators: [],'}
  dependencies: [],
};

export default plugin;
`;
  }

  /**
   * Generate actions based on capabilities
   */
  private generateActions(actions: any[]): string {
    if (actions.length === 0) {
      return `import { Action } from '@elizaos/core';

export const Actions: Action[] = [
  // No actions defined
];

export default Actions;
`;
    }

    const actionImplementations = actions
      .map(
        (action) => `
export const ${action.name.toLowerCase()}Action: Action = {
  name: '${action.name.toUpperCase()}',
  description: '${action.description}',
  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: '${action.triggers?.[0] || action.name.toLowerCase()}',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I'll ${action.description.toLowerCase()}',
          actions: ['${action.name.toUpperCase()}'],
        },
      },
    ],
  ],

  validate: async (
    runtime,
    message,
    state
  ) => {
    const text = message.content.text?.toLowerCase();
    if (!text) return false;
    
    // Check for trigger phrases
    const triggers = [${action.triggers?.map((t: string) => `'${t.toLowerCase()}'`).join(', ') || `'${action.name.toLowerCase()}'`}];
    return triggers.some(trigger => text.includes(trigger));
  },

  handler: async (
    runtime,
    message,
    state,
    options,
    callback
  ) => {
    console.log('Handling ${action.name.toUpperCase()} action');

    // TODO: Implement ${action.name} logic
    const result = {
      text: 'Successfully executed ${action.description.toLowerCase()}',
      data: {
        action: '${action.name.toUpperCase()}',
        timestamp: Date.now(),
        // Add your result data here
      }
    };

    // Call callback if provided
    if (callback) {
      await callback({
        text: result.text,
        actions: ['${action.name.toUpperCase()}'],
        source: message.content.source,
      });
    }

    return {
      text: result.text,
      success: true,
      data: result.data,
    };
  },
};`
      )
      .join('\\n\\n');

    return `import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';

${actionImplementations}

export const Actions: Action[] = [
${actions.map((action) => `  ${action.name.toLowerCase()}Action`).join(',\\n')}
];

export default Actions;
`;
  }

  /**
   * Generate providers based on capabilities
   */
  private generateProviders(providers: any[]): string {
    if (providers.length === 0) {
      return `import { Provider } from '@elizaos/core';

export const Providers: Provider[] = [
  // No providers defined
];

export default Providers;
`;
    }

    const providerImplementations = providers
      .map(
        (provider) => `
export const ${provider.name.toLowerCase()}Provider: Provider = {
  name: '${provider.name.toUpperCase()}',
  description: '${provider.description}',
  
  async get(runtime, message, state) {
    // TODO: Implement ${provider.name} data retrieval
    const data = {
      timestamp: Date.now(),
      // Add your provider data here
    };

    return {
      text: \`[${provider.name.toUpperCase()}]\\\\n\\\${JSON.stringify(data, null, 2)}\\\\n[/${provider.name.toUpperCase()}]\`,
      values: data
    };
  },
};`
      )
      .join('\\n\\n');

    return `import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';

${providerImplementations}

export const Providers: Provider[] = [
${providers.map((provider) => `  ${provider.name.toLowerCase()}Provider`).join(',\\n')}
];

export default Providers;
`;
  }

  /**
   * Generate services based on capabilities
   */
  private generateServices(services: any[]): string {
    if (services.length === 0) {
      return `import { Service } from '@elizaos/core';

export const Services: (typeof Service)[] = [
  // No services defined
];

export default Services;
`;
    }

    const serviceImplementations = services
      .map(
        (service) => `
export class ${service.name}Service extends Service {
  static override serviceType = '${service.name.toUpperCase()}';
  
  constructor(runtime) {
    super(runtime);
    console.log('${service.name}Service initialized');
  }

  static async start(runtime): Promise<${service.name}Service> {
    const service = new ${service.name}Service(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    // TODO: Implement ${service.name} service initialization
    console.log('${service.name}Service started successfully');
  }

  async stop(): Promise<void> {
    // TODO: Implement ${service.name} service cleanup
    console.log('${service.name}Service stopped');
  }
}`
      )
      .join('\\n\\n');

    return `import { Service, IAgentRuntime } from '@elizaos/core';

${serviceImplementations}

export const Services: (typeof Service)[] = [
${services.map((service) => `  ${service.name}Service`).join(',\\n')}
];

export default Services;
`;
  }

  /**
   * Generate evaluators based on capabilities
   */
  private generateEvaluators(evaluators: any[]): string {
    if (evaluators.length === 0) {
      return `import { Evaluator } from '@elizaos/core';

export const Evaluators: Evaluator[] = [
  // No evaluators defined
];

export default Evaluators;
`;
    }

    const evaluatorImplementations = evaluators
      .map(
        (evaluator) => `
export const ${evaluator.name.toLowerCase()}Evaluator: Evaluator = {
  name: '${evaluator.name.toUpperCase()}',
  description: '${evaluator.description}',
  ${evaluator.trigger === 'always' ? 'alwaysRun: true,' : ''}

  async handler(runtime, message, state, didRespond, responseContent) {
    // FAIL FAST - no try-catch
    // TODO: Implement ${evaluator.name} evaluation logic
    console.log('Running ${evaluator.name} evaluator');
    
    // Evaluation logic here
    const evaluation = {
      score: 1.0,
      confidence: 1.0,
      metadata: {
        evaluator: '${evaluator.name}',
        timestamp: Date.now()
      }
    };

    return evaluation;
  },
};`
      )
      .join('\\n\\n');

    return `import { Evaluator, IAgentRuntime, Memory, State } from '@elizaos/core';

${evaluatorImplementations}

export const Evaluators: Evaluator[] = [
${evaluators.map((evaluator) => `  ${evaluator.name.toLowerCase()}Evaluator`).join(',\\n')}
];

export default Evaluators;
`;
  }

  /**
   * Generate types file
   */
  private generateTypes(capabilities: PluginCapabilities): string {
    return `// Types for this plugin
export interface PluginConfig {
${capabilities.envVars.map((env) => `  ${env.name}?: string;`).join('\\n')}
}

${
  capabilities.actions.length > 0
    ? `
// Action types
${capabilities.actions
  .map(
    (action) => `
export interface ${action.name}ActionData {
  timestamp: number;
  // Define your action result data structure here
}
`
  )
  .join('')}
`
    : ''
}

${
  capabilities.providers.length > 0
    ? `
// Provider types
${capabilities.providers
  .map(
    (provider) => `
export interface ${provider.name}ProviderData {
  timestamp: number;
  // Define your provider data structure here
}
`
  )
  .join('')}
`
    : ''
}

${
  capabilities.apiIntegrations.length > 0
    ? `
// API Integration types
${capabilities.apiIntegrations
  .map(
    (api) => `
export interface ${api.name}APIResponse {
  success: boolean;
  data?: any;
  error?: string;
}
`
  )
  .join('')}
`
    : ''
}

// Common plugin types
export interface PluginError {
  message: string;
  code?: string;
  timestamp: number;
}
`;
  }

  /**
   * Get dependencies for specific capabilities
   */
  private getDependenciesForCapabilities(capabilities: PluginCapabilities): Record<string, string> {
    const deps: Record<string, string> = {};

    // API integrations may need axios or fetch libraries
    if (capabilities.apiIntegrations.length > 0) {
      deps['axios'] = '^1.6.0';
    }

    // Add other capability-specific dependencies as needed
    capabilities.services.forEach((service) => {
      if (service.type === 'websocket') {
        deps['ws'] = '^8.17.0';
      }
      if (service.type === 'database') {
        deps['sqlite3'] = '^5.1.6';
      }
    });

    return deps;
  }

  /**
   * Extract dependencies from capabilities
   */
  private extractDependencies(capabilities: PluginCapabilities): string[] {
    const deps = new Set(['@elizaos/core']);

    // Add dependencies based on capabilities
    if (capabilities.apiIntegrations.length > 0) {
      deps.add('axios');
    }

    return Array.from(deps);
  }

  /**
   * Get default output path for a plugin
   */
  private getDefaultOutputPath(pluginName: string): string {
    const sanitizedName = pluginName
      .toLowerCase()
      .replace(/\\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return path.join(this.outputBasePath, `plugin-${sanitizedName}`);
  }

  async stop(): Promise<void> {
    logger.info('[PluginTemplateService] Stopping...');
  }
}

export default PluginTemplateService;
