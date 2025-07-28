import React, { useEffect, useState } from 'react';
import { TauriService, OllamaModelStatus, ModelDownloadProgress } from '../services/TauriService';
import './ModelLoadingScreen.css';

interface ModelLoadingScreenProps {
  onComplete: () => void;
}

export const ModelLoadingScreen: React.FC<ModelLoadingScreenProps> = ({ onComplete }) => {
  const [modelStatus, setModelStatus] = useState<OllamaModelStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkModels();
  }, []);

  useEffect(() => {
    if (!isDownloading) return;

    // Listen for download progress
    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenProgress = await TauriService.onModelDownloadProgress((progress) => {
        setDownloadProgress(progress);
      });

      unlistenComplete = await TauriService.onModelDownloadComplete((result) => {
        if (result.success) {
          setIsDownloading(false);
          setDownloadProgress(null);
          // Re-check models after download
          checkModels();
        } else {
          setError(result.error || 'Failed to download models');
          setIsDownloading(false);
        }
      });
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, [isDownloading]);

  const checkModels = async () => {
    try {
      const status = await TauriService.checkOllamaModels();
      setModelStatus(status);
      
      if (status.models_ready) {
        // All models are ready, proceed
        onComplete();
      }
    } catch (err) {
      console.error('Failed to check models:', err);
      setError('Failed to check model status');
    }
  };

  const startDownload = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      await TauriService.pullMissingModels();
    } catch (err) {
      console.error('Failed to start model download:', err);
      setError('Failed to start model download');
      setIsDownloading(false);
    }
  };

  if (!modelStatus) {
    return (
      <div className="model-loading-screen">
        <div className="loading-content">
          <div className="spinner"></div>
          <h2>Checking AI Models...</h2>
        </div>
      </div>
    );
  }

  if (modelStatus.models_ready) {
    return null; // Models are ready, don't show loading screen
  }

  return (
    <div className="model-loading-screen">
      <div className="loading-content">
        <h1>AI Models Required</h1>
        
        {!isDownloading && (
          <>
            <p>The following AI models need to be downloaded:</p>
            <ul className="model-list">
              {modelStatus.missing_models.map((model) => (
                <li key={model}>{model}</li>
              ))}
            </ul>
            
            <div className="model-info">
              <p>Total download size: ~4GB</p>
              <p>This is a one-time download</p>
            </div>

            <button 
              className="download-button"
              onClick={startDownload}
              disabled={isDownloading}
            >
              Download Models
            </button>
          </>
        )}

        {isDownloading && downloadProgress && (
          <div className="download-progress">
            <h3>Downloading: {downloadProgress.model}</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${downloadProgress.progress}%` }}
              />
            </div>
            <p>{downloadProgress.progress}% complete</p>
            {downloadProgress.status === 'downloading' && (
              <p className="status">Please wait, this may take several minutes...</p>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
            <button onClick={checkModels}>Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}; 