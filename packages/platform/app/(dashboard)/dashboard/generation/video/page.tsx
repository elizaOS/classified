/**
 * Video Generation Page
 * Interface for AI video generation
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  VideoIcon,
  PaperPlaneIcon,
  DownloadIcon,
  ReloadIcon,
  GearIcon,
  PlayIcon,
  PauseIcon,
  MagicWandIcon,
} from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

interface VideoResult {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  prompt: string;
  model: string;
  timestamp: Date;
  duration: number;
  cost: number;
  status: 'processing' | 'completed' | 'failed';
}

const videoStyles = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Movie-like quality with dramatic lighting',
  },
  { id: 'anime', name: 'Anime', description: 'Animated anime/manga style' },
  { id: 'realistic', name: 'Realistic', description: 'Photorealistic video' },
  { id: 'artistic', name: 'Artistic', description: 'Stylized and artistic' },
  { id: 'cartoon', name: 'Cartoon', description: '3D cartoon animation' },
];

const aspectRatios = [
  { id: '16:9', name: 'Landscape (16:9)', width: 1920, height: 1080 },
  { id: '9:16', name: 'Portrait (9:16)', width: 1080, height: 1920 },
  { id: '1:1', name: 'Square (1:1)', width: 1080, height: 1080 },
];

export default function VideoGenerationPage() {
  const [prompt, setPrompt] = useState('');
  const [motionPrompt, setMotionPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(videoStyles[0]);
  const [results, setResults] = useState<VideoResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // Generation settings
  const [settings, setSettings] = useState({
    model: 'google-veo',
    provider: 'google',
    aspectRatio: '16:9',
    duration: 5,
    fps: 24,
    loop: false,
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsGenerating(true);

    try {
      // Create a processing video first
      const processingResult: VideoResult = {
        id: `vid_${Date.now()}`,
        videoUrl: '',
        thumbnailUrl: 'https://picsum.photos/400/225',
        prompt,
        model: settings.model,
        timestamp: new Date(),
        duration: settings.duration,
        cost: settings.duration * 0.15,
        status: 'processing',
      };

      setResults((prev) => [processingResult, ...prev]);

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Update with completed video (mock)
      setResults((prev) =>
        prev.map((result) =>
          result.id === processingResult.id
            ? {
                ...result,
                status: 'completed' as const,
                videoUrl:
                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                thumbnailUrl: 'https://picsum.photos/seed/video/400/225',
              }
            : result,
        ),
      );
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (videoUrl: string, filename: string) => {
    if (!videoUrl) {
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const toggleVideo = (videoId: string) => {
    setPlayingVideo(playingVideo === videoId ? null : videoId);
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
                Video Generation
              </h1>
              <p className="text-typography-weak">
                Create dynamic videos from text descriptions
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                New
              </span>
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
          </div>
        </div>

        {/* Input Area */}
        <div className="border-b border-stroke-weak p-6">
          <div className="space-y-6">
            {/* Style Selection */}
            <div>
              <label className="mb-3 block text-sm font-medium text-typography-strong">
                Video Style
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {videoStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      selectedStyle.id === style.id
                        ? 'border-purple-200 bg-purple-500/10 text-purple-600'
                        : 'border-stroke-weak hover:bg-hover',
                    )}
                  >
                    <div className="text-sm font-medium">{style.name}</div>
                    <div className="mt-1 text-xs text-typography-weak">
                      {style.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-typography-strong">
                  Scene Description
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A serene mountain landscape with a flowing river, birds flying overhead..."
                  className="w-full resize-none rounded-lg border border-stroke-weak p-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={4}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-typography-strong">
                  Motion Description (Optional)
                </label>
                <textarea
                  value={motionPrompt}
                  onChange={(e) => setMotionPrompt(e.target.value)}
                  placeholder="Camera pans slowly from left to right, water flows gently, birds move across the sky..."
                  className="w-full resize-none rounded-lg border border-stroke-weak p-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={4}
                />
              </div>
            </div>

            {/* Quick Settings */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <label className="mb-1 block text-xs text-typography-weak">
                    Aspect Ratio
                  </label>
                  <select
                    value={settings.aspectRatio}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        aspectRatio: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-stroke-weak p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {aspectRatios.map((ratio) => (
                      <option key={ratio.id} value={ratio.id}>
                        {ratio.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-typography-weak">
                    Duration
                  </label>
                  <select
                    value={settings.duration}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        duration: parseInt(e.target.value, 10),
                      }))
                    }
                    className="rounded-lg border border-stroke-weak p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={3}>3 seconds</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                  </select>
                </div>

                <div className="text-xs text-typography-weak">
                  Est. cost: ${(settings.duration * 0.15).toFixed(2)}
                </div>
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
                    <MagicWandIcon className="h-4 w-4" />
                    Generate Video
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
                  <VideoIcon className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-typography-strong">
                  No videos generated yet
                </h3>
                <p className="text-typography-weak">
                  Enter a prompt above to start creating videos
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="bg-card overflow-hidden rounded-lg border border-stroke-weak"
                  >
                    {/* Video/Thumbnail */}
                    <div className="relative aspect-video bg-gray-100">
                      {result.status === 'processing' ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <ReloadIcon className="mx-auto mb-2 h-8 w-8 animate-spin text-purple-600" />
                            <p className="text-sm text-typography-weak">
                              Processing video...
                            </p>
                          </div>
                        </div>
                      ) : result.status === 'completed' && result.videoUrl ? (
                        <div className="relative h-full w-full">
                          {playingVideo === result.id ? (
                            <video
                              src={result.videoUrl}
                              controls
                              autoPlay
                              loop={settings.loop}
                              className="h-full w-full object-cover"
                              onEnded={() => setPlayingVideo(null)}
                            />
                          ) : (
                            <>
                              <Image
                                src={result.thumbnailUrl}
                                alt={result.prompt}
                                width={1920}
                                height={1080}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <button
                                  onClick={() => toggleVideo(result.id)}
                                  className="rounded-full bg-white/90 p-3 transition-colors hover:bg-white"
                                >
                                  <PlayIcon className="h-6 w-6 text-gray-900" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                          <p className="text-sm text-red-600">
                            Generation failed
                          </p>
                        </div>
                      )}

                      {/* Download button */}
                      {result.status === 'completed' && result.videoUrl && (
                        <button
                          onClick={() =>
                            handleDownload(
                              result.videoUrl,
                              `video_${result.id}.mp4`,
                            )
                          }
                          className="absolute right-2 top-2 rounded-lg bg-black/50 p-2 transition-colors hover:bg-black/70"
                        >
                          <DownloadIcon className="h-4 w-4 text-white" />
                        </button>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p className="mb-2 line-clamp-2 text-sm text-typography-strong">
                        {result.prompt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-typography-weak">
                        <span>
                          {result.model} • {result.duration}s
                        </span>
                        <span>${result.cost.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-typography-weak">
                        <span
                          className={cn(
                            'capitalize',
                            result.status === 'completed'
                              ? 'text-green-600'
                              : result.status === 'processing'
                                ? 'text-yellow-600'
                                : 'text-red-600',
                          )}
                        >
                          {result.status}
                        </span>
                        <span>{result.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      {showSettings && (
        <div className="w-80 border-l border-stroke-weak bg-background p-6">
          <h3 className="mb-4 text-lg font-semibold">Video Settings</h3>

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
                <option value="google-veo">Google Veo</option>
                <option value="runwayml">RunwayML</option>
                <option value="stable-video">Stable Video Diffusion</option>
              </select>
            </div>

            {/* FPS */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Frame Rate
              </label>
              <select
                value={settings.fps}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    fps: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full rounded-lg border border-stroke-weak p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={24}>24 FPS (Cinema)</option>
                <option value={30}>30 FPS (Standard)</option>
                <option value={60}>60 FPS (Smooth)</option>
              </select>
            </div>

            {/* Loop */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="loop"
                checked={settings.loop}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, loop: e.target.checked }))
                }
                className="rounded"
              />
              <label htmlFor="loop" className="text-sm font-medium">
                Create seamless loop
              </label>
            </div>

            {/* Info */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h4 className="mb-2 font-medium text-blue-900">
                Video Generation
              </h4>
              <p className="text-sm text-blue-700">
                Video generation typically takes 2-5 minutes depending on
                duration and complexity. Longer videos cost more credits.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
