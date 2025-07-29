/**
 * Generation Studio Dashboard
 * Main dashboard for multi-modal content generation
 */

'use client';

import { useState, useEffect } from 'react';
import {
  MagicWandIcon,
  ImageIcon,
  VideoIcon,
  SpeakerLoudIcon,
  CubeIcon,
  ChatBubbleIcon,
  LayersIcon,
  BarChartIcon,
  PlusIcon,
  ArrowRightIcon,
} from '@radix-ui/react-icons';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface GenerationStats {
  totalGenerations: number;
  totalCost: number;
  creditsUsed: number;
  successRate: number;
  recentGenerations: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    cost: number;
  }>;
  typeBreakdown: Record<string, number>;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  isNew?: boolean;
}

const quickActions: QuickAction[] = [
  {
    id: 'text',
    title: 'Text Generation',
    description: 'Create text, articles, code, and chat responses',
    icon: <ChatBubbleIcon className="h-6 w-6" />,
    href: '/dashboard/generation/text',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  {
    id: 'image',
    title: 'Image Creation',
    description: 'Generate images, artwork, and visual content',
    icon: <ImageIcon className="h-6 w-6" />,
    href: '/dashboard/generation/image',
    color: 'bg-green-500/10 text-green-600 border-green-200',
  },
  {
    id: 'video',
    title: 'Video Generation',
    description: 'Create videos from text and image prompts',
    icon: <VideoIcon className="h-6 w-6" />,
    href: '/dashboard/generation/video',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    isNew: true,
  },
  {
    id: 'audio',
    title: 'Audio & Speech',
    description: 'Generate speech, music, and audio effects',
    icon: <SpeakerLoudIcon className="h-6 w-6" />,
    href: '/dashboard/generation/audio',
    color: 'bg-orange-500/10 text-orange-600 border-orange-200',
  },
  {
    id: '3d',
    title: '3D & Avatars',
    description: 'Create 3D models, avatars, and objects',
    icon: <CubeIcon className="h-6 w-6" />,
    href: '/dashboard/generation/3d',
    color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
    isNew: true,
  },
  {
    id: 'projects',
    title: 'Projects',
    description: 'Organize generations into projects',
    icon: <LayersIcon className="h-6 w-6" />,
    href: '/dashboard/generation/projects',
    color: 'bg-gray-500/10 text-gray-600 border-gray-200',
  },
];

export default function GenerationStudioPage() {
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Mock data for now - would fetch from API
      setStats({
        totalGenerations: 1247,
        totalCost: 89.23,
        creditsUsed: 3456,
        successRate: 98.5,
        recentGenerations: [
          {
            id: 'gen_123',
            type: 'image',
            status: 'completed',
            createdAt: new Date().toISOString(),
            cost: 0.05,
          },
          {
            id: 'gen_124',
            type: 'text',
            status: 'processing',
            createdAt: new Date().toISOString(),
            cost: 0.02,
          },
        ],
        typeBreakdown: {
          text: 45,
          image: 30,
          audio: 15,
          video: 8,
          '3d': 2,
        },
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-typography-strong">
            Generation Studio
          </h1>
          <p className="mt-2 text-typography-weak">
            Create amazing content with AI-powered generation tools
          </p>
        </div>

        <Link
          href="/dashboard/generation/text"
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
        >
          <PlusIcon className="h-4 w-4" />
          Start Creating
        </Link>
      </div>

      {/* Stats Cards */}
      {!loading && stats && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-card rounded-lg border border-stroke-weak p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-typography-weak">
                  Total Generations
                </p>
                <p className="text-2xl font-bold text-typography-strong">
                  {stats.totalGenerations.toLocaleString()}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <MagicWandIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-stroke-weak p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-typography-weak">Total Cost</p>
                <p className="text-2xl font-bold text-typography-strong">
                  ${stats.totalCost.toFixed(2)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <BarChartIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-stroke-weak p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-typography-weak">Credits Used</p>
                <p className="text-2xl font-bold text-typography-strong">
                  {stats.creditsUsed.toLocaleString()}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                <LayersIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-stroke-weak p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-typography-weak">Success Rate</p>
                <p className="text-2xl font-bold text-typography-strong">
                  {stats.successRate}%
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                <BarChartIcon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-typography-strong">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                'group relative rounded-lg border-2 border-dashed p-6 transition-all duration-200 hover:border-solid hover:shadow-lg',
                action.color,
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    {action.icon}
                    <h3 className="font-semibold">{action.title}</h3>
                    {action.isNew && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mb-4 text-sm opacity-70">
                    {action.description}
                  </p>
                </div>
                <ArrowRightIcon className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity & Type Breakdown */}
      {!loading && stats && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Generations */}
          <div className="bg-card rounded-lg border border-stroke-weak p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-typography-strong">
                Recent Generations
              </h3>
              <Link
                href="/dashboard/generation?tab=history"
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {stats.recentGenerations.map((gen) => (
                <div
                  key={gen.id}
                  className="flex items-center justify-between rounded-lg bg-background p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        gen.status === 'completed'
                          ? 'bg-green-500'
                          : gen.status === 'processing'
                            ? 'bg-yellow-500'
                            : 'bg-red-500',
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {gen.type} Generation
                      </p>
                      <p className="text-xs text-typography-weak">
                        {new Date(gen.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      ${gen.cost.toFixed(3)}
                    </p>
                    <p className="text-xs capitalize text-typography-weak">
                      {gen.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Generation Type Breakdown */}
          <div className="bg-card rounded-lg border border-stroke-weak p-6">
            <h3 className="mb-4 text-lg font-semibold text-typography-strong">
              Generation Types
            </h3>

            <div className="space-y-4">
              {Object.entries(stats.typeBreakdown).map(([type, percentage]) => (
                <div key={type}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {type}
                    </span>
                    <span className="text-sm text-typography-weak">
                      {percentage}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background">
                    <div
                      className="h-2 rounded-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-purple-600"></div>
        </div>
      )}
    </div>
  );
}
