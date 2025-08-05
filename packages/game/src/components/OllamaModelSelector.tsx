import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ModelInfo {
  name: string;
  description: string;
  min_memory_gb: number;
  recommended: boolean;
  installed: boolean;
}

interface OllamaRecommendations {
  success: boolean;
  system_info: {
    total_memory_gb: number;
    total_memory_mb: number;
    recommended_memory_mb: number;
    has_sufficient_memory: boolean;
  };
  recommended_models: ModelInfo[];
  all_models: ModelInfo[];
  default_model: string;
  installed_models: string[];
}

interface OllamaModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

export const OllamaModelSelector: React.FC<OllamaModelSelectorProps> = ({ value, onChange }) => {
  const [recommendations, setRecommendations] = useState<OllamaRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    model: string;
    percentage: number;
    currentMb: number;
    totalMb: number;
  } | null>(null);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await invoke<OllamaRecommendations>('get_ollama_model_recommendations');

      if (result.success) {
        setRecommendations(result);
      } else {
        setError('Failed to fetch model recommendations');
      }
    } catch (err) {
      console.error('Error fetching Ollama recommendations:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  if (loading) {
    return (
      <div className="py-2 text-xs text-gray-400">Loading Ollama models...</div>
    );
  }

  if (error) {
    return (
      <div className="mb-4">
        <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">Model</label>
        <input
          type="text"
          className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none placeholder:text-gray-500 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
          value={value || 'llama3.2:3b'}
          placeholder="llama3.2:3b"
          onChange={(e) => onChange(e.target.value)}
          data-testid="ollama-model-input"
        />
        <small className="block mt-1 text-terminal-red text-[10px]">
          Error loading recommendations: {error}
        </small>
      </div>
    );
  }

  if (!recommendations) {
    return null;
  }

  const { system_info, recommended_models, all_models } = recommendations;

  return (
    <div className="mb-4">
      <div className="mb-3 p-3 bg-black/40 border border-terminal-green/20">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-base">💾</span>
          <span className="text-terminal-green font-bold">{system_info.total_memory_gb.toFixed(1)} GB RAM</span>
        </div>
        {!system_info.has_sufficient_memory && (
          <div className="mt-2 text-terminal-yellow text-[10px]">
            ⚠️ Limited memory detected. Smaller models recommended.
          </div>
        )}
      </div>

      <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider font-semibold">Model</label>
      <select
        className="w-full py-2.5 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none cursor-pointer transition-none appearance-none pr-8 bg-no-repeat bg-[right_12px_center] bg-[length:12px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80 focus:shadow-[inset_0_0_0_1px_rgba(0,255,0,0.2)]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Cpath d='M0 0 L6 6 L12 0' fill='none' stroke='%2300ff00' stroke-width='1.5'/%3E%3C/svg%3E\")",
        }}
        value={value || recommendations.default_model}
        onChange={(e) => onChange(e.target.value)}
        data-testid="ollama-model-select"
      >
        {recommended_models.length > 0 && (
          <optgroup label="✨ Recommended for your system">
            {recommended_models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name} - {model.description}
                {model.installed && ' ✓'}
              </option>
            ))}
          </optgroup>
        )}

        {all_models.filter((m) => !m.recommended).length > 0 && (
          <optgroup label="⚡ Other models (may require more memory)">
            {all_models
              .filter((m) => !m.recommended)
              .map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name} - {model.description} (needs {model.min_memory_gb}GB)
                  {model.installed && ' ✓'}
                </option>
              ))}
          </optgroup>
        )}
      </select>

      {/* Manual input fallback */}
      <div className="mt-3">
        <details className="cursor-pointer">
          <summary className="text-[10px] text-gray-400 hover:text-gray-300">
            Enter custom model name
          </summary>
          <input
            type="text"
            className="mt-2 w-full py-2 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none placeholder:text-gray-500 focus:border-terminal-green focus:bg-black/80"
            value={value || ''}
            placeholder="e.g., llama3.2:3b or custom-model:latest"
            onChange={(e) => onChange(e.target.value)}
          />
        </details>
      </div>

      {/* Model download button */}
      {value && !recommendations.installed_models.includes(value) && (
        <div className="mt-3 p-3 bg-terminal-yellow/10 border border-terminal-yellow/20 text-terminal-yellow text-[11px]">
          <div className="mb-2">⚠️ Model "{value}" is not installed locally.</div>
          <button
            className="py-1.5 px-3 bg-terminal-yellow/20 border border-terminal-yellow/30 text-terminal-yellow font-mono text-xs uppercase transition-none hover:bg-terminal-yellow/30 hover:border-terminal-yellow disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={async () => {
              try {
                setIsDownloading(true);
                const result = await invoke<{ success: boolean; message?: string }>(
                  'download_ollama_model',
                  { modelName: value }
                );
                if (result.success) {
                  await fetchRecommendations(); // Refresh the list
                }
              } catch (err) {
                console.error('Failed to download model:', err);
              } finally {
                setIsDownloading(false);
              }
            }}
            disabled={isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Download Model'}
          </button>
        </div>
      )}

      {/* Download progress */}
      {isDownloading && downloadProgress && (
        <div className="mt-3 p-3 bg-black/40 border border-terminal-green/20">
          <div className="text-xs text-terminal-green mb-2">
            Downloading {downloadProgress.model}...
          </div>
          <div className="w-full h-2 bg-black/60 border border-terminal-green/30 relative overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-terminal-green transition-all duration-300"
              style={{ width: `${downloadProgress.percentage}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-gray-400">
            {downloadProgress.currentMb.toFixed(1)} MB / {downloadProgress.totalMb.toFixed(1)} MB ({downloadProgress.percentage.toFixed(1)}%)
          </div>
        </div>
      )}

      {/* Selected model info */}
      {value && (
        <div className="mt-3 space-y-2">
          {recommended_models
            .concat(all_models)
            .filter((m) => m.name === value)
            .map((model) => (
              <div key={model.name} className="p-3 bg-black/40 border border-terminal-green/20">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-terminal-green">
                      {model.name} {model.installed && <span className="text-terminal-green">✓ Installed</span>}
                    </div>
                    <div className="text-[10px] text-gray-400">{model.description}</div>
                    <div className="text-[10px] text-gray-500">
                      Requires: {model.min_memory_gb}GB RAM
                    </div>
                  </div>
                  {model.recommended && (
                    <span className="px-1.5 py-0.5 bg-terminal-green/20 border border-terminal-green/30 text-terminal-green text-[10px] uppercase">
                      Recommended
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="mt-3 text-[10px] text-gray-500">
        <div>• Models marked with ✓ are already installed</div>
        <div>• Recommended models are optimized for your system</div>
        <div>• Visit <a href="https://ollama.ai/library" target="_blank" rel="noopener noreferrer" className="text-terminal-blue hover:underline">ollama.ai/library</a> for more models</div>
      </div>
    </div>
  );
};