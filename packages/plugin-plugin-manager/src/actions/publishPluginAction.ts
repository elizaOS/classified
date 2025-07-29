import { Action, HandlerCallback, IAgentRuntime, Memory, State, elizaLogger } from '@elizaos/core';
import * as fs from 'fs/promises';
import * as path from 'node:path';
import { publishPlugin } from '../services/pluginRegistryService';

export const publishPluginAction: Action = {
  name: 'PUBLISH_PLUGIN',
  similes: ['publish plugin', 'release plugin', 'deploy plugin', 'push plugin to registry'],

  description:
    'Publish a plugin to npm registry or create a pull request to add it to the Eliza plugin registry',

  examples: [
    [
      {
        name: '{{user1}}',
        content: {
          text: 'Publish my weather plugin to npm',
          actions: ['PUBLISH_PLUGIN'],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: "I'll help you publish your weather plugin to npm.",
          actions: ['PUBLISH_PLUGIN'],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Successfully published @elizaos/plugin-weather to npm!\n\nVersion: 1.0.0\nRegistry: https://www.npmjs.com/package/@elizaos/plugin-weather\n\nNext steps:\n- Create a PR to add it to the official Eliza plugin registry\n- Update the README with installation instructions',
          actions: ['PUBLISH_PLUGIN'],
        },
      },
    ],
  ],

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const text = message.content?.text?.toLowerCase() || '';
    return text.includes('publish') && text.includes('plugin');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<void> => {
    elizaLogger.info('[publishPluginAction] Starting plugin publication');

    // Extract plugin path or name from message
    const pluginInfo = extractPluginInfo(message.content?.text || '');
    if (!pluginInfo) {
      if (callback) {
        await callback({
          text: "Please specify which plugin you want to publish. You can provide a path to the plugin directory or the plugin name if it's in the current directory.",
          actions: ['PUBLISH_PLUGIN'],
        });
      }
      return;
    }

    // Verify plugin exists and has package.json
    const pluginPath = await resolvePluginPath(pluginInfo);
    if (!pluginPath) {
      if (callback) {
        await callback({
          text: `Could not find plugin at: ${pluginInfo}. Make sure the path is correct and contains a package.json file.`,
          actions: ['PUBLISH_PLUGIN'],
        });
      }
      return;
    }

    // Read package.json
    const packageJsonPath = path.join(pluginPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    if (callback) {
      await callback({
        text: `Publishing ${packageJson.name} v${packageJson.version}...\n\nThis will:\n1. Run tests to ensure quality\n2. Build the plugin\n3. Publish to npm registry`,
        actions: ['PUBLISH_PLUGIN'],
      });
    }

    // Publish the plugin
    const result = await publishPlugin(pluginPath);

    if (!result.success) {
      if (callback) {
        await callback({
          text: `Failed to publish plugin: ${result.error}`,
          actions: ['PUBLISH_PLUGIN'],
        });
      }
      return;
    }

    // Prepare success response
    let responseText = `Successfully published **${result.packageName}** v${result.version}!\n\n`;

    if (result.npmUrl) {
      responseText += `**NPM Registry:** ${result.npmUrl}\n\n`;
    }

    responseText += '**Next steps:**\n';
    responseText += '1. Create a PR to add your plugin to the official Eliza registry\n';
    responseText += '2. Update your README with installation instructions\n';
    responseText += '3. Share your plugin with the community!\n\n';

    if (result.registryPR) {
      responseText += `**Registry PR:** ${result.registryPR}\n`;
      responseText +=
        'Your pull request to add the plugin to the official registry has been created.';
    } else {
      responseText +=
        'To add your plugin to the official registry, run: `create registry PR for ' +
        result.packageName +
        '`';
    }

    if (callback) {
      await callback({
        text: responseText,
        actions: ['PUBLISH_PLUGIN'],
      });
    }

    return;
  },
};

function extractPluginInfo(text: string): string | null {
  // Look for file paths
  const pathMatch = text.match(/[./][\w/-]+/);
  if (pathMatch) {
    return pathMatch[0];
  }

  // Look for plugin names
  const patterns = [/@elizaos\/plugin-[\w-]+/g, /plugin-[\w-]+/g];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // Try to extract from natural language
  const words = text.toLowerCase().split(/\s+/);
  const publishIndex = words.findIndex((w) => w === 'publish');

  if (publishIndex !== -1) {
    // Look for plugin indicator
    for (let i = publishIndex + 1; i < words.length; i++) {
      if (words[i] === 'plugin' && i - 1 >= 0 && words[i - 1] !== 'the') {
        // Get the word before "plugin"
        return `plugin-${words[i - 1]}`;
      } else if (words[i].includes('plugin')) {
        return words[i];
      }
    }
  }

  return null;
}

async function resolvePluginPath(pluginInfo: string): Promise<string | null> {
  // Check if it's already a path
  if (pluginInfo.includes('/') || pluginInfo.includes('.')) {
    const absolutePath = path.resolve(pluginInfo);
    const stat = await fs.stat(absolutePath);
    if (stat.isDirectory()) {
      // Check for package.json
      await fs.access(path.join(absolutePath, 'package.json'));
      return absolutePath;
    }
  }

  // Check common locations
  const possiblePaths = [
    path.join(process.cwd(), pluginInfo),
    path.join(process.cwd(), 'packages', pluginInfo),
    path.join(process.cwd(), 'cloned-plugins', pluginInfo),
    path.join(process.cwd(), '..', pluginInfo),
  ];

  for (const possiblePath of possiblePaths) {
    const stat = await fs.stat(possiblePath);
    if (stat.isDirectory()) {
      // Check for package.json
      await fs.access(path.join(possiblePath, 'package.json'));
      return possiblePath;
    }
  }

  return null;
}
