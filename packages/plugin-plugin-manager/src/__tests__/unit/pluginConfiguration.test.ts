import { describe, expect, it } from 'vitest';
import { startPluginConfigurationAction } from '../../actions/startPluginConfiguration';
import { pluginConfigurationEvaluator } from '../../evaluators/pluginConfigurationEvaluator';
import { pluginManagerPlugin } from '../../index';
import { pluginConfigurationStatusProvider } from '../../providers/pluginConfigurationStatus';
import { PluginConfigurationService } from '../../services/pluginConfigurationService';
import { PluginUserInteractionService } from '../../services/pluginUserInteractionService';

describe('Plugin Configuration System', () => {
  it('should export all required components', () => {
    expect(PluginConfigurationService).toBeDefined();
    expect(PluginUserInteractionService).toBeDefined();
    expect(startPluginConfigurationAction).toBeDefined();
    expect(pluginConfigurationStatusProvider).toBeDefined();
    expect(pluginConfigurationEvaluator).toBeDefined();
    expect(pluginManagerPlugin).toBeDefined();
  });

  it('should have correct plugin structure', () => {
    expect(pluginManagerPlugin.name).toBe('plugin-manager');
    expect(pluginManagerPlugin.description).toContain('configuration management');
    expect(pluginManagerPlugin.services).toBeDefined();
    expect(pluginManagerPlugin.services.length).toBeGreaterThan(0);
    expect(pluginManagerPlugin.actions).toBeDefined();
    expect(pluginManagerPlugin.actions.length).toBeGreaterThan(0);
    expect(pluginManagerPlugin.providers).toBeDefined();
    expect(pluginManagerPlugin.providers.length).toBeGreaterThan(0);
    expect(pluginManagerPlugin.evaluators).toHaveLength(1);
  });

  it('should have valid action structure', () => {
    expect(startPluginConfigurationAction.name).toBe('START_PLUGIN_CONFIGURATION');
    expect(startPluginConfigurationAction.description).toContain('configuration dialog');
    expect(startPluginConfigurationAction.validate).toBeTypeOf('function');
    expect(startPluginConfigurationAction.handler).toBeTypeOf('function');
  });

  it('should have valid provider structure', () => {
    expect(pluginConfigurationStatusProvider.name).toBe('pluginConfigurationStatus');
    expect(pluginConfigurationStatusProvider.description).toContain('configuration status');
    expect(pluginConfigurationStatusProvider.get).toBeTypeOf('function');
  });

  it('should have valid evaluator structure', () => {
    expect(pluginConfigurationEvaluator.name).toBe('pluginConfigurationEvaluator');
    expect(pluginConfigurationEvaluator.description).toContain('configuration needs');
    expect(pluginConfigurationEvaluator.validate).toBeTypeOf('function');
    expect(pluginConfigurationEvaluator.handler).toBeTypeOf('function');
    expect(pluginConfigurationEvaluator.alwaysRun).toBe(false);
  });
});
