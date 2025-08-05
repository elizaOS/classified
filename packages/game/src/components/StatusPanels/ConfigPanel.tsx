/**
 * Configuration Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Handles model provider configuration, validation, and testing
 */

import React from 'react';
import { apiKeyManager } from '../../utils/apiKeyManager';
import { createLogger } from '../../utils/logger';
import { BackupSettings } from '../BackupSettings';
import { OllamaModelSelector } from '../OllamaModelSelector';

interface ConfigPanelProps {
  pluginConfigs: Record<string, any>;
  isResetting: boolean;
  updatePluginConfig: (plugin: string, key: string, value: any) => void;
  validateConfiguration: () => void;
  testConfiguration: () => void;
  setShowResetDialog: (show: boolean) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  pluginConfigs,
  isResetting,
  updatePluginConfig,
  validateConfiguration,
  testConfiguration,
  setShowResetDialog,
}) => {
  const logger = createLogger('ConfigPanel');

  // Secure API key handling
  const handleApiKeyChange = async (provider: string, key: string) => {
    try {
      const validation = apiKeyManager.validateApiKey(key, provider);
      if (!validation.isValid) {
        logger.warn(`Invalid API key for ${provider}: ${validation.error}`);
        // Still update the field to show user input, but show error
        updatePluginConfig('environment', `${provider.toUpperCase()}_API_KEY`, key);
        return;
      }

      // Store securely if valid
      if (key && key !== '***SET***') {
        await apiKeyManager.storeApiKey(provider, key);
        // Update config with masked value
        updatePluginConfig('environment', `${provider.toUpperCase()}_API_KEY`, '***SET***');
      }
    } catch (error) {
      logger.error(`Failed to handle API key for ${provider}`, error);
    }
  };
  const currentProvider = pluginConfigs.environment?.MODEL_PROVIDER || 'openai';

  return (
    <div className="flex flex-col h-full bg-black text-terminal-green font-mono" data-testid="config-content">
      <div className="p-4 border-b border-terminal-green bg-black/90">
        <span className="font-bold text-terminal-green uppercase tracking-wider">◎ CONFIGURATION</span>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Model Provider Configuration */}
        <div className="mb-8 p-5 bg-black/60 border border-terminal-green-border">
          <div className="text-sm font-bold text-terminal-green mb-4 uppercase tracking-wider">🤖 AI MODEL CONFIGURATION</div>

          {/* Provider Selection */}
          <div className="mb-4">
            <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">Model Provider</label>
            <select
              className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none cursor-pointer transition-none appearance-none pr-8 bg-no-repeat bg-[right_12px_center] bg-[length:12px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Cpath d='M0 0 L6 6 L12 0' fill='none' stroke='%2300ff00' stroke-width='1.5'/%3E%3C/svg%3E\")",
              }}
              value={currentProvider}
              onChange={(e) => {
                updatePluginConfig('environment', 'MODEL_PROVIDER', e.target.value);
                // Clear model selection when provider changes
                updatePluginConfig('environment', 'LANGUAGE_MODEL', '');
              }}
              data-testid="model-provider-select"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="groq">Groq</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="elizaos">ElizaOS Cloud</option>
            </select>
          </div>

          {/* OpenAI Configuration */}
          {(currentProvider === 'openai' || !currentProvider) && (
            <>
              <div className="mb-4">
                <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">OpenAI API Key</label>
                <input
                  type="password"
                  className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none placeholder:text-gray-500 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
                  value={pluginConfigs.environment?.OPENAI_API_KEY || ''}
                  placeholder={
                    pluginConfigs.environment?.OPENAI_API_KEY === '***SET***'
                      ? 'Currently Set'
                      : 'Enter OpenAI API Key'
                  }
                  onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                  data-testid="openai-api-key-input"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">
                  Model
                </label>
                <select
                  className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none cursor-pointer transition-none appearance-none pr-8 bg-no-repeat bg-[right_12px_center] bg-[length:12px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Cpath d='M0 0 L6 6 L12 0' fill='none' stroke='%2300ff00' stroke-width='1.5'/%3E%3C/svg%3E\")",
                  }}
                  value={pluginConfigs.environment?.LANGUAGE_MODEL || 'gpt-4o-mini'}
                  onChange={(e) =>
                    updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                  }
                  data-testid="openai-model-select"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
            </>
          )}

          {/* Anthropic Configuration */}
          {currentProvider === 'anthropic' && (
            <>
              <div className="mb-4">
                <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">Anthropic API Key</label>
                <input
                  type="password"
                  className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none placeholder:text-gray-500 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
                  value={pluginConfigs.environment?.ANTHROPIC_API_KEY || ''}
                  placeholder={
                    pluginConfigs.environment?.ANTHROPIC_API_KEY === '***SET***'
                      ? 'Currently Set'
                      : 'Enter Anthropic API Key'
                  }
                  onChange={(e) => handleApiKeyChange('anthropic', e.target.value)}
                  data-testid="anthropic-api-key-input"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">Model</label>
                <select
                  className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none cursor-pointer transition-none appearance-none pr-8 bg-no-repeat bg-[right_12px_center] bg-[length:12px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Cpath d='M0 0 L6 6 L12 0' fill='none' stroke='%2300ff00' stroke-width='1.5'/%3E%3C/svg%3E\")",
                  }}
                  value={pluginConfigs.environment?.LANGUAGE_MODEL || 'claude-3-haiku-20240307'}
                  onChange={(e) =>
                    updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                  }
                  data-testid="anthropic-model-select"
                >
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                </select>
              </div>
            </>
          )}

          {/* Groq Configuration */}
          {currentProvider === 'groq' && (
            <>
              <div className="mb-4">
                <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">Groq API Key</label>
                <input
                  type="password"
                  className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none placeholder:text-gray-500 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
                  value={pluginConfigs.environment?.GROQ_API_KEY || ''}
                  placeholder={
                    pluginConfigs.environment?.GROQ_API_KEY === '***SET***'
                      ? 'Currently Set'
                      : 'Enter Groq API Key'
                  }
                  onChange={(e) => handleApiKeyChange('groq', e.target.value)}
                  data-testid="groq-api-key-input"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">Model</label>
                <select
                  className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none cursor-pointer transition-none appearance-none pr-8 bg-no-repeat bg-[right_12px_center] bg-[length:12px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Cpath d='M0 0 L6 6 L12 0' fill='none' stroke='%2300ff00' stroke-width='1.5'/%3E%3C/svg%3E\")",
                  }}
                  value={pluginConfigs.environment?.LANGUAGE_MODEL || 'llama-3.1-70b-versatile'}
                  onChange={(e) =>
                    updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                  }
                  data-testid="groq-model-select"
                >
                  <option value="llama-3.1-405b-reasoning">Llama 3.1 405B</option>
                  <option value="llama-3.1-70b-versatile">Llama 3.1 70B</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                </select>
              </div>
            </>
          )}

          {/* Ollama Configuration */}
          {currentProvider === 'ollama' && (
            <OllamaModelSelector
              value={pluginConfigs.environment?.LANGUAGE_MODEL || ''}
              onChange={(model: string) =>
                updatePluginConfig('environment', 'LANGUAGE_MODEL', model)
              }
            />
          )}
        </div>

        {/* Configuration Testing Section */}
        <div className="mb-8 p-5 bg-black/40 border border-terminal-green/20">
          <div className="text-sm font-bold text-terminal-green mb-4 uppercase tracking-wider flex items-center gap-2">
            🔍 Configuration Validation
          </div>
          <div className="flex gap-3">
            <button
              className="py-2.5 px-5 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-none outline-none min-w-[120px] hover:bg-terminal-green/10 hover:border-terminal-green hover:text-terminal-green active:bg-terminal-green/20 active:transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={validateConfiguration}
              data-testid="validate-config-button"
            >
              🔍 VALIDATE CONFIG
            </button>
            <button
              className="py-2.5 px-5 bg-black/30 border border-terminal-blue/30 text-terminal-blue font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-none outline-none min-w-[120px] hover:bg-terminal-blue/10 hover:border-terminal-blue active:bg-terminal-blue/20 active:transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={testConfiguration}
              data-testid="test-config-button"
            >
              🧪 TEST CONFIG
            </button>
          </div>
          <div className="mt-3">
            <small className="text-gray-400 text-[10px] leading-tight block">
              Validate: Check API connectivity and configuration
              <br />
              Test: Run actual LLM calls to verify functionality
            </small>
          </div>
        </div>

        <div className="mb-8 p-5 bg-terminal-red/10 border border-terminal-red/20">
          <div className="text-sm font-bold text-terminal-red mb-4 uppercase tracking-wider flex items-center gap-2">
            ⚠️ Danger Zone
          </div>
          <button
            className="py-2.5 px-5 bg-terminal-red/30 border border-terminal-red/30 text-terminal-red font-mono text-xs font-bold uppercase tracking-wider cursor-pointer transition-none outline-none min-w-[120px] hover:bg-terminal-red/50 hover:border-terminal-red hover:text-terminal-red/150 active:bg-terminal-red/40 active:transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setShowResetDialog(true)}
            disabled={isResetting}
          >
            {isResetting ? 'RESETTING...' : 'RESET AGENT'}
          </button>
          <div className="mt-3 p-3 bg-terminal-red/10 border border-terminal-red/30 text-terminal-red text-[11px] leading-relaxed">
            This will permanently delete all agent memories, goals, todos, and restart with a fresh
            instance.
          </div>
        </div>

        {/* Backup and Restore Section */}
        <BackupSettings />
      </div>
    </div>
  );
};

export default ConfigPanel;