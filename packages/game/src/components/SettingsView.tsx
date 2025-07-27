import { useState, useEffect, FC } from 'react';
import { apiFetch } from '../config/api';
import {
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Terminal,
  Database,
} from 'lucide-react';

interface SettingsViewProps {
  onViewSwitch?: (view: 'terminal' | 'database' | 'settings') => void;
  onSendMessage?: (message: string) => Promise<void>;
}

export const SettingsView: FC<SettingsViewProps> = ({
  onViewSwitch,
  onSendMessage: _onSendMessage,
}) => {
  const [pluginConfigs, setPluginConfigs] = useState<any>({});
  const [configValues, setConfigValues] = useState<any>({});
  const [isResetting, setIsResetting] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'testing'>(
    'idle'
  );
  const [statusMessages, setStatusMessages] = useState<
    Array<{ type: 'success' | 'error' | 'info'; message: string }>
  >([]);

  useEffect(() => {
    fetchPluginConfigs();
  }, []);

  const addStatusMessage = (type: 'success' | 'error' | 'info', message: string) => {
    setStatusMessages((prev) => [...prev.slice(-9), { type, message }]);
  };

  const fetchPluginConfigs = async () => {
    try {
      const response = await apiFetch('/api/plugin-config');
      if (response.ok) {
        const result = await response.json();
        const configs = result.data?.configurations || {};
        setPluginConfigs(configs);

        // Initialize config values with current values
        const values: any = {};
        Object.entries(configs).forEach(([plugin, config]: [string, any]) => {
          values[plugin] = { ...config };
        });
        setConfigValues(values);
        addStatusMessage('success', 'Configuration loaded successfully');
      }
    } catch (error) {
      console.error('Failed to fetch plugin configs:', error);
      addStatusMessage('error', 'Failed to load configuration');
    }
  };

  const updatePluginConfig = async (plugin: string, key: string, value: any) => {
    try {
      // Update local state immediately for responsive UI
      setConfigValues((prev: any) => ({
        ...prev,
        [plugin]: {
          ...prev[plugin],
          [key]: value,
        },
      }));

      // Don't send empty values for API keys
      if ((key.includes('API_KEY') || key.includes('_KEY')) && !value.trim()) {
        return;
      }

      const response = await apiFetch('/api/plugin-config', {
        method: 'POST',
        body: JSON.stringify({
          plugin,
          config: { [key]: value },
        }),
      });

      if (response.ok) {
        addStatusMessage('success', `Updated ${plugin}.${key} configuration`);

        // If we're updating critical environment variables, refresh the config
        if (
          plugin === 'environment' &&
          ['MODEL_PROVIDER', 'LANGUAGE_MODEL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].includes(key)
        ) {
          setTimeout(() => {
            fetchPluginConfigs();
          }, 1000);
        }
      } else {
        const error = await response.json();
        addStatusMessage(
          'error',
          `Failed to update config: ${error.error?.message || error.message || 'Unknown error'}`
        );
      }
    } catch (_error) {
      addStatusMessage('error', 'Failed to update config: Network error');
    }
  };

  const validateConfiguration = async () => {
    try {
      setValidationStatus('validating');
      addStatusMessage('info', 'Validating configuration...');

      const response = await apiFetch('/api/config/validate', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        const validation = result.data.validation;
        const recommendations = result.data.recommendations;

        addStatusMessage('success', 'Configuration validation complete');

        // Show overall status
        const statusIcon =
          validation.overall === 'healthy' ? '✅' : validation.overall === 'degraded' ? '⚠️' : '❌';
        addStatusMessage(
          validation.overall === 'healthy' ? 'success' : 'error',
          `${statusIcon} Overall Status: ${validation.overall.toUpperCase()}`
        );

        // Show provider statuses
        Object.entries(validation.providers).forEach(([provider, config]: [string, any]) => {
          const providerIcon =
            config.status === 'healthy' ? '✅' : config.status === 'degraded' ? '⚠️' : '❌';
          addStatusMessage(
            config.status === 'healthy' ? 'success' : 'error',
            `${providerIcon} ${provider}: ${config.message}`
          );
        });

        // Show recommendations
        if (recommendations && recommendations.length > 0) {
          recommendations.forEach((rec: string) => {
            addStatusMessage(rec.includes('✅') ? 'success' : 'error', rec);
          });
        }
      } else {
        const error = await response.json();
        addStatusMessage('error', `Validation failed: ${error.error?.message || 'Unknown error'}`);
      }
    } catch (_error) {
      addStatusMessage('error', 'Configuration validation failed: Network error');
    } finally {
      setValidationStatus('idle');
    }
  };

  const testConfiguration = async () => {
    try {
      setValidationStatus('testing');
      addStatusMessage('info', 'Testing configuration with actual LLM calls...');

      const response = await apiFetch('/api/config/test', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        const testData = result.data;

        addStatusMessage(
          'success',
          `Configuration test complete (Provider: ${testData.testResults.provider})`
        );

        // Show overall test status
        const statusIcon =
          testData.overallStatus === 'success'
            ? '✅'
            : testData.overallStatus === 'partial'
              ? '⚠️'
              : '❌';
        addStatusMessage(
          testData.overallStatus === 'success' ? 'success' : 'error',
          `${statusIcon} Test Status: ${testData.overallStatus.toUpperCase()}`
        );

        // Show test summary
        const summary = testData.summary;
        addStatusMessage(
          'info',
          `📊 Results: ${summary.passed}/${summary.total} tests passed, ${summary.failed} failed, ${summary.partial} partial`
        );

        // Show individual test results
        Object.entries(testData.testResults.tests).forEach(([testName, test]: [string, any]) => {
          const testIcon =
            test.status === 'success' ? '✅' : test.status === 'partial' ? '⚠️' : '❌';
          addStatusMessage(
            test.status === 'success' ? 'success' : 'error',
            `${testIcon} ${testName}: ${test.message}`
          );
        });
      } else {
        const error = await response.json();
        addStatusMessage(
          'error',
          `Configuration test failed: ${error.error?.message || 'Unknown error'}`
        );
      }
    } catch (_error) {
      addStatusMessage('error', 'Configuration test failed: Network error');
    } finally {
      setValidationStatus('idle');
    }
  };

  const resetAgent = async () => {
    // Log warning instead of using confirm dialog
    console.warn('Agent reset initiated - this will permanently delete all data!');

    setIsResetting(true);
    try {
      const response = await apiFetch('/api/reset-agent', {
        method: 'POST',
      });

      if (response.ok) {
        addStatusMessage('success', 'Agent reset successful - New agent instance started');
        setTimeout(() => {
          addStatusMessage('success', 'Fresh agent initialized. All previous data cleared.');
        }, 1000);
      } else {
        const error = await response.json();
        addStatusMessage('error', `Reset failed: ${error.details || error.error}`);
      }
    } catch (_error) {
      addStatusMessage('error', 'Reset failed: Network error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="terminal-container" data-testid="settings-interface">
      {/* Top Navigation Panel */}
      <div
        style={{
          background: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            <Settings className="w-5 h-5" />
            <span>SETTINGS</span>
          </div>

          {/* Navigation Links */}
          {onViewSwitch && (
            <div style={{ display: 'flex', gap: '4px', marginLeft: '24px' }}>
              <button
                onClick={() => onViewSwitch('terminal')}
                className="view-switch-btn"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--bg-primary)',
                  color: 'var(--bg-primary)',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-primary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--bg-primary)';
                }}
                title="Switch to Admin Terminal"
              >
                <Terminal className="w-3 h-3" />
                ADMIN TERMINAL
              </button>
              <button
                onClick={() => onViewSwitch('database')}
                className="view-switch-btn"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--bg-primary)',
                  color: 'var(--bg-primary)',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-primary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--bg-primary)';
                }}
                title="Switch to Database"
              >
                <Database className="w-3 h-3" />
                DATABASE
              </button>
              <button
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--bg-primary)',
                  color: 'var(--text-primary)',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                disabled
              >
                <Settings className="w-3 h-3" />
                SETTINGS
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--bg-primary)',
            fontWeight: 'bold',
          }}
        >
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </div>

      {/* Main Settings Content */}
      <div className="terminal-layout" style={{ flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '16px', padding: '16px', flex: 1 }}>
          {/* Configuration Panel */}
          <div style={{ flex: 2 }}>
            <div className="panel">
              <div className="panel-header">
                <span>◆ MODEL PROVIDER CONFIGURATION</span>
              </div>
              <div className="panel-content" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      PROVIDER
                    </label>
                    <select
                      style={{
                        width: '100%',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                      }}
                      value={configValues.environment?.MODEL_PROVIDER || 'openai'}
                      onChange={(e) => {
                        updatePluginConfig('environment', 'MODEL_PROVIDER', e.target.value);
                        updatePluginConfig('environment', 'LANGUAGE_MODEL', '');
                      }}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="ollama">Ollama (Local)</option>
                    </select>
                  </div>

                  {/* OpenAI Configuration */}
                  {(configValues.environment?.MODEL_PROVIDER === 'openai' ||
                    !configValues.environment?.MODEL_PROVIDER) && (
                    <>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          OPENAI API KEY
                        </label>
                        <input
                          type="password"
                          style={{
                            width: '100%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                          }}
                          value={configValues.environment?.OPENAI_API_KEY || ''}
                          placeholder={
                            pluginConfigs.environment?.OPENAI_API_KEY === '***SET***'
                              ? 'Currently Set'
                              : 'Enter OpenAI API Key'
                          }
                          onChange={(e) =>
                            updatePluginConfig('environment', 'OPENAI_API_KEY', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          MODEL
                        </label>
                        <select
                          style={{
                            width: '100%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                          }}
                          value={configValues.environment?.LANGUAGE_MODEL || 'gpt-4o-mini'}
                          onChange={(e) =>
                            updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                          }
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
                  {configValues.environment?.MODEL_PROVIDER === 'anthropic' && (
                    <>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          ANTHROPIC API KEY
                        </label>
                        <input
                          type="password"
                          style={{
                            width: '100%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                          }}
                          value={configValues.environment?.ANTHROPIC_API_KEY || ''}
                          placeholder={
                            pluginConfigs.environment?.ANTHROPIC_API_KEY === '***SET***'
                              ? 'Currently Set'
                              : 'Enter Anthropic API Key'
                          }
                          onChange={(e) =>
                            updatePluginConfig('environment', 'ANTHROPIC_API_KEY', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          MODEL
                        </label>
                        <select
                          style={{
                            width: '100%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                          }}
                          value={
                            configValues.environment?.LANGUAGE_MODEL || 'claude-3-5-sonnet-20241022'
                          }
                          onChange={(e) =>
                            updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                          }
                        >
                          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                          <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                          <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                          <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Ollama Configuration */}
                  {configValues.environment?.MODEL_PROVIDER === 'ollama' && (
                    <>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          OLLAMA SERVER URL
                        </label>
                        <input
                          type="text"
                          style={{
                            width: '100%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                          }}
                          value={
                            configValues.environment?.OLLAMA_SERVER_URL || 'http://localhost:11434'
                          }
                          placeholder="http://localhost:11434"
                          onChange={(e) =>
                            updatePluginConfig('environment', 'OLLAMA_SERVER_URL', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          MODEL
                        </label>
                        <input
                          type="text"
                          style={{
                            width: '100%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                          }}
                          value={configValues.environment?.LANGUAGE_MODEL || 'llama3.2:3b'}
                          placeholder="llama3.2:3b"
                          onChange={(e) =>
                            updatePluginConfig('environment', 'LANGUAGE_MODEL', e.target.value)
                          }
                        />
                        <div
                          style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}
                        >
                          Enter the model name as it appears in your Ollama installation
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      TEXT EMBEDDING MODEL
                    </label>
                    <input
                      type="text"
                      style={{
                        width: '100%',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                      }}
                      value={
                        configValues.environment?.TEXT_EMBEDDING_MODEL || 'text-embedding-3-small'
                      }
                      placeholder="text-embedding-3-small"
                      onChange={(e) =>
                        updatePluginConfig('environment', 'TEXT_EMBEDDING_MODEL', e.target.value)
                      }
                    />
                  </div>

                  {/* Configuration Testing */}
                  <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                    <button
                      style={{
                        padding: '8px 16px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onClick={validateConfiguration}
                      disabled={validationStatus === 'validating'}
                    >
                      {validationStatus === 'validating' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      VALIDATE CONFIG
                    </button>
                    <button
                      style={{
                        padding: '8px 16px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onClick={testConfiguration}
                      disabled={validationStatus === 'testing'}
                    >
                      {validationStatus === 'testing' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      TEST CONFIG
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div
                    style={{
                      marginTop: '24px',
                      padding: '16px',
                      border: '1px solid #ff4444',
                      backgroundColor: 'rgba(255, 68, 68, 0.1)',
                    }}
                  >
                    <div style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: '8px' }}>
                      ⚠️ DANGER ZONE
                    </div>
                    <button
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        border: '1px solid #ff4444',
                        color: '#ff4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onClick={resetAgent}
                      disabled={isResetting}
                    >
                      {isResetting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {isResetting ? 'RESETTING...' : 'RESET AGENT'}
                    </button>
                    <div style={{ fontSize: '10px', color: '#ff6666', marginTop: '4px' }}>
                      This will permanently delete all agent memories, goals, todos, and restart
                      with a fresh instance.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Panel */}
          <div style={{ flex: 1 }}>
            <div className="panel">
              <div className="panel-header">
                <span>◆ SYSTEM STATUS</span>
              </div>
              <div className="panel-content" style={{ padding: '16px' }}>
                <div
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {statusMessages.length === 0 ? (
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                      No status messages
                    </div>
                  ) : (
                    statusMessages.map((msg, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: '11px',
                          padding: '8px',
                          border: `1px solid ${
                            msg.type === 'success'
                              ? '#00ff00'
                              : msg.type === 'error'
                                ? '#ff4444'
                                : '#ffaa00'
                          }`,
                          color:
                            msg.type === 'success'
                              ? '#00ff00'
                              : msg.type === 'error'
                                ? '#ff4444'
                                : '#ffaa00',
                          fontFamily: 'monospace',
                          backgroundColor: `${
                            msg.type === 'success'
                              ? 'rgba(0, 255, 0, 0.1)'
                              : msg.type === 'error'
                                ? 'rgba(255, 68, 68, 0.1)'
                                : 'rgba(255, 170, 0, 0.1)'
                          }`,
                        }}
                      >
                        {msg.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
