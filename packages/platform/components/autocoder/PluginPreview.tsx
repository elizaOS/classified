'use client';

import { useState, useEffect } from 'react';
import { Project, PluginBuild, TestResult } from './AutocoderWorkspace';

interface PluginPreviewProps {
  project: Project;
  build?: PluginBuild;
}

export function PluginPreview({ project, build }: PluginPreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<
    'code' | 'tests' | 'docs' | 'live'
  >('code');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [liveTestResults, setLiveTestResults] = useState<TestResult[]>([]);

  useEffect(() => {
    if (build?.files && !selectedFile) {
      // Auto-select main file
      const mainFiles = [
        'index.ts',
        'index.js',
        'src/index.ts',
        'src/index.js',
      ];
      const availableFile = mainFiles.find((file) => build.files[file]);
      if (availableFile) {
        setSelectedFile(availableFile);
      } else {
        // Select first file if no main file found
        const firstFile = Object.keys(build.files)[0];
        setSelectedFile(firstFile);
      }
    }
  }, [build, selectedFile]);

  const runLiveTest = async () => {
    if (!build) {
      return;
    }

    setIsTestRunning(true);
    try {
      const response = await fetch(
        `/api/autocoder/projects/${project.id}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (response.ok) {
        const results = await response.json();
        setLiveTestResults(results.tests || []);
      }
    } catch (error) {
      console.error('Failed to run tests:', error);
    } finally {
      setIsTestRunning(false);
    }
  };

  const downloadPlugin = async () => {
    if (!build) {
      return;
    }

    try {
      const response = await fetch(
        `/api/autocoder/projects/${project.id}/download`,
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}-plugin.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download plugin:', error);
    }
  };

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const getLanguageFromExtension = (ext: string): string => {
    const langMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      json: 'json',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
      css: 'css',
      html: 'html',
    };
    return langMap[ext] || 'text';
  };

  const formatQualityScore = (score: number): string => {
    return `${Math.round(score)}%`;
  };

  const getQualityColor = (score: number): string => {
    if (score >= 90) {
      return 'text-green-600';
    }
    if (score >= 70) {
      return 'text-yellow-600';
    }
    return 'text-red-600';
  };

  if (!build) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            Build in Progress
          </h3>
          <p className="text-gray-600">
            Your plugin is being built. Come back here when it's complete to
            preview and test it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* File Explorer */}
      <div className="flex w-64 flex-col border-r border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-gray-900">Plugin Files</h3>
          <p className="mt-1 text-sm text-gray-600">
            {Object.keys(build.files).length} files generated
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {Object.keys(build.files).map((filename) => (
              <button
                key={filename}
                onClick={() => setSelectedFile(filename)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedFile === filename
                    ? 'border border-blue-200 bg-blue-100 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {getFileExtension(filename).toUpperCase()}
                  </span>
                  <span className="truncate">{filename}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="border-t border-gray-200 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-900">
            Quality Metrics
          </h4>
          <div className="space-y-2">
            {[
              { label: 'Code Quality', value: build.quality.codeQuality },
              { label: 'Test Coverage', value: build.quality.testCoverage },
              { label: 'Security', value: build.quality.security },
              { label: 'Performance', value: build.quality.performance },
              { label: 'Documentation', value: build.quality.documentation },
            ].map((metric) => (
              <div
                key={metric.label}
                className="flex items-center justify-between"
              >
                <span className="text-xs text-gray-600">{metric.label}</span>
                <span
                  className={`text-xs font-medium ${getQualityColor(metric.value)}`}
                >
                  {formatQualityScore(metric.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex flex-1 flex-col">
        {/* Preview Mode Tabs */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex space-x-6">
              {[
                { key: 'code', label: 'Code', icon: '💻' },
                { key: 'tests', label: 'Tests', icon: '🧪' },
                { key: 'docs', label: 'Docs', icon: '📚' },
                { key: 'live', label: 'Live Test', icon: '🚀' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() =>
                    setPreviewMode(
                      tab.key as 'code' | 'tests' | 'docs' | 'live',
                    )
                  }
                  className={`flex items-center space-x-2 border-b-2 pb-4 text-sm font-medium transition-colors ${
                    previewMode === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={runLiveTest}
                disabled={isTestRunning}
                className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isTestRunning ? 'Testing...' : 'Run Tests'}
              </button>
              <button
                onClick={downloadPlugin}
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
              >
                Download
              </button>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden">
          {previewMode === 'code' && selectedFile && (
            <div className="flex h-full flex-col">
              <div className="bg-gray-800 px-4 py-2 text-sm text-gray-200">
                {selectedFile}
              </div>
              <div className="flex-1 overflow-auto">
                <pre className="h-full overflow-auto bg-gray-900 p-4 font-mono text-sm text-gray-100">
                  <code
                    className={`language-${getLanguageFromExtension(getFileExtension(selectedFile))}`}
                  >
                    {build.files[selectedFile]}
                  </code>
                </pre>
              </div>
            </div>
          )}

          {previewMode === 'tests' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="mx-auto max-w-4xl">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  Test Results
                </h3>

                <div className="space-y-4">
                  {(liveTestResults.length > 0
                    ? liveTestResults
                    : build.tests
                  ).map((test, index) => (
                    <div
                      key={index}
                      className={`rounded-lg border-2 p-4 ${
                        test.status === 'passed'
                          ? 'border-green-200 bg-green-50'
                          : test.status === 'failed'
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          {test.name}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              test.status === 'passed'
                                ? 'bg-green-100 text-green-800'
                                : test.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {test.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {test.duration}ms
                          </span>
                        </div>
                      </div>
                      {test.message && (
                        <p className="text-sm text-gray-600">{test.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {previewMode === 'docs' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="prose prose-gray mx-auto max-w-4xl">
                <h1>{project.name}</h1>
                <p>{project.description}</p>

                <h2>Installation</h2>
                <pre className="rounded bg-gray-100 p-4">
                  <code>npm install {project.name}</code>
                </pre>

                <h2>Usage</h2>
                {build.files['README.md'] ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: build.files['README.md'],
                    }}
                  />
                ) : (
                  <p>Documentation is being generated...</p>
                )}

                <h2>Package Information</h2>
                <pre className="rounded bg-gray-100 p-4 text-sm">
                  <code>{JSON.stringify(build.packageJson, null, 2)}</code>
                </pre>
              </div>
            </div>
          )}

          {previewMode === 'live' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="mx-auto max-w-4xl">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  Live Plugin Testing
                </h3>

                <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-center">
                    <span className="mr-2 text-yellow-600">⚠️</span>
                    <p className="text-sm text-yellow-800">
                      Live testing runs your plugin in a secure sandbox
                      environment. This feature will be available once E2B
                      integration is complete.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h4 className="mb-4 font-medium text-gray-900">
                      Interactive Console
                    </h4>
                    <div className="rounded bg-gray-900 p-4 font-mono text-sm text-green-400">
                      <div>$ eliza-plugin-test {project.name}</div>
                      <div className="mt-2 text-gray-400">
                        {/* Interactive testing coming soon... */}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h4 className="mb-4 font-medium text-gray-900">
                      API Endpoints
                    </h4>
                    <div className="text-sm text-gray-600">
                      Test your plugin's API endpoints and integrations in
                      real-time.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
