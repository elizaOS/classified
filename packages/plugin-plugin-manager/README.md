# Plugin Manager for Eliza Autonomous Agent

The Plugin Manager enables dynamic loading and unloading of plugins at runtime without requiring agent restarts. This is essential for the autonomous agent to extend its own capabilities.

## Features

- **Dynamic Plugin Loading**: Load plugins at runtime without restarting the agent
- **Safe Plugin Unloading**: Unload plugins and clean up their resources
- **Plugin State Management**: Track plugin states (building, ready, loaded, error, unloaded)
- **Environment Variable Detection**: Detect and report missing environment variables
- **Original Plugin Protection**: Prevents unloading of plugins loaded at startup
- **Component Registration**: Automatically registers actions, providers, evaluators, and services
- **Plugin Search**: Search for plugins by their README content, descriptions, or functionality
- **Plugin Cloning**: Clone plugin repositories for local development and modification
- **Plugin Publishing**: Publish plugins to npm registry with automated testing and building
- **Registry Integration**: Search, retrieve, and load plugins from the official registry
- **Knowledge Base**: Load plugin metadata and READMEs into searchable knowledge

## Architecture

### Plugin States

```typescript
enum PluginStatus {
  BUILDING = 'building', // Plugin is being built/compiled
  READY = 'ready', // Plugin is ready to be loaded
  LOADED = 'loaded', // Plugin is currently loaded and active
  ERROR = 'error', // Plugin encountered an error
  UNLOADED = 'unloaded', // Plugin was previously loaded but is now unloaded
}
```

### Components

1. **PluginManagerService**: Core service that manages plugin lifecycle
2. **pluginStateProvider**: Provides current state of all plugins
3. **loadPluginAction**: Action to load a plugin
4. **unloadPluginAction**: Action to unload a plugin

## Usage

### 1. Add Plugin Manager to Your Agent

```typescript
import { pluginManagerPlugin } from './plugin-manager';

export const projectAgent: ProjectAgent = {
  character,
  plugins: [
    // ... other plugins
    pluginManagerPlugin,
  ],
};
```

### 2. Create a Dynamic Plugin

```typescript
import type { Plugin } from '@elizaos/core';

export const myDynamicPlugin: Plugin = {
  name: 'my-dynamic-plugin',
  description: 'A plugin that can be loaded at runtime',

  actions: [
    {
      name: 'MY_ACTION',
      similes: ['my action'],
      description: 'Does something useful',
      validate: async () => true,
      handler: async (runtime, message, state, options, callback) => {
        if (callback) {
          await callback({
            text: 'Action executed!',
            actions: ['MY_ACTION'],
          });
        }
      },
    },
  ],

  providers: [
    {
      name: 'myProvider',
      description: 'Provides data',
      get: async () => ({
        text: 'Provider data',
        values: { key: 'value' },
        data: {},
      }),
    },
  ],

  init: async (config, runtime) => {
    console.log('Plugin initialized!');
  },
};
```

### 3. Search for Plugins

Search for plugins by functionality:

```
User: "Search for plugins that can handle weather data"
Agent: "I found 3 plugins related to weather:

1. **@elizaos/plugin-weather** - Provides weather data and forecasts
   _Relevant: Weather information and forecasting plugin..._
   Tags: weather, forecast, climate, api

2. **@elizaos/plugin-openweather** - Integration with OpenWeather API
   Tags: weather, api, openweather

3. **@elizaos/plugin-climate** - Climate data analysis
   Tags: climate, weather, analysis"
```

### 4. Clone a Plugin for Development

```
User: "Clone the weather plugin so I can modify it"
Agent: "Successfully cloned @elizaos/plugin-weather to ./cloned-plugins/plugin-weather

You can now:
- Edit the plugin code in your preferred editor
- Run tests with `npm test`
- Build with `npm run build`
- Use the plugin-autocoder to make AI-assisted modifications"
```

### 5. Load Plugin via Action

The agent can load plugins through natural language:

```
User: "Load the my-dynamic-plugin"
Agent: "Loading the my-dynamic-plugin now."
Agent: "Successfully loaded plugin: my-dynamic-plugin"
```

### 6. Publish a Plugin

