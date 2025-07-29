/**
 * Text Generation Page
 * Interface for text, chat, and code generation
 */

'use client';

import { useState } from 'react';
import {
  ChatBubbleIcon,
  CodeIcon,
  FileTextIcon,
  PaperPlaneIcon,
  CopyIcon,
  DownloadIcon,
  ReloadIcon,
  GearIcon,
  MagicWandIcon,
} from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

interface GenerationMode {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  prompt?: string;
}

interface GenerationResult {
  id: string;
  content: string;
  model: string;
  timestamp: Date;
  cost: number;
  tokens: number;
}

const generationModes: GenerationMode[] = [
  {
    id: 'chat',
    label: 'Chat Assistant',
    description: 'Conversational AI responses',
    icon: <ChatBubbleIcon className="h-4 w-4" />,
    prompt:
      "You are a helpful AI assistant. Respond to the user's message in a friendly and informative way.",
  },
  {
    id: 'article',
    label: 'Article Writing',
    description: 'Long-form content creation',
    icon: <FileTextIcon className="h-4 w-4" />,
    prompt: 'Write a comprehensive, well-structured article about:',
  },
  {
    id: 'code',
    label: 'Code Generation',
    description: 'Programming code and scripts',
    icon: <CodeIcon className="h-4 w-4" />,
    prompt: 'Generate clean, well-documented code for:',
  },
  {
    id: 'creative',
    label: 'Creative Writing',
    description: 'Stories, poems, and creative content',
    icon: <MagicWandIcon className="h-4 w-4" />,
    prompt: 'Write a creative and engaging piece about:',
  },
];

export default function TextGenerationPage() {
  const [selectedMode, setSelectedMode] = useState(generationModes[0]);
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(selectedMode.prompt || '');
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Generation settings
  const [settings, setSettings] = useState({
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2000,
    provider: 'openai',
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsGenerating(true);

    try {
      // Mock generation - would call actual API
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockResult: GenerationResult = {
        id: `gen_${Date.now()}`,
        content: `Generated response for: "${prompt}"\n\nThis is a mock response that demonstrates the text generation interface. In a real implementation, this would be the actual AI-generated content based on your prompt and settings.`,
        model: settings.model,
        timestamp: new Date(),
        cost: 0.023,
        tokens: 156,
      };

      setResults((prev) => [mockResult, ...prev]);
      setPrompt('');
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Show toast notification
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = (result: GenerationResult) => {
    const blob = new Blob([result.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generation_${result.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-stroke-weak p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-typography-strong">
                Text Generation
              </h1>
              <p className="text-typography-weak">
                Create text, articles, code, and conversational content
              </p>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'rounded-lg border p-2 transition-colors',
                showSettings
                  ? 'border-purple-200 bg-purple-500/10 text-purple-600'
                  : 'border-stroke-weak hover:bg-hover',
              )}
            >
              <GearIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Generation Modes */}
          <div className="mt-6 flex gap-2">
            {generationModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode);
                  setSystemPrompt(mode.prompt || '');
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors',
                  selectedMode.id === mode.id
                    ? 'border-purple-200 bg-purple-500/10 text-purple-600'
                    : 'border-stroke-weak hover:bg-hover',
                )}
              >
                {mode.icon}
                <span className="text-sm font-medium">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-b border-stroke-weak p-6">
          <div className="space-y-4">
            {/* System Prompt (if settings shown) */}
            {showSettings && (
              <div>
                <label className="mb-2 block text-sm font-medium text-typography-strong">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Set the AI's role and behavior..."
                  className="w-full resize-none rounded-lg border border-stroke-weak p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                />
              </div>
            )}

            {/* Main Prompt */}
            <div>
              <label className="mb-2 block text-sm font-medium text-typography-strong">
                Your Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Enter your ${selectedMode.label.toLowerCase()} prompt here...`}
                className="w-full resize-none rounded-lg border border-stroke-weak p-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleGenerate();
                  }
                }}
              />
            </div>

            {/* Generate Button */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-typography-weak">
                Press Cmd+Enter to generate
              </div>

              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors',
                  !prompt.trim() || isGenerating
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                    : 'bg-purple-600 text-white hover:bg-purple-700',
                )}
              >
                {isGenerating ? (
                  <>
                    <ReloadIcon className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <PaperPlaneIcon className="h-4 w-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {results.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
                  <ChatBubbleIcon className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-typography-strong">
                  No generations yet
                </h3>
                <p className="text-typography-weak">
                  Enter a prompt above to start generating content
                </p>
              </div>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className="bg-card rounded-lg border border-stroke-weak p-6"
                >
                  {/* Result Header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">
                        {result.model}
                      </span>
                      <span className="text-sm text-typography-weak">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-typography-weak">
                        {result.tokens} tokens • ${result.cost.toFixed(3)}
                      </span>

                      <button
                        onClick={() => handleCopy(result.content)}
                        className="rounded-lg p-2 transition-colors hover:bg-hover"
                        title="Copy to clipboard"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDownload(result)}
                        className="rounded-lg p-2 transition-colors hover:bg-hover"
                        title="Download as file"
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Result Content */}
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed text-typography-strong">
                      {result.content}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      {showSettings && (
        <div className="w-80 border-l border-stroke-weak bg-background p-6">
          <h3 className="mb-4 text-lg font-semibold">Generation Settings</h3>

          <div className="space-y-6">
            {/* Model Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium">Model</label>
              <select
                value={settings.model}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, model: e.target.value }))
                }
                className="w-full rounded-lg border border-stroke-weak p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="gpt-4o">GPT-4o (Recommended)</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Temperature: {settings.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    temperature: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-xs text-typography-weak">
                <span>Focused</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Max Tokens
              </label>
              <input
                type="number"
                min="1"
                max="8000"
                value={settings.maxTokens}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxTokens: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full rounded-lg border border-stroke-weak p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Provider */}
            <div>
              <label className="mb-2 block text-sm font-medium">Provider</label>
              <select
                value={settings.provider}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, provider: e.target.value }))
                }
                className="w-full rounded-lg border border-stroke-weak p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
