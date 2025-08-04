/**
 * Configuration Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Handles model provider configuration, validation, and testing
 */

import React from 'react';
import { ProviderSelector } from '../ProviderSelector';
import { OllamaModelSelector } from '../OllamaModelSelector';
import { BackupSettings } from '../BackupSettings';
import { apiKeyManager } from '../../utils/apiKeyManager';
import { createLogger } from '../../utils/logger';

interface ConfigPanelProps {
  configValues: Record<string, any>;
  pluginConfigs: Record<string, any>;
  isResetting: boolean;
  updatePluginConfig: (plugin: string, key: string, value: any) => void;
  validateConfiguration: () => void;
  testConfiguration: () => void;
  setShowResetDialog: (show: boolean) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  configValues,
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
  const currentProvider = configValues.environment?.MODEL_PROVIDER || 'openai';

  return (
    <div className="status-content">
      <div className="status-header">
        <span>◎ CONFIGURATION</span>
      </div>
      <div className="scrollable-content">
        {/* Model Provider Configuration */}
        <div className="config-section">
          {/* Show ProviderSelector only in Tauri, otherwise show a simple select */}
          {window.__TAURI_INTERNALS__ ? (
            <ProviderSelector
              onProviderChange={(provider) => {
                updatePluginConfig('environment', 'MODEL_PROVIDER', provider);
                // Clear model selection when provider changes
                updatePluginConfig('environment', 'LANGUAGE_MODEL', '');
              }}
            />
          ) : (
            <div className="config-item">
              <label>Model Provider</label>
              <select
                className="config-select"
                value={currentProvider}
                onChange={(e) => {
                  updatePluginConfig('environment', 'MODEL_PROVIDER', e.target.value);
                  // Clear model selection when provider changes
                  updatePluginConfig('environment', 'LANGUAGE_MODEL', '');
                }}
                data-testid="model-provider-select"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="groq">Groq</option>
                <option value="elizaos">ElizaOS Cloud</option>
              </select>
            </div>
          )}

          {/* OpenAI Configuration */}
          {(currentProvider === 'openai' || !currentProvider) && (
            <>
              <div className="config-item">
                <label>OpenAI API Key</label>
                <input
                  type="password"
                  className="config-input"
                  value={configValues.environment?.OPENAI_API_KEY || ''}
                  placeholder={
                    pluginConfigs.environment?.OPENAI_API_KEY === '***SET***'
                      ? 'Currently Set'
                      : 'Enter OpenAI API Key'
                  }
                  onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                  data-testid="openai-api-key-input"
                />
              </div>
              <div className="config-item">
                <label>Model</label>
                <select
                  className="config-select"
                  value={configValues.environment?.LANGUAGE_MODEL || 'gpt-4o-mini'}
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
              <div className="config-item">
                <label>Anthropic API Key</label>
                <input
                  type="password"
                  className="config-input"
                  value={configValues.environment?.ANTHROPIC_API_KEY || ''}
                  placeholder={
                    pluginConfigs.environment?.ANTHROPIC_API_KEY === '***SET***'
                      ? 'Currently Set'
                      : 'Enter Anthropic API Key'
                  }
                  onChange={(e) => handleApiKeyChange('anthropic', e.target.value)}
                  data-testid="anthropic-api-key-input"
                />
              </div>
              <div className="config-item">
                <label>Model</label>
                <select
                  className="config-select"
                  value={configValues.environment?.LANGUAGE_MODEL || 'claude-3-haiku-20240307'}
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
              <div className="config-item">
                <label>Groq API Key</label>
                <input
                  type="password"
                  className="config-input"
                  value={configValues.environment?.GROQ_API_KEY || ''}
                  placeholder={
                    pluginConfigs.environment?.GROQ_API_KEY === '***SET***'
                      ? 'Currently Set'
                      : 'Enter Groq API Key'
                  }
                  onChange={(e) => handleApiKeyChange('groq', e.target.value)}
                  data-testid="groq-api-key-input"
                />
              </div>
              <div className="config-item">
                <label>Model</label>
                <select
                  className="config-select"
                  value={configValues.environment?.LANGUAGE_MODEL || 'llama-3.1-70b-versatile'}
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
              value={configValues.environment?.LANGUAGE_MODEL || ''}
              onChange={(model: string) =>
                updatePluginConfig('environment', 'LANGUAGE_MODEL', model)
              }
            />
          )}
        </div>

        {/* Configuration Testing Section */}
        <div className="config-section">
          <div className="config-title">🔍 Configuration Validation</div>
          <div className="config-actions">
            <button
              className="config-btn validate-btn"
              onClick={validateConfiguration}
              data-testid="validate-config-button"
            >
              🔍 VALIDATE CONFIG
            </button>
            <button
              className="config-btn test-btn"
              onClick={testConfiguration}
              data-testid="test-config-button"
            >
              🧪 TEST CONFIG
            </button>
          </div>
          <div className="config-help">
            <small style={{ color: '#888', fontSize: '10px', lineHeight: '1.3' }}>
              Validate: Check API connectivity and configuration
              <br />
              Test: Run actual LLM calls to verify functionality
            </small>
          </div>
        </div>

        <div className="config-section danger-section">
          <div className="config-title">⚠️ Danger Zone</div>
          <button
            className="reset-btn"
            onClick={() => setShowResetDialog(true)}
            disabled={isResetting}
          >
            {isResetting ? 'RESETTING...' : 'RESET AGENT'}
          </button>
          <div className="config-warning">
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