```
User: "Publish my weather plugin to npm"
Agent: "Publishing @elizaos/plugin-weather v1.0.0...

This will:
1. Run tests to ensure quality
2. Build the plugin
3. Publish to npm registry

Successfully published @elizaos/plugin-weather v1.0.0!

NPM Registry: https://www.npmjs.com/package/@elizaos/plugin-weather

Next steps:
1. Create a PR to add your plugin to the official Eliza registry
2. Update your README with installation instructions
3. Share your plugin with the community!"
```

### 7. Check Plugin States

```
User: "What plugins are available?"
Agent: "**Loaded Plugins:**
- auto (loaded)
- bootstrap (loaded)
- groq (loaded)
- shell (loaded)
- plugin-manager (loaded)

**Ready to Load:**
- my-dynamic-plugin (ready)"
```

### 8. Unload Plugin

```
User: "Unload my-dynamic-plugin"
Agent: "Successfully unloaded plugin: my-dynamic-plugin"
```

## API Reference

### PluginManagerService

```typescript
class PluginManagerService {
  // Register a new plugin
  async registerPlugin(plugin: Plugin): Promise<string>

  // Load a registered plugin
  async loadPlugin({ pluginId, force? }: LoadPluginParams): Promise<void>

  // Unload a loaded plugin
  async unloadPlugin({ pluginId }: UnloadPluginParams): Promise<void>

  // Get plugin state
  getPlugin(id: string): PluginState | undefined

  // Get all plugins
  getAllPlugins(): PluginState[]

  // Get loaded plugins
  getLoadedPlugins(): PluginState[]

  // Update plugin state
  updatePluginState(id: string, update: Partial<PluginState>): void
}
```

### Plugin Registry Service

```typescript
// Search plugins by content
async function searchPluginsByContent(query: string): Promise<PluginSearchResult[]>;

// Clone a plugin for development
async function clonePlugin(pluginName: string): Promise<CloneResult>;

// Publish a plugin to npm
async function publishPlugin(pluginPath: string): Promise<PublishResult>;

// Fetch plugin knowledge for searching
async function fetchPluginKnowledge(): Promise<Map<string, PluginKnowledge>>;
```

### Plugin State

```typescript
interface PluginState {
  id: string;
  name: string;
  status: PluginStatus;
  plugin?: Plugin;
  missingEnvVars: string[];
  buildLog: string[];
  sourceCode?: string;
  packageJson?: any;
  error?: string;
  createdAt: number;
  loadedAt?: number;
  unloadedAt?: number;
  version?: string;
  dependencies?: Record<string, string>;
}
```

## Examples

### Example: Dynamic Plugin with Environment Variables

```typescript
const pluginWithEnvVars: Plugin = {
  name: 'api-plugin',
  description: 'Plugin that requires API keys',

  init: async (config, runtime) => {
    const requiredVars = ['API_KEY', 'API_SECRET'];
    const missing = requiredVars.filter((v) => !runtime.getSetting(v));

    if (missing.length > 0) {
      // Plugin manager will track these missing variables
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
  },

  // ... rest of plugin
};
```

### Example: Plugin with Service

```typescript
class MyService extends Service {
  static serviceType = 'MY_SERVICE' as ServiceTypeName;

  static async start(runtime: IAgentRuntime): Promise<Service> {
    return new MyService(runtime);
  }

  async stop(): Promise<void> {
    // Cleanup resources
  }
}

const pluginWithService: Plugin = {
  name: 'service-plugin',
  services: [MyService],
  // ... rest of plugin
};
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- plugin-manager
```

Tests cover:

- Plugin registration and loading
- Plugin unloading and cleanup
- Component registration/unregistration
- Error handling
- State management
- Provider functionality
- Action validation and handling

## Future Enhancements

1. **Plugin Builder Service**: Integrate with the autobuilder to create plugins from specifications
2. **Plugin Discovery**: Discover plugins from npm registry or GitHub
3. **Dependency Resolution**: Automatically install plugin dependencies
4. **Plugin Marketplace**: Browse and install community plugins
5. **Hot Reload**: Watch plugin files and reload on changes
6. **Sandboxing**: Run plugins in isolated contexts for security
7. **Version Management**: Handle plugin updates and rollbacks

## Contributing

When creating plugins for dynamic loading:

1. Keep plugins self-contained
2. Handle cleanup in service `stop()` methods
3. Check for required environment variables in `init()`
4. Use descriptive names for actions and providers
5. Include comprehensive error handling
6. Document plugin capabilities

## License

MIT
