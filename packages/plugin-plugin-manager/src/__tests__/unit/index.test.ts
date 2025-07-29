import { describe, expect, it } from 'bun:test';
import { installPluginFromRegistryAction } from '../../actions/installPluginFromRegistry';
import { loadPluginAction } from '../../actions/loadPlugin';
import { startPluginConfigurationAction } from '../../actions/startPluginConfiguration';
import { unloadPluginAction } from '../../actions/unloadPlugin';
import { pluginManagerPlugin } from '../../index';
import { pluginConfigurationStatusProvider } from '../../providers/pluginConfigurationStatus';
import { pluginStateProvider } from '../../providers/pluginStateProvider';
import { registryPluginsProvider } from '../../providers/registryPluginsProvider';
import { PluginConfigurationService } from '../../services/pluginConfigurationService';
import { PluginManagerService } from '../../services/pluginManagerService';
import { PluginUserInteractionService } from '../../services/pluginUserInteractionService';

describe('Plugin Manager Index', () => {
  it('should export pluginManagerPlugin with correct definitions', () => {
    expect(pluginManagerPlugin.name).toBe('plugin-manager');
    expect(pluginManagerPlugin.description).toBe(
      'Manages dynamic loading and unloading of plugins at runtime, including registry installation and configuration management'
    );
    expect(pluginManagerPlugin.services).toBeDefined();
    expect(pluginManagerPlugin.services.length).toBeGreaterThan(0);
    expect(pluginManagerPlugin.providers).toBeDefined();
    expect(pluginManagerPlugin.providers.length).toBeGreaterThan(0);
    expect(pluginManagerPlugin.providers).toContainEqual(pluginStateProvider);
    expect(pluginManagerPlugin.providers).toContainEqual(pluginConfigurationStatusProvider);
    expect(pluginManagerPlugin.providers).toContainEqual(registryPluginsProvider);
    expect(pluginManagerPlugin.actions).toBeDefined();
    expect(pluginManagerPlugin.actions.length).toBeGreaterThan(0);
    expect(pluginManagerPlugin.actions).toContainEqual(loadPluginAction);
    expect(pluginManagerPlugin.actions).toContainEqual(unloadPluginAction);
    expect(pluginManagerPlugin.actions).toContainEqual(startPluginConfigurationAction);
    expect(pluginManagerPlugin.actions).toContainEqual(installPluginFromRegistryAction);
    expect(pluginManagerPlugin.init).toBeInstanceOf(Function);
  });
});
