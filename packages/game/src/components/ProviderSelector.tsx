import React, { useState, useEffect } from 'react';

interface Provider {
  name: string;
  display_name: string;
  enabled: boolean;
  requires_api_key: boolean;
  status: 'available' | 'not_configured' | 'error';
  message: string;
}

interface ProviderStatus {
  providers: Provider[];
  active: string;
  selected: string | null;
  preferences: string[];
}

interface ProviderResponse {
  success: boolean;
  data: ProviderStatus;
}

interface ProviderSelectorProps {
  onProviderChange?: (provider: string) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ onProviderChange }) => {
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkTauri = async () => {
      if (window.__TAURI__) {
        setIsTauri(true);
      } else {
        setError('Not running in Tauri environment');
        setLoading(false);
      }
    };

    checkTauri();
  }, []);

  const fetchProviders = async () => {
    if (!window.__TAURI__) return;

    try {
      setLoading(true);
      setError(null);

      const { invoke } = await import('@tauri-apps/api/core');
      const response = await invoke<ProviderResponse>('get_provider_status');

      if (response.success) {
        setProviderStatus(response.data);
      } else {
        setError('Failed to fetch provider status');
      }
    } catch (err) {
      console.error('Error fetching providers:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (provider: string | null) => {
    if (!window.__TAURI__ || !provider) return;

    try {
      setStatusMessage(`Switching to ${provider}...`);
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_provider', { provider });

      // Refresh the provider list
      await fetchProviders();
      setStatusMessage(`Successfully switched to ${provider}`);

      // Notify parent component
      if (onProviderChange) {
        onProviderChange(provider);
      }

      // Clear status message after 3 seconds
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Error changing provider:', err);
      setStatusMessage(`Failed to switch provider: ${err}`);
    }
  };

  useEffect(() => {
    if (isTauri) {
      fetchProviders();
      // Poll for updates every 30 seconds
      const interval = setInterval(fetchProviders, 30000);
      return () => clearInterval(interval);
    }
  }, [isTauri]);

  if (loading) {
    return <div className="p-4 text-terminal-green text-sm">Loading providers...</div>;
  }

  if (error) {
    return <div className="p-4 text-terminal-red text-sm">Error: {error}</div>;
  }

  if (!providerStatus) {
    return <div className="p-4 text-gray-400 text-sm">No provider data available</div>;
  }

  const availableProviders = providerStatus.providers.filter((p) => p.status === 'available');
  const currentProvider = providerStatus.selected || providerStatus.active;

  return (
    <div className="p-5 bg-black/60 border border-terminal-green-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-terminal-green uppercase tracking-wider">AI Provider Selection</h3>
        <button 
          className="px-2 py-1 text-terminal-green hover:text-terminal-green/80 transition-colors"
          onClick={fetchProviders} 
          title="Refresh provider status"
        >
          ↻
        </button>
      </div>

      <div className="mb-4">
        <label className="text-xs text-terminal-green/70 uppercase tracking-wider">Active Provider:</label>
        <span className="ml-2 text-sm font-bold text-terminal-green">
          {providerStatus.providers.find((p) => p.name === currentProvider)?.display_name ||
            currentProvider}
        </span>
      </div>

      <div>
        <label className="block mb-2 text-xs text-terminal-green/70 uppercase tracking-wider">Available Providers:</label>
        <div className="space-y-2">
          {availableProviders.map((provider) => (
            <div
              key={provider.name}
              className={`border transition-none ${
                provider.name === currentProvider 
                  ? 'border-terminal-green bg-terminal-green/10' 
                  : 'border-terminal-green/30 bg-black/40 hover:bg-black/60 hover:border-terminal-green/50'
              }`}
            >
              <button
                className="w-full p-3 text-left flex items-center justify-between"
                onClick={() => handleProviderChange(provider.name)}
                disabled={provider.name === currentProvider}
              >
                <div className="flex-1">
                  <span className="block text-sm font-bold text-terminal-green">{provider.display_name}</span>
                  <span className="block text-xs text-gray-400 mt-1">{provider.message}</span>
                </div>
                {provider.name === currentProvider && (
                  <span className="text-terminal-green text-lg ml-2">✓</span>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {providerStatus.providers.filter((p) => p.status === 'not_configured').length > 0 && (
        <div className="mt-4 p-3 bg-terminal-yellow/10 border border-terminal-yellow">
          <h4 className="text-xs font-bold text-terminal-yellow mb-2 uppercase tracking-wider">Not Configured:</h4>
          {providerStatus.providers
            .filter((p) => p.status === 'not_configured')
            .map((provider) => (
              <div key={provider.name} className="text-xs text-terminal-yellow mb-1">
                <span className="font-bold">{provider.display_name}:</span> {provider.message}
              </div>
            ))}
        </div>
      )}

      {statusMessage && (
        <div className={`mt-4 p-3 text-sm border ${
          statusMessage.includes('Failed') 
            ? 'bg-terminal-red/10 border-terminal-red text-terminal-red' 
            : 'bg-terminal-green/10 border-terminal-green text-terminal-green'
        }`}>
          {statusMessage}
        </div>
      )}

      {providerStatus.preferences.length > 0 && (
        <div className="mt-4 pt-4 border-t border-terminal-green/20">
          <h4 className="text-xs text-terminal-green/70 mb-2 uppercase tracking-wider">Provider Preference Order:</h4>
          <ol className="list-decimal list-inside text-xs text-gray-400 space-y-1">
            {providerStatus.preferences.map((pref) => (
              <li key={pref}>
                {providerStatus.providers.find((p) => p.name === pref)?.display_name || pref}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};