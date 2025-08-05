import { useState, useEffect } from 'react';

import { TauriWindow } from '../types/shared';
import { env } from '../config/environment';
import { createLogger } from '../utils/logger';

declare global {
  interface Window extends TauriWindow {}
}

const logger = createLogger('StartupFlow');

interface ModelDownloadProgress {
  model_name: string;
  current_mb: number;
  total_mb: number;
  percentage: number;
  speed_mbps: number;
  eta_seconds: number;
  status: 'Downloading' | 'Completed' | 'Failed' | 'AlreadyExists';
}

interface StartupStatus {
  stage: string;
  progress: number;
  description: string;
  error?: string;
  model_progress?: ModelDownloadProgress;
}

interface UserConfig {
  ai_provider: 'OpenAI' | 'Anthropic' | 'Ollama';
  api_key?: string;
  use_local_ollama?: boolean;
}

interface StartupFlowProps {
  onComplete: () => void;
}

export default function StartupFlow({ onComplete }: StartupFlowProps) {
  const [currentStep, setCurrentStep] = useState<'config' | 'progress' | 'error'>('config');
  const [userConfig, setUserConfig] = useState<UserConfig>({
    ai_provider: 'OpenAI',
    use_local_ollama: true,
  });
  const [startupStatus, setStartupStatus] = useState<StartupStatus>({
    stage: 'Initializing',
    progress: 0,
    description: 'Preparing to start...',
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tauriAvailable, setTauriAvailable] = useState(!!window.__TAURI__);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isFirefox, setIsFirefox] = useState(false);
  const [environmentIssues, setEnvironmentIssues] = useState<string[]>([]);
  const [setupStarted, setSetupStarted] = useState(false);

  useEffect(() => {
    setupTauriOrFallback();
  }, []);

  const setupTauriOrFallback = async () => {
    logger.info('Setting up Tauri or fallback');
    const userAgent = navigator.userAgent.toLowerCase();
    setIsFirefox(userAgent.includes('firefox'));

    // Clear any previous environment issues first
    setEnvironmentIssues([]);

    if ((window as any).__TAURI__) {
      logger.info('Tauri environment detected');
      setTauriAvailable(true);
      await setupTauriListeners();
    } else {
      logger.warn('Tauri not available, using browser fallback');
      // Only add browser mode message if we're actually in a browser
      setEnvironmentIssues(['Running in browser mode (limited functionality)']);
    }
  };

  const setupTauriListeners = async () => {
    logger.info('Setting up Tauri listeners');
    const { listen } = await import('@tauri-apps/api/event');

    // Listen for startup status updates
    await listen<StartupStatus>('startup-status', (event) => {
      logger.info('Received startup status', event.payload);
      setStartupStatus(event.payload);

      // Handle errors
      if (event.payload.error) {
        setErrorMessage(event.payload.error);
        setCurrentStep('error');
      }

      // Handle completion
      if (event.payload.progress >= 100) {
        logger.info('Startup completed');
        setTimeout(() => {
          onComplete();
        }, 1000);
      }
    });

    // Listen for model download progress
    await listen<ModelDownloadProgress>('model-download-progress', (event) => {
      logger.info('Model download progress', event.payload);
      setStartupStatus((prev) => ({
        ...prev,
        model_progress: event.payload,
      }));
    });

    // Listen for agent log events
    await listen('agent-log', (event) => {
      logger.debug('Agent log', { payload: event.payload });
    });
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isFocused = document.visibilityState === 'visible';
      setIsTabFocused(isFocused);
      logger.info('Tab visibility changed', { isFocused });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle Firefox-specific issues
  useEffect(() => {
    if (isFirefox && currentStep === 'progress' && startupStatus.progress === 0) {
      const checkTimer = setTimeout(() => {
        if (startupStatus.progress === 0) {
          setEnvironmentIssues((prev) => [
            ...prev,
            'Firefox detected: If progress is stuck, try refreshing the page',
          ]);
        }
      }, 5000);

      return () => clearTimeout(checkTimer);
    }
  }, [isFirefox, currentStep, startupStatus.progress]);

  // Handle focus issues
  useEffect(() => {
    if (currentStep === 'progress' && !isTabFocused) {
      setEnvironmentIssues((prev) => {
        if (!prev.includes('Tab is not focused')) {
          return [...prev, 'Tab is not focused: Progress may be paused'];
        }
        return prev;
      });
    } else {
      setEnvironmentIssues((prev) => prev.filter((issue) => issue !== 'Tab is not focused: Progress may be paused'));
    }
  }, [currentStep, isTabFocused]);

  // Auto-retry mechanism for stuck progress
  useEffect(() => {
    const pollSetupProgress = async () => {
      if (currentStep !== 'progress' || !setupStarted) return;

      // Only implement auto-retry if we're stuck at 0% for too long
      if (startupStatus.progress === 0 && retryCount < 3) {
        const retryTimer = setTimeout(() => {
          if (startupStatus.progress === 0) {
            logger.warn('Progress stuck at 0%, attempting retry', { retryCount });
            setRetryCount((prev) => prev + 1);
            // In Tauri, we might want to invoke a retry command
            if ((window as any).__TAURI__) {
              logger.info('Attempting to restart setup via Tauri');
              // Note: You'd need to implement this command in Tauri
              // invoke('retry_setup').catch(console.error);
            }
          }
        }, 10000); // Wait 10 seconds before retry

        return () => clearTimeout(retryTimer);
      }
    };

    pollSetupProgress();
  }, [currentStep, startupStatus.progress, retryCount, setupStarted]);

  // Fallback progress simulation for browser mode
  useEffect(() => {
    if (!tauriAvailable && currentStep === 'progress') {
      simulateBrowserStartup();
    }
  }, [currentStep, tauriAvailable]);

  const simulateBrowserStartup = async () => {
    logger.info('Simulating browser startup');
    const stages = [
      { stage: 'Checking environment', progress: 10, duration: 500 },
      { stage: 'Loading configuration', progress: 30, duration: 800 },
      { stage: 'Initializing AI provider', progress: 50, duration: 1000 },
      { stage: 'Setting up interface', progress: 70, duration: 800 },
      { stage: 'Finalizing setup', progress: 90, duration: 600 },
      { stage: 'Ready', progress: 100, duration: 400 },
    ];

    for (const { stage, progress, duration } of stages) {
      await new Promise((resolve) => setTimeout(resolve, duration));
      setStartupStatus({
        stage,
        progress,
        description: `${stage}...`,
      });
    }

    setTimeout(onComplete, 500);
  };

  const validateConfig = (): string | null => {
    if (userConfig.ai_provider === 'OpenAI' || userConfig.ai_provider === 'Anthropic') {
      if (!userConfig.api_key) {
        return `${userConfig.ai_provider} API key is required`;
      }
      if (userConfig.api_key.length < 20) {
        return 'API key seems too short. Please check and try again.';
      }
    }

    if (userConfig.ai_provider === 'Ollama' && !userConfig.use_local_ollama) {
      return 'Please enable local Ollama or choose a different AI provider';
    }

    return null;
  };

  const handleConfigSubmit = async () => {
    const error = validateConfig();
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError('');
    setIsSubmitting(true);
    setSetupStarted(true);

    try {
      if ((window as any).__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core');
        logger.info('Submitting configuration to Tauri');

        await invoke('save_user_config', { config: userConfig });
        await invoke('start_setup', { config: userConfig });

        setCurrentStep('progress');
      } else {
        // Browser fallback
        logger.info('Running browser setup');

        // Save to localStorage
        localStorage.setItem('eliza_config', JSON.stringify(userConfig));

        // Check environment configuration
        if (userConfig.ai_provider === 'OpenAI' && !env.VITE_OPENAI_API_KEY) {
          setEnvironmentIssues((prev) => [
            ...prev,
            'OpenAI API key not found in environment. Using provided key.',
          ]);
        }

        setCurrentStep('progress');
      }
    } catch (error) {
      logger.error('Setup submission failed', error);
      setErrorMessage(`Failed to start setup: ${error}`);
      setCurrentStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = async () => {
    logger.info('Retrying setup');
    setErrorMessage('');
    setStartupStatus({
      stage: 'Initializing',
      progress: 0,
      description: 'Preparing to start...',
    });
    setRetryCount(0);
    setEnvironmentIssues([]);
    setCurrentStep('config');
  };

  const renderConfigForm = () => (
    <div className="flex items-center justify-center min-h-screen bg-black p-8">
      <div className="max-w-2xl w-full bg-gradient-to-br from-gray-900 to-black border border-terminal-green-border p-8">
        <h1 className="text-3xl font-bold text-terminal-green text-center mb-8 uppercase tracking-wider">
          ElizaOS Setup
        </h1>

        <form onSubmit={(e) => { e.preventDefault(); handleConfigSubmit(); }} className="space-y-6">
          <div>
            <label className="block mb-2 text-sm font-semibold text-terminal-green uppercase tracking-wider">
              AI Provider
            </label>
            <select
              value={userConfig.ai_provider}
              onChange={(e) => setUserConfig({ ...userConfig, ai_provider: e.target.value as UserConfig['ai_provider'] })}
              className="w-full py-3 px-4 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-sm outline-none cursor-pointer transition-none appearance-none pr-10 bg-no-repeat bg-[right_12px_center] bg-[length:16px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='8' viewBox='0 0 16 8'%3E%3Cpath d='M0 0 L8 8 L16 0' fill='none' stroke='%2300ff00' stroke-width='2'/%3E%3C/svg%3E\")",
              }}
              disabled={isSubmitting}
            >
              <option value="OpenAI">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
              <option value="Ollama">Ollama (Local)</option>
            </select>
          </div>

          {(userConfig.ai_provider === 'OpenAI' || userConfig.ai_provider === 'Anthropic') && (
            <div>
              <label className="block mb-2 text-sm font-semibold text-terminal-green uppercase tracking-wider">
                {userConfig.ai_provider} API Key
              </label>
              <input
                type="password"
                value={userConfig.api_key}
                onChange={(e) => setUserConfig({ ...userConfig, api_key: e.target.value })}
                className="w-full py-3 px-4 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-sm outline-none transition-none placeholder:text-gray-500 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
                placeholder={`Enter your ${userConfig.ai_provider} API key`}
                disabled={isSubmitting}
              />
              <div className="mt-2 text-xs text-gray-400">
                <p>
                  {userConfig.ai_provider === 'OpenAI'
                    ? 'Get your API key from platform.openai.com'
                    : 'Get your API key from console.anthropic.com'}
                </p>
              </div>
            </div>
          )}

          {userConfig.ai_provider === 'Ollama' && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userConfig.use_local_ollama}
                  onChange={(e) =>
                    setUserConfig({ ...userConfig, use_local_ollama: e.target.checked })
                  }
                  disabled={isSubmitting}
                  className="w-4 h-4 accent-terminal-green cursor-pointer"
                />
                <span className="text-sm text-terminal-green">Use local Ollama installation</span>
              </label>
              <div className="mt-2 text-xs text-gray-400">
                <p>Requires Ollama to be installed and running locally</p>
              </div>
            </div>
          )}



          {validationError && (
            <div className="p-3 bg-terminal-red/10 border border-terminal-red text-terminal-red text-sm">
              {validationError}
            </div>
          )}

          {environmentIssues.length > 0 && (
            <div className="p-3 bg-terminal-yellow/10 border border-terminal-yellow">
              <div className="text-sm font-semibold text-terminal-yellow mb-2">Environment Notices:</div>
              <ul className="list-disc list-inside text-xs text-terminal-yellow space-y-1">
                {environmentIssues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 bg-terminal-green text-black font-mono text-sm font-bold uppercase tracking-wider transition-none hover:bg-terminal-green/90 active:transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Starting Setup...' : 'Start ElizaOS'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderProgress = () => (
    <div className="flex items-center justify-center min-h-screen bg-black p-8">
      <div className="max-w-lg w-full bg-gradient-to-br from-gray-900 to-black border border-terminal-green-border p-8">
        <h2 className="text-2xl font-bold text-terminal-green text-center mb-8 uppercase tracking-wider">
          Setting Up ElizaOS
        </h2>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-terminal-green">{startupStatus.stage}</span>
              <span className="text-sm text-terminal-green font-mono">{startupStatus.progress}%</span>
            </div>
            <div className="w-full h-3 bg-black/60 border border-terminal-green/30 relative overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-terminal-green transition-all duration-500"
                style={{ width: `${startupStatus.progress}%` }}
              />
            </div>
          </div>

          <p className="text-center text-gray-400 text-sm">{startupStatus.description}</p>

          {/* Model download progress */}
          {startupStatus.model_progress && (
            <div className="p-4 bg-black/60 border border-terminal-green/20 space-y-3">
              <div className="text-sm font-semibold text-terminal-green">
                Downloading Model: {startupStatus.model_progress.model_name}
              </div>
              <div className="w-full h-2 bg-black/80 border border-terminal-green/30 relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-terminal-blue transition-all duration-300"
                  style={{ width: `${startupStatus.model_progress.percentage}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <div>
                  {startupStatus.model_progress.current_mb.toFixed(1)} MB / {startupStatus.model_progress.total_mb.toFixed(1)} MB
                </div>
                <div>
                  Speed: {startupStatus.model_progress.speed_mbps.toFixed(1)} MB/s
                </div>
                {startupStatus.model_progress.eta_seconds > 0 && (
                  <div>
                    ETA: {Math.floor(startupStatus.model_progress.eta_seconds / 60)}m {startupStatus.model_progress.eta_seconds % 60}s
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Environment issues */}
          {environmentIssues.length > 0 && (
            <div className="p-3 bg-terminal-yellow/10 border border-terminal-yellow">
              <ul className="list-disc list-inside text-xs text-terminal-yellow space-y-1">
                {environmentIssues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Retry indicator */}
          {retryCount > 0 && (
            <div className="text-center text-xs text-gray-500">
              Retry attempt {retryCount} of 3
            </div>
          )}
        </div>


      </div>
    </div>
  );

  const renderError = () => (
    <div className="flex items-center justify-center min-h-screen bg-black p-8">
      <div className="max-w-lg w-full bg-gradient-to-br from-gray-900 to-black border border-terminal-red-border p-8">
        <div className="text-6xl text-center mb-4">❌</div>
        <h2 className="text-2xl font-bold text-terminal-red text-center mb-4">Setup Failed</h2>
        <p className="text-terminal-green text-center mb-6">{errorMessage}</p>
        
        {environmentIssues.length > 0 && (
          <div className="mb-6 p-3 bg-terminal-yellow/10 border border-terminal-yellow">
            <div className="text-sm font-semibold text-terminal-yellow mb-2">Known Issues:</div>
            <ul className="list-disc list-inside text-xs text-terminal-yellow space-y-1">
              {environmentIssues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleRetry}
          className="w-full py-3 px-6 bg-terminal-red/20 border border-terminal-red text-terminal-red font-mono text-sm font-bold uppercase tracking-wider transition-none hover:bg-terminal-red/30 hover:border-terminal-red"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  switch (currentStep) {
    case 'config':
      return renderConfigForm();
    case 'progress':
      return renderProgress();
    case 'error':
      return renderError();
    default:
      return null;
  }
}